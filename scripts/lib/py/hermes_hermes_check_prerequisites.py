#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_check_prerequisites``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_check_prerequisites.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
stack_id = sys.argv[2]
stack = policy.get("stacks", {}).get(stack_id, {})
if not stack:
    print(json.dumps({"ok": False, "error": f"unknown stack: {stack_id}"}))
    sys.exit(1)

errors = []
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
