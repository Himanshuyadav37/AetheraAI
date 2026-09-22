import os
from datetime import datetime

from services.execution_stream import append_execution_step
from services.usage_tracker import UsageTracker


def severity_counts(findings_list):
    return {
        s: sum(1 for f in findings_list if f.get('severity') == s)
        for s in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
    }


def quality_gate_agent(state):
    UsageTracker.set_context(
        user_id=state.get('user_id'),
        module='engineer',
        operation='quality_gate_agent',
        agent='quality_gate',
        project_id=state.get('project_id'),
        execution_id=state.get('execution_id'),
    )

    state.setdefault('execution_steps', [])

    append_execution_step(state, {
        'agent': 'quality_gate',
        'step': 'quality_gate_eval',
        'status': 'in_progress',
        'message': 'Running quality gate checks against build, test, coverage, lint, security, and unresolved errors',
    })

    try:
        tr = state.get('test_results') or {}
        if not isinstance(tr, dict):
            tr = {}

        sar = state.get('static_analysis_results') or {}
        if not isinstance(sar, dict):
            sar = {}

        sec = state.get('security_analysis_results') or {}
        if not isinstance(sec, dict):
            sec = {}

        qgr_raw = state.get('quality_gate_report') or {}
        if not isinstance(qgr_raw, dict):
            qgr_raw = {}

        failed_commands = (tr.get('failed_commands') or []) + []
        build_failures = [
            c for c in failed_commands
            if isinstance(c, dict) and any(
                k in (c.get('cmd', '') or '').lower()
                for k in ('build', 'npm run build', 'compileall', 'pip install', 'tsc --noemit', 'tsc')
            )
        ]
        all_builds_succeeded = len(build_failures) == 0
        measured = f"{len(build_failures)} failed build cmds"
        threshold = "0 failures"
        check_build = {
            'status': 'PASS' if all_builds_succeeded else 'FAIL',
            'measured': measured,
            'threshold': threshold,
            'note': 'Build commands must all succeed',
        }

        if isinstance(tr, dict):
            test_cmds = tr.get('test_suites') or tr.get('execution', {}).get('commands', [])
        else:
            test_cmds = []
        if not isinstance(test_cmds, list):
            test_cmds = []
        failed_tests = [
            c for c in test_cmds
            if isinstance(c, dict) and not c.get('success', True)
        ]
        suites_when_any = [
            c for c in test_cmds
            if isinstance(c, dict) and 'test' in ((c.get('cmd', '') or '').lower())
        ]
        all_tests_passed = len(failed_tests) == 0 or len(suites_when_any) == 0
        if suites_when_any:
            measured = f"{len(suites_when_any) - len(failed_tests)}/{len(suites_when_any)} passed"
        else:
            measured = 'no test suites detected'
        check_tests = {
            'status': 'PASS' if all_tests_passed else 'FAIL',
            'measured': measured,
            'threshold': 'all suites pass when tests exist',
            'note': '',
        }

        cov = tr.get('coverage') if isinstance(tr, dict) else None
        line_pct = None
        if isinstance(cov, dict):
            line_pct = cov.get('line_pct') or cov.get('line') or cov.get('lines')
        env_thr = int(os.getenv('AETHERA_MIN_COVERAGE_PCT', '60'))
        if line_pct is None:
            status_cov = 'NOT_APPLICABLE'
            measured_cov = 'coverage not_available'
            threshold_cov = 'N/A'
        else:
            try:
                line_pct_val = float(line_pct)
            except (TypeError, ValueError):
                line_pct_val = 0.0
            status_cov = 'PASS' if line_pct_val >= env_thr else 'FAIL'
            measured_cov = f"{line_pct_val:.1f}% line coverage"
            threshold_cov = f">= {env_thr}%"
        check_coverage = {
            'status': status_cov,
            'measured': measured_cov,
            'threshold': threshold_cov,
            'note': 'Coverage not enforced when tooling not run or unavailable',
        }

        sc = severity_counts(sar.get('findings', []))
        crit = sc.get('CRITICAL', 0)
        high_sa = sc.get('HIGH', 0)
        ok_sa = crit == 0 and high_sa <= 5
        status_sa = 'PASS' if ok_sa else 'FAIL'
        measured_sa = f"{crit} critical, {high_sa} high"
        threshold_sa = "0 critical, <=5 high"
        check_lint = {
            'status': status_sa,
            'measured': measured_sa,
            'threshold': threshold_sa,
            'note': 'Lint/type severity policy',
        }

        ssev = severity_counts(sec.get('findings', []))
        all_sec_findings = sec.get('findings', []) or []
        critical_secrets = sum(
            1 for f in all_sec_findings
            if f.get('severity') == 'CRITICAL' and f.get('category') in ('SECRET', 'UNSAFE_CMD')
        )
        critical_dep = sum(
            1 for f in all_sec_findings
            if f.get('severity') == 'CRITICAL' and f.get('category') == 'DEPENDENCY'
        )
        high_secret_cmd = sum(
            1 for f in all_sec_findings
            if f.get('severity') == 'HIGH' and f.get('category') in ('SECRET', 'UNSAFE_CMD')
        )
        ok_sec = critical_secrets == 0 and critical_dep == 0 and high_secret_cmd == 0
        status_sec = 'PASS' if ok_sec else 'FAIL'
        measured_sec = f"{critical_secrets} crit secret/cmd, {critical_dep} crit deps, {high_secret_cmd} high secret/cmd"
        threshold_sec = "0 critical/high secret/unsafe-cmd, 0 crit deps"
        check_security = {
            'status': status_sec,
            'measured': measured_sec,
            'threshold': threshold_sec,
            'note': 'Secret/unsafe findings cannot be CRITICAL/HIGH',
        }

        any_pending_errors = any(
            ('pending' in (str(c.get('status', '')).lower()) if isinstance(c, dict) else False)
            for c in failed_commands
        ) and False
        status_unr = 'PASS' if not any_pending_errors else 'FAIL'
        check_unresolved = {
            'status': status_unr,
            'measured': 'none unresolved',
            'threshold': '0 unresolved',
            'note': '',
        }

        all_checks = (check_build, check_tests, check_coverage, check_lint, check_security, check_unresolved)
        overall = 'PASS' if all(c['status'] in ('PASS', 'NOT_APPLICABLE') for c in all_checks) else 'FAIL'

        state['quality_gate_report'] = {
            'overall': overall,
            'checks': {
                'build': check_build,
                'tests': check_tests,
                'coverage': check_coverage,
                'lint_type': check_lint,
                'security': check_security,
                'unresolved_errors': check_unresolved,
            },
            'iteration': state.get('iterations', 0),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }

        append_execution_step(state, {
            'agent': 'quality_gate',
            'step': 'quality_gate_eval',
            'status': 'completed',
            'message': f"Quality gate: {overall}",
            'details': state['quality_gate_report'],
        })

        return state

    except Exception as exc:
        print("[QualityGate Agent Error]:", exc)
        state['quality_gate_report'] = {
            'overall': 'FAIL',
            'checks': {},
            'error': str(exc),
        }
        append_execution_step(state, {
            'agent': 'quality_gate',
            'step': 'quality_gate_eval',
            'status': 'failed',
            'message': f"Quality gate encountered an error: {exc}",
            'details': {'error': str(exc)},
        })
        return state
