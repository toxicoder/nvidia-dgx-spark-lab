#!/usr/bin/env python3
"""Documentation coverage gate for stack-appropriate source comments.

Enforces docs/project-conventions.md §11 across shell, Python, YAML, BUILD.bazel,
and dashboard TypeScript exports. Fails fast with a concise violation list.
"""

from __future__ import annotations

import ast
import os
import pathlib
import re
import subprocess
import sys

_SHELL_FUNCTION_RE = re.compile(r"^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)\s*\{")
_SHELL_AT_FUNCTION_RE = re.compile(r"^#\s*@function\s+(\S+)")
_SHELL_AT_COMMAND_RE = re.compile(r"^#\s*@command\s+(\S+)")
_MANAGE_CASE_RE = re.compile(r"^  ([a-z0-9][a-z0-9._-]*)(?:\|[^)]+)?\)\s*$")
_TS_FUNCTION_EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)"
)
_TS_CLASS_EXPORT_RE = re.compile(r"^export\s+(?:default\s+)?class\s+(\w+)")
_TS_CONST_EXPORT_RE = re.compile(r"^export\s+const\s+(\w+)")
_SHELL_FILE_HEADER_RE = re.compile(r"^#\s*##\s+\S", re.MULTILINE)
# ConfigMap data keys that embed shell/python as multi-line YAML (anti-pattern).
_INLINE_SCRIPT_KEY_RE = re.compile(
    r"^[ \t]+([A-Za-z0-9_.@-]+\.(?:sh|bash|py|py3)):[ \t]*\|[ \t]*$",
    re.MULTILINE,
)
# MkDocs nav entries pointing at markdown under docs/ (not URLs).
_MKDOCS_NAV_MD_RE = re.compile(
    r"(?m)^[ \t]*-[ \t]+[^:\n]+:[ \t]+([A-Za-z0-9_./-]+\.md)\s*$"
)
# Quoted or bare .md paths listed in docs/BUILD.bazel data arrays.
_BAZEL_MD_STRING_RE = re.compile(r'["\']([A-Za-z0-9_./-]+\.md)["\']')
_YAML_HEADER_FIELDS = (
    "Purpose:",
    "Source of truth:",
    "Regenerate:",
    "Safety:",
)
_YAML_EXCLUDE_SUFFIXES = (
    "/generated/",
    ".pre-commit-config.yaml",
    "mkdocs.yml",
    ".yamllint.yml",
    "docker-compose.yml",
)
# Workload / MCP shell that must use real files (not ConfigMap embeds) and
# carry the same # ## / # @function documentation as scripts/utilities.
# Excludes k8s/dev/images/* Docker entrypoints (separate packaging).
_EXTRA_SHELL_PREFIXES = (
    "k8s/workloads/",
    "mcp/",
)
_DASHBOARD_TS_EXCLUDE = (
    "dashboard/components/ui/",
    "dashboard/lib/mocks/",
    "dashboard/lib/types/",
    "dashboard/lib/db/schema.ts",
    "dashboard/lib/db/auth-schema.ts",
    "dashboard/app/api/",
    "dashboard/__tests__/",
    "dashboard/node_modules/",
    "dashboard/vitest.setup.ts",
    "dashboard/next.config.ts",
    "dashboard/playwright.config.ts",
    "dashboard/vitest.config.ts",
    "dashboard/drizzle.config.ts",
)


def _repo_root() -> pathlib.Path:
    """Resolve the repository root for Bazel and standalone invocations.

    Returns:
        Absolute path to the workspace root.
    """
    if env := os.environ.get("BUILD_WORKSPACE_DIRECTORY"):
        return pathlib.Path(env)
    return pathlib.Path(__file__).resolve().parent.parent


def _tracked(root: pathlib.Path, prefix: str) -> list[str]:
    """List git-tracked paths under a prefix.

    Args:
        root: Repository root.
        prefix: Path prefix relative to root.

    Returns:
        Sorted relative paths tracked by git.
    """
    result = subprocess.run(
        ["git", "ls-files", prefix],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    return sorted(line.strip() for line in result.stdout.splitlines() if line.strip())


def _check_manage_commands(root: pathlib.Path) -> list[str]:
    """Verify # @command markers for every manage.sh dispatch target.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    path = root / "scripts/manage.sh"
    if not path.is_file():
        return ["scripts/manage.sh: missing manage.sh"]

    lines = path.read_text(encoding="utf-8").splitlines()
    marked = {
        match.group(1)
        for line in lines
        if (match := _SHELL_AT_COMMAND_RE.match(line.strip()))
    }

    in_case = False
    case_cmds: set[str] = set()
    for line in lines:
        stripped = line.strip()
        if stripped == 'case "${1:-help}" in':
            in_case = True
            continue
        if in_case and stripped == "esac":
            break
        if not in_case:
            continue
        if match := _MANAGE_CASE_RE.match(stripped):
            primary = match.group(1)
            if primary not in {"help", "--help", "-h", "*"}:
                case_cmds.add(primary)

    violations: list[str] = []
    for cmd in sorted(case_cmds):
        if cmd not in marked:
            violations.append(f"scripts/manage.sh: command '{cmd}' missing # @command marker")
    return violations


def _shell_header_targets(root: pathlib.Path) -> list[str]:
    """Return shell paths that require a file-level ``# ##`` header.

    Args:
        root: Repository root.

    Returns:
        Sorted relative paths ending in ``.sh``.
    """
    targets = ["scripts/manage.sh", "scripts/validate.sh"]
    targets.extend(_tracked(root, "scripts/lib"))
    targets.extend(_tracked(root, "scripts/utilities"))
    for prefix in _EXTRA_SHELL_PREFIXES:
        targets.extend(_tracked(root, prefix))
    return sorted({rel for rel in targets if rel.endswith(".sh")})


def _shell_function_targets(root: pathlib.Path) -> list[str]:
    """Return shell paths that require ``# @function`` on every function.

    Args:
        root: Repository root.

    Returns:
        Sorted relative paths ending in ``.sh``.
    """
    targets: list[str] = []
    targets.extend(_tracked(root, "scripts/lib"))
    targets.extend(_tracked(root, "scripts/utilities"))
    for prefix in _EXTRA_SHELL_PREFIXES:
        targets.extend(_tracked(root, prefix))
    return sorted({rel for rel in targets if rel.endswith(".sh")})


def _check_shell_file_headers(root: pathlib.Path) -> list[str]:
    """Verify file-level # ## headers on shell scripts in gated paths.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    for rel in _shell_header_targets(root):
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if not _SHELL_FILE_HEADER_RE.search(text):
            violations.append(f"{rel}: missing file-level # ## header")
    return violations


def _check_shell_functions(root: pathlib.Path) -> list[str]:
    """Verify # @function markers for every function in gated shell paths.

    Covers ``scripts/lib``, ``scripts/utilities``, and workload shell under
    ``k8s/workloads/`` / ``mcp/``. Does not gate ``manage.sh`` / ``validate.sh``
    internals (those use ``# @command`` for the public CLI surface).

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    for rel in _shell_function_targets(root):
        path = root / rel
        if not path.is_file():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        marked = {
            match.group(1)
            for line in lines
            if (match := _SHELL_AT_FUNCTION_RE.match(line.strip()))
        }
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if match := _SHELL_FUNCTION_RE.match(stripped):
                name = match.group(1)
                if name in marked:
                    continue
                # Allow commit_group and other helpers documented inline above orphan rebuild.
                context = "\n".join(lines[max(0, idx - 6) : idx])
                if f"# @function {name}" in context:
                    continue
                violations.append(f"{rel}: function '{name}' missing # @function marker")
    return violations


def find_inline_script_keys(text: str) -> list[str]:
    """Return ConfigMap data keys that embed scripts via YAML multi-line blocks.

    Args:
        text: YAML file contents.

    Returns:
        Sorted unique keys like ``install-comfy.sh``.
    """
    return sorted(set(_INLINE_SCRIPT_KEY_RE.findall(text)))


def _check_no_inline_configmap_scripts(root: pathlib.Path) -> list[str]:
    """Ban embedded shell/python bodies in ConfigMap YAML under k8s/ and mcp/.

    Scripts must live as real files and be wired with kustomize
    ``configMapGenerator`` ``files:`` (see mcp/k8s and comfy-base).

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    for prefix in ("k8s/", "mcp/"):
        for rel in _tracked(root, prefix):
            if not (rel.endswith(".yaml") or rel.endswith(".yml")):
                continue
            if any(ex in rel for ex in _YAML_EXCLUDE_SUFFIXES):
                continue
            keys = find_inline_script_keys((root / rel).read_text(encoding="utf-8"))
            for key in keys:
                violations.append(
                    f"{rel}: inline script '{key}' — use a real file + "
                    "configMapGenerator files: (not ConfigMap data: |)"
                )
    return violations


def mkdocs_nav_md_pages(mkdocs_text: str) -> list[str]:
    """Extract relative markdown paths from an MkDocs nav tree.

    Args:
        mkdocs_text: Contents of ``mkdocs.yml``.

    Returns:
        Sorted unique paths as written in nav (e.g. ``visual-generative-ai.md``).
    """
    pages = {
        match.group(1)
        for match in _MKDOCS_NAV_MD_RE.finditer(mkdocs_text)
        if not match.group(1).startswith("http")
    }
    return sorted(pages)


def bazel_listed_md_files(build_text: str) -> set[str]:
    """Collect ``*.md`` string literals from a Bazel BUILD file.

    Args:
        build_text: Contents of ``docs/BUILD.bazel``.

    Returns:
        Set of relative markdown basenames/paths listed in the BUILD file.
    """
    return set(_BAZEL_MD_STRING_RE.findall(build_text))


def _check_mkdocs_pages_in_docs_bazel(root: pathlib.Path) -> list[str]:
    """Require every MkDocs nav page under docs/ to be listed in docs/BUILD.bazel.

    Prevents strict mkdocs failures when a page is added to ``mkdocs.yml`` but
    omitted from Bazel ``data`` / ``_RENDER_TEST_DATA`` (runfiles).

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    mkdocs_path = root / "mkdocs.yml"
    build_path = root / "docs" / "BUILD.bazel"
    if not mkdocs_path.is_file() or not build_path.is_file():
        return ["mkdocs.yml or docs/BUILD.bazel missing"]

    nav_pages = mkdocs_nav_md_pages(mkdocs_path.read_text(encoding="utf-8"))
    build_text = build_path.read_text(encoding="utf-8")
    listed = bazel_listed_md_files(build_text)
    # Nav uses bare names (index.md) or generated/... paths; Bazel lists basenames
    # under docs/ and sometimes "generated" as a tree. Accept basename match.
    listed_basenames = {pathlib.Path(p).name for p in listed}
    listed_basenames.update(listed)
    has_generated_tree = '"generated"' in build_text or "'generated'" in build_text

    violations: list[str] = []
    for page in nav_pages:
        base = pathlib.Path(page).name
        # Generated reference trees are covered by "generated" data entry.
        if page.startswith("generated/"):
            if not has_generated_tree:
                violations.append(
                    f"mkdocs nav '{page}': docs/BUILD.bazel missing generated data"
                )
            continue
        if page not in listed and base not in listed_basenames:
            violations.append(
                f"mkdocs nav '{page}': add \"{base}\" to docs/BUILD.bazel "
                "(//docs:serve, //docs:docs, and _RENDER_TEST_DATA)"
            )
    return violations


def _check_python_docstrings(root: pathlib.Path) -> list[str]:
    """Verify module and public function docstrings on production Python files.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    skip_dirs = {".venv-docs", "site", "node_modules", "bazel-bin", "bazel-out"}
    for path in sorted(root.rglob("*.py")):
        if any(part in skip_dirs for part in path.parts):
            continue
        if path.name.startswith("test_") and "tests" not in path.parts and "docs" not in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        if rel.startswith("tests/doc_coverage.py"):
            continue
        try:
            rel_path = path.relative_to(root)
            subprocess.run(
                ["git", "ls-files", "--error-unmatch", rel],
                cwd=root,
                capture_output=True,
                check=True,
            )
        except subprocess.CalledProcessError:
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        if not ast.get_docstring(tree):
            violations.append(f"{rel}: missing module docstring")

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name.startswith("_"):
                    continue
                if not ast.get_docstring(node):
                    violations.append(f"{rel}: function '{node.name}' missing docstring")
            elif isinstance(node, ast.ClassDef):
                if not ast.get_docstring(node):
                    violations.append(f"{rel}: class '{node.name}' missing docstring")
    return violations


def _check_yaml_headers(root: pathlib.Path) -> list[str]:
    """Verify full YAML comment headers on tracked operational YAML.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    prefixes = ("k8s/", "mcp/", "config/", "ansible/", "helm/", "hermes/")
    for prefix in prefixes:
        for rel in _tracked(root, prefix):
            if not (rel.endswith(".yaml") or rel.endswith(".yml")):
                continue
            if any(ex in rel for ex in _YAML_EXCLUDE_SUFFIXES):
                continue
            head = (root / rel).read_text(encoding="utf-8")[:800]
            for field in _YAML_HEADER_FIELDS:
                if f"# {field}" not in head:
                    violations.append(f"{rel}: missing # {field} header")
                    break
    return violations


def _check_build_bazel(root: pathlib.Path) -> list[str]:
    """Verify Package purpose docstrings on all BUILD.bazel files.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    for path in sorted(root.rglob("BUILD.bazel")):
        if "bazel-" in str(path) or "node_modules" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        try:
            subprocess.run(
                ["git", "ls-files", "--error-unmatch", rel],
                cwd=root,
                capture_output=True,
                check=True,
            )
        except subprocess.CalledProcessError:
            continue
        text = path.read_text(encoding="utf-8")
        if "Package purpose:" not in text:
            violations.append(f"{rel}: missing Package purpose docstring")
    return violations


def _has_jsdoc_before(lines: list[str], export_line: int) -> bool:
    """Return True when a JSDoc or block comment precedes an export.

    Args:
        lines: File lines.
        export_line: Zero-based index of the export line.

    Returns:
        Whether documentation precedes the export.
    """
    for idx in range(export_line - 1, max(-1, export_line - 12), -1):
        stripped = lines[idx].strip()
        if stripped.startswith("/**") or stripped.startswith("*") or stripped.startswith("*/"):
            return True
        if stripped and not stripped.startswith("//"):
            break
    return False


def _dashboard_ts_in_scope(rel: str) -> bool:
    """Return True when a dashboard TypeScript path is in the doc-coverage gate scope."""
    if not (rel.endswith(".ts") or rel.endswith(".tsx")):
        return False
    if any(ex in rel for ex in _DASHBOARD_TS_EXCLUDE):
        return False
    if ".test." in rel or "/__tests__/" in rel or "/tests/visual/" in rel:
        return False
    return rel.startswith(
        ("dashboard/lib/", "dashboard/actions/", "dashboard/components/")
    )


def _check_dashboard_ts(root: pathlib.Path) -> list[str]:
    """Verify JSDoc on exported symbols in dashboard production TypeScript.

    Args:
        root: Repository root.

    Returns:
        Violation messages.
    """
    violations: list[str] = []
    for rel in _tracked(root, "dashboard"):
        if not _dashboard_ts_in_scope(rel):
            continue
        path = root / rel
        lines = path.read_text(encoding="utf-8").splitlines()
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped.startswith("export "):
                continue
            match = (
                _TS_FUNCTION_EXPORT_RE.match(stripped)
                or _TS_CLASS_EXPORT_RE.match(stripped)
                or _TS_CONST_EXPORT_RE.match(stripped)
            )
            if not match:
                continue
            name = match.group(1)
            if not _has_jsdoc_before(lines, idx):
                violations.append(f"{rel}: export '{name}' missing JSDoc")
    return violations


def main() -> int:
    """Run all documentation coverage checks.

    Returns:
        Exit code 0 on success, 1 when violations are found.
    """
    root = _repo_root()
    checks = [
        ("manage.sh @command", _check_manage_commands),
        ("shell # ## headers", _check_shell_file_headers),
        ("shell @function", _check_shell_functions),
        ("python docstrings", _check_python_docstrings),
        ("yaml Purpose headers", _check_yaml_headers),
        ("no inline ConfigMap scripts", _check_no_inline_configmap_scripts),
        ("mkdocs pages in docs/BUILD.bazel", _check_mkdocs_pages_in_docs_bazel),
        ("BUILD.bazel Package purpose", _check_build_bazel),
        ("dashboard export JSDoc", _check_dashboard_ts),
    ]

    all_violations: list[str] = []
    for label, fn in checks:
        found = fn(root)
        if found:
            print(f"doc_coverage: {label} — {len(found)} violation(s)", file=sys.stderr)
            all_violations.extend(found)

    if all_violations:
        print("doc_coverage: FAILED", file=sys.stderr)
        for item in all_violations[:50]:
            print(f"  - {item}", file=sys.stderr)
        if len(all_violations) > 50:
            print(f"  ... and {len(all_violations) - 50} more", file=sys.stderr)
        return 1

    print("doc_coverage: all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())