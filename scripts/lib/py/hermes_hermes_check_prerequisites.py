#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_check_prerequisites``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_check_prerequisites.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path
from typing import TypedDict, cast


class _Preset(TypedDict, total=False):
    """Inference preset record from the policy ``inference_presets`` map."""

    service: str
    namespace: str


class _McpServer(TypedDict, total=False):
    """MCP server record from the policy ``mcp_servers`` map."""

    k8s_deployment: str


class _Stack(TypedDict, total=False):
    """Hermes stack record from the policy ``stacks`` map."""

    inference_preset: str
    mcp_servers: list[str]


class _Policy(TypedDict, total=False):
    """Subset of the Hermes policy document this helper reads."""

    stacks: dict[str, _Stack]
    inference_presets: dict[str, _Preset]
    mcp_servers: dict[str, _McpServer]


def _load_yaml(path: str) -> _Policy:
    """Load the Hermes policy document.

    Args:
        path: Filesystem path of the policy YAML file.

    Returns:
        The parsed policy mapping, or an empty mapping when the file is missing
        or PyYAML cannot load it.
    """
    try:
        import yaml
        return cast(_Policy, yaml.safe_load(Path(path).read_text()) or {})
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
stack_id = sys.argv[2]
stack = policy.get("stacks", {}).get(stack_id, {})
if not stack:
    print(json.dumps({"ok": False, "error": f"unknown stack: {stack_id}"}))
    sys.exit(1)

errors: list[str] = []
preset_key = stack.get("inference_preset", "")
preset = policy.get("inference_presets", {}).get(preset_key, {})
svc = preset.get("service", "")
ns = preset.get("namespace", "ai-inference")

if svc:
    try:
        out = subprocess.check_output(
            ["kubectl", "get", "pods", "-n", ns, "-l", f"app={svc}",
             "-o", "jsonpath={.items[?(@.status.phase=='Running')].metadata.name}"],
            text=True,
        ).strip()
        if not out:
            errors.append(f"Inference service {svc} has no Running pods in {ns}")
    except subprocess.CalledProcessError as exc:
        errors.append(f"Failed to check inference pods for {svc}: {exc}")

mcp_ns = "agent-tools"
mcp_defs = policy.get("mcp_servers", {})
for name in stack.get("mcp_servers", []):
    dep = mcp_defs.get(name, {}).get("k8s_deployment", "")
    if not dep:
        continue
    try:
        ready = subprocess.check_output(
            ["kubectl", "get", "deployment", dep, "-n", mcp_ns,
             "-o", "jsonpath={.status.readyReplicas}"],
            text=True,
        ).strip()
        if not ready or ready == "0":
            errors.append(f"MCP deployment {dep} not ready in {mcp_ns}")
    except subprocess.CalledProcessError:
        errors.append(f"MCP deployment {dep} not found in {mcp_ns}")

print(json.dumps({"ok": len(errors) == 0, "errors": errors, "inference_service": svc, "namespace": ns}))
if errors:
    sys.exit(1)
