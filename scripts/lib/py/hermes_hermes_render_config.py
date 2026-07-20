#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_render_config``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_render_config.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path

def _load_yaml(path):
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = _load_yaml(sys.argv[1])
config_path = Path(sys.argv[2])
stack_id = sys.argv[3]
url_mode_override = sys.argv[4] if len(sys.argv) > 4 else ""

stack = policy.get("stacks", {}).get(stack_id, {})
if not stack:
    raise SystemExit(f"Unknown Hermes stack: {stack_id}")

preset_key = stack.get("inference_preset", "")
preset = policy.get("inference_presets", {}).get(preset_key, {})
mcp_names = stack.get("mcp_servers", [])

url_mode = url_mode_override or stack.get("mcp_url_mode", "host_localhost")
mode_defs = policy.get("url_modes", {}).get(url_mode, {})
mcp_defs = mode_defs.get("mcp_servers") or policy.get("mcp_servers", {})

cfg = _load_yaml(str(config_path))
if not cfg:
    cfg = {}

model = cfg.setdefault("model", {})
model["provider"] = "custom"
model["default"] = preset.get("model", "")
model["api_key"] = "none"
if preset.get("context_length"):
    model["context_length"] = preset["context_length"]

inference_port = policy.get("ports", {}).get("inference_local", 8000)
inference_tpl = mode_defs.get(
    "inference_base_url_template",
    "http://127.0.0.1:{port}/v1",
)
if url_mode == "in_cluster":
    svc = preset.get("service", "")
    ns = preset.get("namespace", "ai-inference")
    model["base_url"] = inference_tpl.format(service=svc, namespace=ns, port=8000)
else:
    model["base_url"] = inference_tpl.format(port=inference_port)

mcp_servers = {}
for name in mcp_names:
    entry = mcp_defs.get(name, {})
    if not entry.get("url"):
        continue
    mcp_servers[name] = {
        "url": entry["url"],
        "tools": {"prompts": False, "resources": False},
    }
cfg["mcp_servers"] = mcp_servers

try:
    import yaml
    config_path.write_text(yaml.safe_dump(cfg, sort_keys=False, default_flow_style=False))
except Exception as exc:
    raise SystemExit(f"Failed to write config.yaml: {exc}") from exc
