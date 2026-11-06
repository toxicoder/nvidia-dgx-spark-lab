#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/hermes.sh`` (``hermes_render_config``).

Invoked by shell as: ``python3 scripts/lib/py/hermes_hermes_render_config.py [args...]``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import TypedDict, cast


class _Preset(TypedDict, total=False):
    """Inference preset record from the policy ``inference_presets`` map."""

    service: str
    namespace: str
    model: str
    context_length: int


class _McpServer(TypedDict, total=False):
    """MCP server record from a policy ``mcp_servers`` map."""

    url: str


class _UrlMode(TypedDict, total=False):
    """URL mode record from the policy ``url_modes`` map."""

    inference_base_url_template: str
    mcp_servers: dict[str, _McpServer]


class _Stack(TypedDict, total=False):
    """Hermes stack record from the policy ``stacks`` map."""

    inference_preset: str
    mcp_servers: list[str]
    mcp_url_mode: str


class _Policy(TypedDict, total=False):
    """Subset of the Hermes policy document this helper reads."""

    stacks: dict[str, _Stack]
    inference_presets: dict[str, _Preset]
    url_modes: dict[str, _UrlMode]
    mcp_servers: dict[str, _McpServer]
    ports: dict[str, int]


class _ModelConfig(TypedDict, total=False):
    """``model`` block of the rendered Hermes ``config.yaml``."""

    provider: str
    default: str
    api_key: str
    base_url: str
    context_length: int


class _McpClient(TypedDict, total=False):
    """One ``mcp_servers`` entry of the rendered Hermes ``config.yaml``."""

    url: str
    tools: dict[str, bool]


class _HermesConfig(TypedDict, total=False):
    """Subset of the Hermes ``config.yaml`` document this helper writes."""

    model: _ModelConfig
    mcp_servers: dict[str, _McpClient]


def _load_yaml(path: str) -> object:
    """Load a YAML document.

    The result stays ``object`` because this helper reads two different
    documents (policy and ``config.yaml``) with it; each caller casts the
    document it asked for.

    Args:
        path: Filesystem path of the YAML file.

    Returns:
        The parsed document, or an empty mapping when the file is missing or
        PyYAML cannot load it.
    """
    try:
        import yaml
        return yaml.safe_load(Path(path).read_text()) or {}
    except Exception:
        return {}

policy = cast(_Policy, _load_yaml(sys.argv[1]))
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

cfg = cast(_HermesConfig, _load_yaml(str(config_path)))
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

mcp_servers: dict[str, _McpClient] = {}
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
