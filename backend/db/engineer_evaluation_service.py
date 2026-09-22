from datetime import datetime

from db.mongo_client import db

COLLECTION_NAME = 'engineer_evaluations'

engineer_evaluations_collection = db[COLLECTION_NAME]


def save_engineer_evaluation(evaluation_dict):
    if not evaluation_dict or not evaluation_dict.get('execution_id'):
        raise ValueError("evaluation_dict must contain execution_id")

    now = datetime.utcnow()
    now_iso = now.isoformat()
    evaluation_dict['created_at'] = evaluation_dict.get('created_at') or now_iso
    evaluation_dict['updated_at'] = now_iso

    engineer_evaluations_collection.update_one(
        {'execution_id': evaluation_dict['execution_id']},
        {'$set': evaluation_dict},
        upsert=True,
    )
    return evaluation_dict


def get_engineer_evaluation_by_execution(execution_id):
    if not execution_id:
        return None
    return engineer_evaluations_collection.find_one({'execution_id': execution_id}) or None


def list_engineer_evaluations(project_id=None, user_id=None, limit=100, offset=0):
    q = {}
    if project_id:
        q['project_id'] = project_id
    if user_id:
        q['user_id'] = user_id

    cursor = engineer_evaluations_collection.find(q).sort('created_at', -1).skip(offset).limit(limit)
    return list(cursor)


def build_engineer_evaluation(state: dict):
    execution_id = state.get('execution_id')
    project_id = state.get('project_id')
    user_id = state.get('user_id')

    tr = state.get('test_results') or {}
    if not isinstance(tr, dict):
        tr = {}

    sar = state.get('static_analysis_results') or {}
    if not isinstance(sar, dict):
        sar = {}

    sec = state.get('security_analysis_results') or {}
    if not isinstance(sec, dict):
        sec = {}

    qg = state.get('quality_gate_report') or {}
    if not isinstance(qg, dict):
        qg = {}

    steps = state.get('execution_steps') or []
    if not isinstance(steps, list):
        steps = []

    usage = {}
    tokens_total = 0
    cost_total = 0.0
    try:
        from services.usage_tracker import UsageTracker
        if hasattr(UsageTracker, 'get_execution_usage'):
            usage = UsageTracker.get_execution_usage(execution_id) if execution_id else {}
        if isinstance(usage, dict):
            tokens_total = usage.get('total_tokens', 0) or 0
            cost_total = usage.get('estimated_cost_usd', 0.0) or 0.0
    except Exception:
        pass

    latencies = {}
    for s in steps:
        if not isinstance(s, dict):
            continue
        agent = s.get('agent') or s.get('step')
        if agent and s.get('duration_ms'):
            try:
                latencies[agent] = latencies.get(agent, 0) + int(s['duration_ms'])
            except (TypeError, ValueError):
                pass

    iterations = state.get('iterations', 0) or 0
    success = qg.get('overall') == 'PASS'

    coverage = tr.get('coverage') if isinstance(tr, dict) else None

    tests_summary = {}
    if isinstance(tr, dict):
        suites = tr.get('test_suites') or tr.get('execution', {}).get('commands', [])
        if isinstance(suites, list):
            total = 0
            passed = 0
            suite_details = []
            for c in suites:
                if not isinstance(c, dict):
                    continue
                cmd_lower = (c.get('cmd', '') or '').lower()
                if 'test' not in cmd_lower:
                    continue
                total += 1
                if c.get('success', True):
                    passed += 1
                if len(suite_details) < 20:
                    suite_details.append({
                        k: c.get(k)
                        for k in ('name', 'success', 'duration_ms')
                        if k in c
                    })
            tests_summary = {
                'total_suites': total,
                'passed_suites': passed,
                'failed_suites': max(total - passed, 0),
                'pass_rate': (passed / total) if total else None,
                'suites': suite_details,
            }

    sa_counts = {}
    sar_findings = sar.get('findings') or []
    if isinstance(sar_findings, list):
        for f in sar_findings:
            if not isinstance(f, dict):
                continue
            sev = f.get('severity', 'UNKNOWN') or 'UNKNOWN'
            sa_counts[sev] = sa_counts.get(sev, 0) + 1

    sec_counts = {}
    sec_categories = {}
    sec_findings = sec.get('findings') or []
    if isinstance(sec_findings, list):
        for f in sec_findings:
            if not isinstance(f, dict):
                continue
            sev = f.get('severity', 'UNKNOWN') or 'UNKNOWN'
            cat = f.get('category', 'UNKNOWN') or 'UNKNOWN'
            sec_counts[sev] = sec_counts.get(sev, 0) + 1
            sec_categories[cat] = sec_categories.get(cat, 0) + 1

    deployment_plan = state.get('deployment_plan')
    if isinstance(deployment_plan, dict):
        deployment_plan_paths = list(deployment_plan.keys())
    else:
        deployment_plan_paths = []

    coverage_out = None
    if isinstance(coverage, dict):
        coverage_out = {
            k: coverage.get(k)
            for k in ('line', 'branch', 'statement', 'function', 'line_pct')
            if k in coverage
        }

    learnings_applied = state.get('learnings_applied', [])
    if not isinstance(learnings_applied, list):
        learnings_applied = []

    agent_notes = state.get('agent_notes', [])
    if not isinstance(agent_notes, list):
        agent_notes = []

    retries = 0
    for s in steps:
        if isinstance(s, dict):
            try:
                if int(s.get('attempt', 1) or 1) > 1:
                    retries += 1
            except (TypeError, ValueError):
                pass

    eval_doc = {
        'execution_id': execution_id,
        'project_id': project_id,
        'user_id': user_id,
        'parent_execution_id': state.get('parent_execution_id'),
        'workspace_mode': state.get('mode'),
        'success': success,
        'tests': tests_summary,
        'coverage': coverage_out,
        'security': {
            'severity_counts': sec_counts,
            'category_counts': sec_categories,
        },
        'static_analysis': {
            'severity_counts': sa_counts,
            'total_findings': len(sar_findings) if isinstance(sar_findings, list) else 0,
        },
        'iterations': iterations,
        'retries': retries,
        'latencies_ms': latencies,
        'total_latency_ms': sum(latencies.values()),
        'tokens_total': int(tokens_total or 0),
        'cost_total_usd': float(cost_total or 0.0),
        'deployment': {
            'quality_gate': qg.get('overall'),
            'deployment_plan_paths': deployment_plan_paths,
        },
        'quality_gate': qg,
        'learnings_applied': learnings_applied,
        'agent_notes': agent_notes[-10:],
    }

    return eval_doc
