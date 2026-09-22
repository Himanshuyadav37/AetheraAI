import os
import re
import subprocess
from pathlib import Path


_TOKEN_PATTERNS = [
    re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}'),
    re.compile(r'github_pat_[A-Za-z0-9_]{20,}'),
    re.compile(r'(?i)Bearer\s+[A-Za-z0-9._\-+=/]{10,}'),
    re.compile(r'(?i)x-access-token:[^@\s]+@'),
]

_URL_AUTH_PATTERN = re.compile(r'(?P<scheme>https?|git|ssh|ftps?)://(?P<creds>[^@\s]+)@(?P<rest>.+)')


def _strip_token(url_or_cmd: str) -> str:
    if not isinstance(url_or_cmd, str) or not url_or_cmd:
        return url_or_cmd or ""
    result = url_or_cmd
    for pattern in _TOKEN_PATTERNS:
        result = pattern.sub('[REDACTED]', result)
    m = _URL_AUTH_PATTERN.match(result)
    if m:
        result = f"{m.group('scheme')}://***:***@{m.group('rest')}"
    else:
        result = re.sub(r'(?i)://[^@\s:]+:[^@\s]+@', '://***:***@', result)
        result = re.sub(r'(?i)://[^@\s]+@', '://***@', result)
    return result


def _run_git(cwd, *args, timeout=60, env=None):
    merged_env = {**os.environ, **(env or {})}
    cmd_for_log = _strip_token("git " + " ".join(args))
    print(f"[GitService] running: {cmd_for_log} cwd={cwd}")
    try:
        p = subprocess.run(
            ['git', *args],
            capture_output=True,
            text=True,
            cwd=str(cwd),
            timeout=timeout,
            env=merged_env,
            check=False,
        )
        return {
            'returncode': p.returncode,
            'stdout': p.stdout or '',
            'stderr': _strip_token(p.stderr or ''),
        }
    except subprocess.TimeoutExpired as e:
        stdout = e.stdout or ''
        stderr = e.stderr or ''
        if isinstance(stdout, bytes):
            stdout = stdout.decode('utf-8', errors='replace')
        if isinstance(stderr, bytes):
            stderr = stderr.decode('utf-8', errors='replace')
        return {
            'returncode': -1,
            'stdout': stdout,
            'stderr': _strip_token(stderr) or f"Git command timed out after {timeout}s",
        }
    except Exception as e:
        return {
            'returncode': -1,
            'stdout': '',
            'stderr': _strip_token(str(e)),
        }


def detect_git_repo(project_dir):
    project_dir = str(project_dir)
    result = {
        'is_repo': False,
        'current_branch': None,
        'has_remote': False,
        'remote_url_redacted': None,
    }
    if not os.path.exists(project_dir):
        return result

    check = _run_git(project_dir, 'rev-parse', '--git-dir', timeout=10)
    if check['returncode'] != 0:
        return result
    result['is_repo'] = True

    branch_res = _run_git(project_dir, 'symbolic-ref', '--short', 'HEAD', timeout=10)
    if branch_res['returncode'] == 0 and branch_res['stdout'].strip():
        result['current_branch'] = branch_res['stdout'].strip()
    else:
        short_res = _run_git(project_dir, 'rev-parse', '--short', 'HEAD', timeout=10)
        if short_res['returncode'] == 0 and short_res['stdout'].strip():
            result['current_branch'] = short_res['stdout'].strip()

    remote_res = _run_git(project_dir, 'remote', 'get-url', 'origin', timeout=10)
    if remote_res['returncode'] == 0 and remote_res['stdout'].strip():
        result['has_remote'] = True
        result['remote_url_redacted'] = _strip_token(remote_res['stdout'].strip())

    return result


def git_init(project_dir, default_branch='main'):
    project_dir = str(project_dir)
    os.makedirs(project_dir, exist_ok=True)
    note = ""

    init_res = _run_git(project_dir, 'init', '-b', default_branch, timeout=30)
    if init_res['returncode'] != 0:
        return False, init_res['stderr'] or "git init failed"
    note = "Initialized repo"

    email_res = _run_git(project_dir, 'config', 'user.email', 'aethera@local', timeout=10)
    name_res = _run_git(project_dir, 'config', 'user.name', 'Aethera AI', timeout=10)
    if email_res['returncode'] != 0 or name_res['returncode'] != 0:
        note += " (config set best-effort)"

    return True, note


def git_branch(project_dir, branch_name=None, create=False):
    project_dir = str(project_dir)
    result = {'branches': [], 'current': None}

    if create and branch_name:
        create_res = _run_git(project_dir, 'checkout', '-b', branch_name, timeout=30)
        if create_res['returncode'] != 0:
            switch_res = _run_git(project_dir, 'switch', branch_name, timeout=30)
            if switch_res['returncode'] != 0:
                print(f"[GitService] branch create/switch failed: {create_res['stderr']} / {switch_res['stderr']}")

    list_res = _run_git(project_dir, 'branch', '--format=%(refname:short)', timeout=15)
    if list_res['returncode'] == 0:
        lines = [l.strip() for l in (list_res['stdout'] or '').splitlines() if l.strip()]
        result['branches'] = lines

    cur_res = _run_git(project_dir, 'rev-parse', '--abbrev-ref', 'HEAD', timeout=10)
    if cur_res['returncode'] == 0 and cur_res['stdout'].strip():
        result['current'] = cur_res['stdout'].strip()

    return result


def git_status(project_dir):
    project_dir = str(project_dir)
    out = {
        'staged': [],
        'unstaged': [],
        'untracked': [],
        'counts': {'s': 0, 'u': 0, 'ut': 0},
    }

    res = _run_git(project_dir, 'status', '--porcelain=v1', timeout=15)
    if res['returncode'] != 0:
        return out

    for line in (res['stdout'] or '').splitlines():
        if not line or len(line) < 3:
            continue
        x = line[0]
        y = line[1]
        path = line[3:].strip()
        if not path:
            continue

        if x in ('A', 'M', 'D', 'R', 'C'):
            out['staged'].append({'path': path, 'status': x})
            out['counts']['s'] += 1
        if y in ('M', 'D'):
            out['unstaged'].append({'path': path, 'status': y})
            out['counts']['u'] += 1
        if x == '?' and y == '?':
            out['untracked'].append({'path': path, 'status': '??'})
            out['counts']['ut'] += 1

    return out


def git_diff(project_dir, staged=False, pathspec=None):
    project_dir = str(project_dir)
    args = ['diff', '--unified=3']
    if staged:
        args.append('--cached')
    if pathspec:
        args.append(pathspec)

    res = _run_git(project_dir, *args, timeout=60)
    return res['stdout'] or ''


def git_commit(project_dir, message):
    project_dir = str(project_dir)
    add_res = _run_git(project_dir, 'add', '-A', timeout=60)
    if add_res['returncode'] != 0:
        return {'ok': False, 'commit_hash': None, 'error': add_res['stderr'] or 'git add failed'}

    commit_res = _run_git(project_dir, 'commit', '-m', message, timeout=120)
    if commit_res['returncode'] != 0:
        return {'ok': False, 'commit_hash': None, 'error': commit_res['stderr'] or 'git commit failed'}

    hash_res = _run_git(project_dir, 'rev-parse', 'HEAD', timeout=10)
    commit_hash = hash_res['stdout'].strip() if hash_res['returncode'] == 0 else None

    return {'ok': True, 'commit_hash': commit_hash}


def git_pull(project_dir, remote='origin', branch=None, ff_only=True):
    project_dir = str(project_dir)
    args = ['pull']
    if remote:
        args.append(remote)
    if branch:
        args.append(branch)
    if ff_only:
        args.append('--ff-only')

    return _run_git(project_dir, *args, timeout=300)


def git_import_from_github(remote_url, target_dir, token=None, user=None, shallow=True):
    target_dir = str(target_dir)
    os.makedirs(target_dir, exist_ok=True)

    auth_url = remote_url
    if token:
        if '://' in remote_url:
            scheme, rest = remote_url.split('://', 1)
            user_part = user or 'oauth2'
            auth_url = f"{scheme}://{user_part}:{token}@{rest}"

    redacted_log_url = _strip_token(auth_url)
    print(f"[GitService] cloning {redacted_log_url} -> {target_dir}")

    parent_dir = os.path.dirname(target_dir) or '.'
    os.makedirs(parent_dir, exist_ok=True)

    args = ['clone']
    if shallow:
        args.extend(['--depth', '1'])
    args.extend([auth_url, target_dir])

    return _run_git(parent_dir, *args, timeout=300)
