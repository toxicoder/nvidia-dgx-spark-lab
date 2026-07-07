# Hermes Agent (Docker)

Run [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/docker) on the Spark K3s node, wired to lab Nemotron/Qwen inference and the MCP Agent Toolkit.

## Quick start

```bash
# Prerequisites
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes

# Deploy Hermes (gateway :8642, dashboard :9119)
bazelisk run //scripts:run-utility -- hermes-stack start hermes-lab --confirm yes
bazelisk run //scripts:run-utility -- hermes-stack status
```

Or via `manage.sh`:

```bash
./scripts/manage.sh start-hermes
./scripts/manage.sh stop-hermes
```

## Layout

```
hermes/
├── docker-compose.yaml   # host network, gateway + dashboard
├── config/
│   ├── hermes-policy.yaml
│   ├── config.yaml.example
│   ├── env.example
│   └── SOUL.md.example
├── profiles/
│   └── workspace-dev/    # Coder/Kasm coding assistant distribution
└── data/                 # gitignored — bind-mount → /opt/data
```

## Stacks

| Stack ID | MCP preset | Extra MCP servers |
|----------|------------|-------------------|
| `hermes-lab` | `mcp-agent-toolkit` | searxng, fetch, memory, context7 (host localhost) |
| `hermes-lab-full` | `mcp-agent-toolkit-full` | + qdrant, firecrawl |
| `hermes-workspace-dev` | `mcp-agent-toolkit` | in-cluster DNS; Coder sidecar / Kasm desktop |

Host stacks reach inference via `kubectl port-forward` to `127.0.0.1:8000`. Workspace stacks use in-cluster service DNS.

**Workspace utilities:**

```bash
bazelisk run //scripts:run-utility -- workspace-hermes verify
bazelisk run //scripts:run-utility -- workspace-hermes seed /path/to/hermes-data
```

See [docs/hermes-agent.md](../docs/hermes-agent.md) for full operator guide.