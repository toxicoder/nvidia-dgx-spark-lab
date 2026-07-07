#!/usr/bin/env python3
"""Manifest exercise registry for declarative stacks.

Every tracked Kubernetes manifest, Helm template, Ansible playbook/role file,
and policy config must map to at least one validation target (kubeconform,
kustomize build, safety invariants, ansible validate, or helm chart test).

This is the declarative counterpart to line coverage for YAML/Helm/Ansible.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys

# Prefixes exercised by //ansible:validate (all_playbooks filegroup in ansible/BUILD.bazel)
_ANSIBLE_EXERCISED_PREFIXES = (
    "ansible/playbooks/",
    "ansible/roles/",
    "ansible/cloud-init/",
    "ansible/files/",
)
_ANSIBLE_EXERCISED_EXACT = frozenset(
    {
        "ansible/ansible.cfg",
        "ansible/inventory/group_vars/all.yml",
        "ansible/inventory/hosts.ini.example",
    }
)

# Exercised by //tests:safety_invariants
_CONFIG_EXERCISED = frozenset(
    {
        "config/resource-policy.yaml",
        "config/resource-policy.json",
        "config/nemotron-catalog.yaml",
        "config/open-webui-policy.yaml",
        "config/open-webui-policy.json",
        "config/sso-policy.yaml",
        "config/lab-domains.yaml",
        "config/lab-domains.json",
        "config/monitoring-probes.yaml",
        "config/grafana/dashboards/00-lab-overview.json",
        "config/grafana/dashboards/01-dgx-nodes.json",
        "config/grafana/dashboards/02-gpu-cluster.json",
        "config/grafana/dashboards/03-kubernetes.json",
        "config/grafana/dashboards/04-inference.json",
        "config/grafana/dashboards/05-platform-services.json",
        "config/grafana/dashboards/06-dev-agent-stack.json",
        "config/grafana/dashboards/07-storage-network.json",
    }
)

# Exercised by //tests:safety_invariants (MCP policy + k8s tree)
_MCP_CONFIG_EXERCISED = frozenset(
    {
        "mcp/config/mcp-policy.json",
        "mcp/config/mcp-policy.yaml",
        "mcp/config/searxng/settings.yml",
    }
)

# Exercised by //helm:chart_test
_HELM_TEMPLATE_PREFIX = "helm/lab-dashboard/templates/"


def _repo_root() -> pathlib.Path:
    """Resolve the repository root for Bazel and standalone invocations.

    Returns:
        Absolute path to the workspace root.
    """
    if env := os.environ.get("BUILD_WORKSPACE_DIRECTORY"):
        return pathlib.Path(env)
    return pathlib.Path(__file__).resolve().parent.parent


def _tracked(root: pathlib.Path, prefix: str) -> list[str]:
    """List git-tracked paths under a repository prefix.

    Args:
        root: Repository root used as the git working directory.
        prefix: Path prefix passed to ``git ls-files``.

    Returns:
        Sorted list of relative POSIX paths tracked by git under ``prefix``.

    Raises:
        subprocess.CalledProcessError: If ``git ls-files`` fails.
    """
    out = subprocess.check_output(
        ["git", "ls-files", "--", prefix],
        cwd=root,
        text=True,
    )
    return [line.strip() for line in out.splitlines() if line.strip()]


def _is_yaml(path: str) -> bool:
    """Return whether a path looks like a YAML or Helm template file.

    Args:
        path: Repository-relative file path.

    Returns:
        True when the path ends with a YAML or template extension.
    """
    return path.endswith((".yaml", ".yml", ".tpl"))


def _k8s_find_paths(root: pathlib.Path, prefixes: tuple[str, ...]) -> set[str]:
    """Return tracked-style relative paths for yaml under prefix trees.

    Args:
        root: Repository root used to relativize discovered paths.
        prefixes: Directory prefixes to search with ``find``.

    Returns:
        Set of repository-relative POSIX paths to YAML files.

    Raises:
        subprocess.CalledProcessError: If ``find`` fails.
    """
    found: set[str] = set()
    for prefix in prefixes:
        find_out = subprocess.check_output(
            [
                "find",
                str(root / prefix),
                "(",
                "-name",
                "*.yaml",
                "-o",
                "-name",
                "*.yml",
                ")",
            ],
            text=True,
        )
        for line in find_out.splitlines():
            if not line.strip():
                continue
            found.add(pathlib.Path(line).resolve().relative_to(root.resolve()).as_posix())
    return found


def _check_k8s_tree(
    root: pathlib.Path,
    prefix: str,
    find_prefixes: tuple[str, ...],
    errors: list[str],
) -> None:
    """Verify all ``prefix/**/*.yaml`` are exercised by lints/run_kubeconform.sh.

    Args:
        root: Repository root.
        prefix: Git path prefix for tracked Kubernetes manifests.
        find_prefixes: Prefix trees used by the kubeconform find pattern.
        errors: Mutable list to append uncovered manifest paths into.
    """
    k8s_files = [p for p in _tracked(root, prefix) if _is_yaml(p)]
    if not k8s_files:
        return
    found = _k8s_find_paths(root, find_prefixes)
    for path in k8s_files:
        if path not in found:
            errors.append(f"{path}: not matched by kubeconform find pattern")


def _check_k8s(root: pathlib.Path, errors: list[str]) -> None:
    """Check coverage for core and MCP Kubernetes manifest trees.

    Args:
        root: Repository root.
        errors: Mutable list to append uncovered manifest paths into.
    """
    _check_k8s_tree(root, "k8s/", ("k8s",), errors)
    _check_k8s_tree(root, "mcp/k8s/", ("mcp/k8s",), errors)


def _check_ansible(root: pathlib.Path, errors: list[str]) -> None:
    """Verify tracked Ansible YAML is covered by ``//ansible:validate``.

    Args:
        root: Repository root.
        errors: Mutable list to append uncovered Ansible paths into.
    """
    for path in _tracked(root, "ansible/"):
        if not _is_yaml(path):
            continue
        if path.endswith(".example"):
            continue
        if path in _ANSIBLE_EXERCISED_EXACT:
            continue
        if path.startswith(_ANSIBLE_EXERCISED_PREFIXES):
            continue
        errors.append(f"{path}: not covered by //ansible:validate (all_playbooks)")


def _check_config(root: pathlib.Path, errors: list[str]) -> None:
    """Verify config and MCP policy files are exercised by safety invariants.

    Args:
        root: Repository root.
        errors: Mutable list to append uncovered or missing config paths into.
    """
    for path in sorted(_CONFIG_EXERCISED):
        if not (root / path).is_file():
            errors.append(f"{path}: missing (expected //tests:safety_invariants)")
    extra = [
        p
        for p in _tracked(root, "config/")
        if _is_yaml(p) or p.endswith(".json")
    ]
    for path in extra:
        if path not in _CONFIG_EXERCISED:
            errors.append(f"{path}: add to safety_invariants or manifest registry")

    for path in sorted(_MCP_CONFIG_EXERCISED):
        if not (root / path).is_file():
            errors.append(f"{path}: missing (expected //tests:safety_invariants)")
    mcp_extra = [p for p in _tracked(root, "mcp/config/") if _is_yaml(p)]
    for path in mcp_extra:
        if path.endswith(".example") or "/clients/" in path:
            continue
        if path not in _MCP_CONFIG_EXERCISED:
            errors.append(f"{path}: add to safety_invariants or manifest registry")


def _check_helm(root: pathlib.Path, errors: list[str]) -> None:
    """Verify Helm chart templates are present for ``//helm:chart_test``.

    Args:
        root: Repository root.
        errors: Mutable list to append missing Helm assets into.
    """
    templates = [p for p in _tracked(root, _HELM_TEMPLATE_PREFIX) if _is_yaml(p)]
    if not templates:
        errors.append(f"{_HELM_TEMPLATE_PREFIX}: no templates (//helm:chart_test)")
        return
    chart = root / "helm/lab-dashboard/Chart.yaml"
    if not chart.is_file():
        errors.append("helm/lab-dashboard/Chart.yaml: missing")


def main() -> int:
    """Run manifest exercise registry checks across declarative stacks.

    Returns:
        ``0`` when every tracked declarative file maps to a validation target,
        otherwise ``1``.
    """
    root = _repo_root()
    errors: list[str] = []
    _check_k8s(root, errors)
    _check_ansible(root, errors)
    _check_config(root, errors)
    _check_helm(root, errors)
    if errors:
        print("manifest_coverage: uncovered declarative files:", file=sys.stderr)
        for msg in errors:
            print(f"  {msg}", file=sys.stderr)
        return 1
    print("manifest_coverage: 100% declarative manifest exercise registry")
    return 0


if __name__ == "__main__":
    sys.exit(main())