import os


def ci_yaml_exists(workspace_files: list) -> bool:
    if not isinstance(workspace_files, list):
        return False
    for p in workspace_files:
        if not isinstance(p, dict):
            continue
        path = p.get('path', '') or ''
        if path in ('.github/workflows/ci.yml', '.github/workflows/ci.yaml'):
            return True
    return False


def _indent(level: int, text: str) -> str:
    spaces = "  " * level
    if not text:
        return spaces
    return spaces + text


def _yaml_list_item(level: int, text: str) -> str:
    return _indent(level, f"- {text}")


def _detect_features(project_stack, workspace_files):
    has_eslint = False
    has_ts = False
    has_mypy = False
    has_ruff = False
    has_pytest_any = False
    has_jest_vitest = False
    has_build_script = False
    has_package_lock = False
    has_requirements = False
    has_setup_py_or_build = False

    if isinstance(workspace_files, list):
        for p in workspace_files:
            if not isinstance(p, dict):
                continue
            path = p.get('path', '') or ''
            code = p.get('code', '') or ''
            path_lower = path.lower()

            if 'eslint' in path_lower:
                has_eslint = True

            if path.endswith(('.ts', '.tsx')) or 'tsconfig.json' in path:
                has_ts = True

            if 'mypy' in path_lower:
                has_mypy = True

            if path in ('pyproject.toml', 'ruff.toml'):
                has_ruff = True

            if path.startswith('tests/') and path.endswith('.py'):
                has_pytest_any = True

            path_lc = path_lower
            if 'test' in path_lc and path.endswith(('.js', '.ts', '.jsx', '.tsx')):
                has_jest_vitest = True

            if path == 'package.json' and '"build"' in (code or ''):
                has_build_script = True

            if path == 'package-lock.json':
                has_package_lock = True

            if path == 'requirements.txt':
                has_requirements = True

            if path in ('setup.py', 'setup.cfg', 'pyproject.toml'):
                has_setup_py_or_build = True

    return {
        'has_eslint': has_eslint,
        'has_ts': has_ts,
        'has_mypy': has_mypy,
        'has_ruff': has_ruff,
        'has_pytest_any': has_pytest_any,
        'has_jest_vitest': has_jest_vitest,
        'has_build_script': has_build_script,
        'has_package_lock': has_package_lock,
        'has_requirements': has_requirements,
        'has_setup_py_or_build': has_setup_py_or_build,
    }


def _build_node_workflow(features):
    lines = []
    lines.append("name: Node.js CI")
    lines.append("")
    lines.append("on:")
    lines.append(_yaml_list_item(1, "push:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append(_yaml_list_item(1, "pull_request:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append("")
    lines.append("permissions:")
    lines.append(_indent(1, "contents: read"))
    lines.append("")
    lines.append("jobs:")
    lines.append("")

    lines.append(_indent(1, "install:"))
    lines.append(_indent(2, "runs-on: ubuntu-latest"))
    lines.append(_indent(2, "steps:"))
    lines.append(_yaml_list_item(2, "name: Checkout"))
    lines.append(_indent(3, "uses: actions/checkout@v4"))
    lines.append(_yaml_list_item(2, "name: Setup Node.js"))
    lines.append(_indent(3, "uses: actions/setup-node@v4"))
    lines.append(_indent(3, "with:"))
    lines.append(_indent(4, "node-version: '20'"))
    lines.append(_indent(4, "cache: 'npm'"))
    if features['has_package_lock']:
        lines.append(_yaml_list_item(2, "name: Install dependencies (npm ci)"))
        lines.append(_indent(3, "run: npm ci"))
    else:
        lines.append(_yaml_list_item(2, "name: Install dependencies (npm install)"))
        lines.append(_indent(3, "run: npm install"))
    lines.append("")

    build_job_deps = []

    if features['has_eslint']:
        build_job_deps.append('lint')
        lines.append(_indent(1, "lint:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Node.js"))
        lines.append(_indent(3, "uses: actions/setup-node@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "node-version: '20'"))
        lines.append(_indent(4, "cache: 'npm'"))
        if features['has_package_lock']:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm ci"))
        else:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm install"))
        lines.append(_yaml_list_item(2, "name: Run lint"))
        lines.append(_indent(3, "run: npm run lint || npx eslint ."))
        lines.append("")

    if features['has_ts']:
        build_job_deps.append('typecheck')
        lines.append(_indent(1, "typecheck:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Node.js"))
        lines.append(_indent(3, "uses: actions/setup-node@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "node-version: '20'"))
        lines.append(_indent(4, "cache: 'npm'"))
        if features['has_package_lock']:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm ci"))
        else:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm install"))
        lines.append(_yaml_list_item(2, "name: Typecheck"))
        lines.append(_indent(3, "run: npx tsc --noEmit"))
        lines.append("")

    if features['has_jest_vitest']:
        build_job_deps.append('test')
        lines.append(_indent(1, "test:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Node.js"))
        lines.append(_indent(3, "uses: actions/setup-node@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "node-version: '20'"))
        lines.append(_indent(4, "cache: 'npm'"))
        if features['has_package_lock']:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm ci"))
        else:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm install"))
        lines.append(_yaml_list_item(2, "name: Run tests"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "# Try vitest first, fallback to jest"))
        lines.append(_indent(4, "if npx vitest --version >/dev/null 2>&1; then"))
        lines.append(_indent(5, "npx vitest run --coverage"))
        lines.append(_indent(4, "else"))
        lines.append(_indent(5, "npm test -- --coverage || npm test"))
        lines.append(_indent(4, "fi"))
        lines.append(_yaml_list_item(2, "name: Upload coverage artifact"))
        lines.append(_indent(3, "if: always()"))
        lines.append(_indent(3, "uses: actions/upload-artifact@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "name: coverage-report"))
        lines.append(_indent(4, "path: |"))
        lines.append(_indent(5, "coverage/"))
        lines.append(_indent(5, "coverage.xml"))
        lines.append(_indent(5, ".nyc_output/"))
        lines.append(_indent(4, "if-no-files-found: ignore"))
        lines.append("")

    if features['has_build_script']:
        deps_str = ", ".join(build_job_deps) if build_job_deps else "install"
        cond_parts = []
        if 'lint' in build_job_deps:
            cond_parts.append("needs.lint.result != 'cancelled'")
        if 'typecheck' in build_job_deps:
            cond_parts.append("needs.typecheck.result != 'cancelled'")
        if 'test' in build_job_deps:
            cond_parts.append("needs.test.result != 'cancelled'")
        cond_parts.append("needs.install.result == 'success'")
        if_cond = "always() && " + " && ".join(cond_parts)

        lines.append(_indent(1, "build:"))
        lines.append(_indent(2, f"needs: [{deps_str}]"))
        lines.append(_indent(2, f"if: {if_cond}"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Node.js"))
        lines.append(_indent(3, "uses: actions/setup-node@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "node-version: '20'"))
        lines.append(_indent(4, "cache: 'npm'"))
        if features['has_package_lock']:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm ci"))
        else:
            lines.append(_yaml_list_item(2, "name: Install dependencies"))
            lines.append(_indent(3, "run: npm install"))
        lines.append(_yaml_list_item(2, "name: Build"))
        lines.append(_indent(3, "run: npm run build"))
        lines.append(_yaml_list_item(2, "name: Upload build artifact"))
        lines.append(_indent(3, "uses: actions/upload-artifact@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "name: build-output"))
        lines.append(_indent(4, "path: |"))
        lines.append(_indent(5, "dist/"))
        lines.append(_indent(5, "build/"))
        lines.append(_indent(5, ".next/"))
        lines.append(_indent(5, "out/"))
        lines.append(_indent(4, "if-no-files-found: ignore"))
        lines.append("")

    return "\n".join(lines)


def _build_python_workflow(features):
    lines = []
    lines.append("name: Python CI")
    lines.append("")
    lines.append("on:")
    lines.append(_yaml_list_item(1, "push:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append(_yaml_list_item(1, "pull_request:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append("")
    lines.append("permissions:")
    lines.append(_indent(1, "contents: read"))
    lines.append("")
    lines.append("jobs:")
    lines.append("")

    lines.append(_indent(1, "install:"))
    lines.append(_indent(2, "runs-on: ubuntu-latest"))
    lines.append(_indent(2, "steps:"))
    lines.append(_yaml_list_item(2, "name: Checkout"))
    lines.append(_indent(3, "uses: actions/checkout@v4"))
    lines.append(_yaml_list_item(2, "name: Setup Python"))
    lines.append(_indent(3, "uses: actions/setup-python@v5"))
    lines.append(_indent(3, "with:"))
    lines.append(_indent(4, "python-version: '3.12'"))
    lines.append(_indent(4, "cache: 'pip'"))
    lines.append(_yaml_list_item(2, "name: Create venv and install dependencies"))
    lines.append(_indent(3, "run: |"))
    lines.append(_indent(4, "python -m venv .venv"))
    lines.append(_indent(4, "source .venv/bin/activate"))
    if features['has_requirements']:
        lines.append(_indent(4, "pip install -r requirements.txt"))
    else:
        lines.append(_indent(4, "echo 'no requirements.txt found, skipping pip install'"))
    lines.append("")

    build_job_deps = []

    if features['has_ruff']:
        build_job_deps.append('lint')
        lines.append(_indent(1, "lint:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Python"))
        lines.append(_indent(3, "uses: actions/setup-python@v5"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "python-version: '3.12'"))
        lines.append(_indent(4, "cache: 'pip'"))
        lines.append(_yaml_list_item(2, "name: Install dependencies"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "python -m venv .venv"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        if features['has_requirements']:
            lines.append(_indent(4, "pip install -r requirements.txt"))
        lines.append(_indent(4, "pip install ruff"))
        lines.append(_yaml_list_item(2, "name: Ruff check"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        lines.append(_indent(4, "ruff check ."))
        lines.append("")

    if features['has_mypy']:
        build_job_deps.append('typecheck')
        lines.append(_indent(1, "typecheck:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Python"))
        lines.append(_indent(3, "uses: actions/setup-python@v5"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "python-version: '3.12'"))
        lines.append(_indent(4, "cache: 'pip'"))
        lines.append(_yaml_list_item(2, "name: Install dependencies"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "python -m venv .venv"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        if features['has_requirements']:
            lines.append(_indent(4, "pip install -r requirements.txt"))
        lines.append(_indent(4, "pip install mypy"))
        lines.append(_yaml_list_item(2, "name: Mypy typecheck"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        lines.append(_indent(4, "mypy ."))
        lines.append("")

    if features['has_pytest_any']:
        build_job_deps.append('test')
        lines.append(_indent(1, "test:"))
        lines.append(_indent(2, "needs: install"))
        lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Python"))
        lines.append(_indent(3, "uses: actions/setup-python@v5"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "python-version: '3.12'"))
        lines.append(_indent(4, "cache: 'pip'"))
        lines.append(_yaml_list_item(2, "name: Install dependencies"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "python -m venv .venv"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        if features['has_requirements']:
            lines.append(_indent(4, "pip install -r requirements.txt"))
        lines.append(_indent(4, "pip install pytest pytest-cov"))
        lines.append(_yaml_list_item(2, "name: Run pytest with coverage"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        lines.append(_indent(4, "python -m pytest --cov=. --cov-report=xml --cov-report=term"))
        lines.append(_yaml_list_item(2, "name: Upload coverage artifact"))
        lines.append(_indent(3, "if: always()"))
        lines.append(_indent(3, "uses: actions/upload-artifact@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "name: coverage-report"))
        lines.append(_indent(4, "path: coverage.xml"))
        lines.append(_indent(4, "if-no-files-found: ignore"))
        lines.append("")

    if features['has_setup_py_or_build']:
        deps_str = ", ".join(build_job_deps) if build_job_deps else "install"
        cond_parts = []
        if 'lint' in build_job_deps:
            cond_parts.append("needs.lint.result != 'cancelled'")
        if 'typecheck' in build_job_deps:
            cond_parts.append("needs.typecheck.result != 'cancelled'")
        if 'test' in build_job_deps:
            cond_parts.append("needs.test.result != 'cancelled'")
        cond_parts.append("needs.install.result == 'success'")
        if_cond = "always() && " + " && ".join(cond_parts)

        lines.append(_indent(1, "build:"))
        lines.append(_indent(2, f"needs: [{deps_str}]"))
        lines.append(_indent(2, f"if: {if_cond}"))
        lines.append(_indent(2, "runs-on: ubuntu-latest"))
        lines.append(_indent(2, "steps:"))
        lines.append(_yaml_list_item(2, "name: Checkout"))
        lines.append(_indent(3, "uses: actions/checkout@v4"))
        lines.append(_yaml_list_item(2, "name: Setup Python"))
        lines.append(_indent(3, "uses: actions/setup-python@v5"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "python-version: '3.12'"))
        lines.append(_indent(4, "cache: 'pip'"))
        lines.append(_yaml_list_item(2, "name: Install dependencies and build"))
        lines.append(_indent(3, "run: |"))
        lines.append(_indent(4, "python -m venv .venv"))
        lines.append(_indent(4, "source .venv/bin/activate"))
        if features['has_requirements']:
            lines.append(_indent(4, "pip install -r requirements.txt"))
        lines.append(_indent(4, "pip install build"))
        lines.append(_indent(4, "python -m build"))
        lines.append(_yaml_list_item(2, "name: Upload dist artifact"))
        lines.append(_indent(3, "uses: actions/upload-artifact@v4"))
        lines.append(_indent(3, "with:"))
        lines.append(_indent(4, "name: python-dist"))
        lines.append(_indent(4, "path: dist/"))
        lines.append(_indent(4, "if-no-files-found: ignore"))
        lines.append("")

    return "\n".join(lines)


def _build_html_workflow(features):
    lines = []
    lines.append("name: HTML Site CI")
    lines.append("")
    lines.append("on:")
    lines.append(_yaml_list_item(1, "push:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append(_yaml_list_item(1, "pull_request:"))
    lines.append(_indent(2, "branches: [main, master]"))
    lines.append("")
    lines.append("permissions:")
    lines.append(_indent(1, "contents: read"))
    lines.append("")
    lines.append("jobs:")
    lines.append("")

    lines.append(_indent(1, "install:"))
    lines.append(_indent(2, "runs-on: ubuntu-latest"))
    lines.append(_indent(2, "steps:"))
    lines.append(_yaml_list_item(2, "name: Checkout"))
    lines.append(_indent(3, "uses: actions/checkout@v4"))
    lines.append("")

    lines.append(_indent(1, "test:"))
    lines.append(_indent(2, "needs: install"))
    lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
    lines.append(_indent(2, "runs-on: ubuntu-latest"))
    lines.append(_indent(2, "steps:"))
    lines.append(_yaml_list_item(2, "name: Checkout"))
    lines.append(_indent(3, "uses: actions/checkout@v4"))
    lines.append(_yaml_list_item(2, "name: Setup Node.js for htmlhint"))
    lines.append(_indent(3, "uses: actions/setup-node@v4"))
    lines.append(_indent(3, "with:"))
    lines.append(_indent(4, "node-version: '20'"))
    lines.append(_yaml_list_item(2, "name: Lint HTML (best-effort)"))
    lines.append(_indent(3, "continue-on-error: true"))
    lines.append(_indent(3, "run: |"))
    lines.append(_indent(4, "npx --yes htmlhint \"./**/*.html\" || true"))
    lines.append("")

    lines.append(_indent(1, "build:"))
    lines.append(_indent(2, "needs: [install, test]"))
    lines.append(_indent(2, "if: always() && needs.install.result == 'success'"))
    lines.append(_indent(2, "runs-on: ubuntu-latest"))
    lines.append(_indent(2, "steps:"))
    lines.append(_yaml_list_item(2, "name: Checkout"))
    lines.append(_indent(3, "uses: actions/checkout@v4"))
    lines.append(_yaml_list_item(2, "name: Upload site artifact"))
    lines.append(_indent(3, "uses: actions/upload-artifact@v4"))
    lines.append(_indent(3, "with:"))
    lines.append(_indent(4, "name: static-site"))
    lines.append(_indent(4, "path: |"))
    lines.append(_indent(5, "*.html"))
    lines.append(_indent(5, "*.css"))
    lines.append(_indent(5, "*.js"))
    lines.append(_indent(5, "assets/"))
    lines.append(_indent(5, "images/"))
    lines.append(_indent(4, "if-no-files-found: ignore"))
    lines.append("")

    return "\n".join(lines)


def generate_ci_workflow(project_stack: list, workspace_files: list) -> dict:
    stack_set = set()
    if isinstance(project_stack, list):
        for s in project_stack:
            if isinstance(s, str):
                stack_set.add(s.lower())

    features = _detect_features(stack_set, workspace_files)

    has_node = 'node' in stack_set
    has_python = 'python' in stack_set
    has_html_only = 'html' in stack_set and not has_node and not has_python

    if has_node:
        yaml_string = _build_node_workflow(features)
    elif has_python:
        yaml_string = _build_python_workflow(features)
    elif has_html_only:
        yaml_string = _build_html_workflow(features)
    else:
        yaml_string = _build_html_workflow(features)

    return {
        'path': '.github/workflows/ci.yml',
        'code': yaml_string,
    }
