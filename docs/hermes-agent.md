---
title: Hermes Agent (Docker)
description: Deploy Hermes Agent on the Spark host with Nemotron/Qwen inference and the MCP Agent Toolkit.
tags: [hermes, agents, docker, mcp, nemotron]
---

# Hermes Agent (Docker)

**What's on this page**

- Host-network Docker architecture for Hermes on the Spark node
- Gateway API, dashboard, and MCP toolkit integration
- Deploy, policy, and workspace dev profile workflows

**What this enables**

- Persistent agent gateway on the host with lab inference and MCP reachability
- Open WebUI and workspace dev flows through a single OpenAI-compatible API

Run [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/docker) on the Spark K3s node as a persistent gateway, reusing lab inference and MCP services.

## Architecture

Hermes runs in Docker with **host networking** so it can reach:

- **Inference** — `kubectl port-forward` to `127.0.0.1:8000` (managed by `hermes-stack`)
- **MCP toolkit** — NodePorts `32100–32106` on localhost

```text
Spark host
  ├─ kubectl port-forward → nemotron-3-nano-omni-30b:8000
  ├─ hermes container (host network)
  │    ├─ :8642  OpenAI-compatible gateway API
  │    ├─ :9119  Web dashboard (basic auth)
  │    └─ MCP → 127.0.0.1:32100–32106
  └─ K8s agent-tools + ai-inference namespaces
```

## Prerequisites

Deploy the backing stacks first:

```bash
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes
```

For full RAG (Qdrant, Firecrawl):

```bash
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit-full --confirm yes
bazelisk run //scripts:run-utility -- hermes-stack start hermes-lab-full --confirm yes
```

## Deploy

```bash
bazelisk run //scripts:run-utility -- hermes-stack catalog
bazelisk run //scripts:run-utility -- hermes-stack start hermes-lab --confirm yes
bazelisk run //scripts:run-utility -- hermes-stack status
```

Or via `manage.sh`:

```bash
./scripts/manage.sh start-hermes
./scripts/manage.sh stop-hermes
```

On first start, `hermes-stack` seeds `hermes/data/` from templates and generates `API_SERVER_KEY` and dashboard auth secrets if missing.

## Access

| Surface | URL | Auth |
|---------|-----|------|
| **Open WebUI (preferred chat)** | `https://chat.lab.local:32443` | SSO via Traefik (see [open-webui.md](open-webui.md)) |
| Hermes dashboard | `http://<node-ip>:9119` | Basic auth (`hermes/data/.env`) |
| Gateway API | `http://<node-ip>:8642/v1` | `Authorization: Bearer $API_SERVER_KEY` |
| Inference (local) | `http://127.0.0.1:8000/v1` | None (port-forward only) |

Deploy Open WebUI after Hermes is running:

```bash
./scripts/manage.sh start-open-webui
```

Retrieve credentials:

```bash
grep -E '^(API_SERVER_KEY|HERMES_DASHBOARD_BASIC_AUTH_)' hermes/data/.env
```

## MCP integration

Hermes connects to lab MCP servers over HTTP/SSE. Tools are registered with the `mcp_<server>_<tool>` prefix, for example:

- `mcp_lab_searxng_*` — private web search
- `mcp_lab_fetch_*` — URL fetch
- `mcp_lab_context7_*` — cached documentation
- `mcp_lab_memory_*` — agent memory store

Configuration is rendered into `hermes/data/config.yaml` from [`hermes/config/hermes-policy.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/hermes/config/hermes-policy.yaml).

## Verify connectivity

```bash
# Inference (port-forward)
curl -s http://127.0.0.1:8000/v1/models | head

# Hermes gateway
source hermes/data/.env
curl -s http://127.0.0.1:8642/v1/models -H "Authorization: Bearer $API_SERVER_KEY"

# MCP SearXNG
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:32100/sse

# Container logs
docker logs -f hermes
```

## Stacks

| Stack ID | Nemotron preset | MCP preset | Extra MCP |
|----------|-----------------|------------|-----------|
| `hermes-lab` | `nemotron-agentic-spark-1` | `mcp-agent-toolkit` | searxng, fetch, memory, context7 |
| `hermes-lab-full` | `nemotron-agentic-spark-1` | `mcp-agent-toolkit-full` | + qdrant, firecrawl |
| `hermes-workspace-dev` | `nemotron-agentic-spark-1` | `mcp-agent-toolkit` | in-cluster URLs; Coder/Kasm workspaces |

## Workspace dev agent (Coder + Kasm)

The host `hermes-lab` stack is a **persistent lab operator**. Coder and Kasm workspaces use a separate **`workspace-dev`** profile for coding assistance:

- **Profile:** [`hermes/profiles/workspace-dev/`](https://github.com/toxicoder/nvidia-dgx-spark-lab/tree/main/hermes/profiles/workspace-dev) (Hermes [profile distribution](https://hermes-agent.nousresearch.com/docs/user-guide/profile-distributions))
- **Stack ID:** `hermes-workspace-dev` in [`hermes-policy.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/hermes/config/hermes-policy.yaml)
- **Networking:** `mcp_url_mode: in_cluster` — inference and MCP via cluster DNS, not host port-forward
- **Terminal:** `backend: local` — commands run in the workspace where you edit code
- **Memory:** persistent cross-session memory disabled (unlike a personal assistant)

**Coder:** Hermes runs as a **sidecar** in each workspace pod (`k8s/dev/templates/coder-spark-lab/`). Dashboard at `http://127.0.0.1:9119` inside the workspace.

**Kasm:** Custom desktop image `spark-lab-kasm-desktop:1.19.0` autostarts the gateway on session launch.

```bash
bazelisk run //scripts:run-utility -- workspace-hermes verify
bazelisk run //scripts:run-utility -- workspace-hermes seed /tmp/hermes-ws-test
```

See [dev-workspaces.md](dev-workspaces.md) for image build and template registration.

## Security

- Dashboard and API server require credentials (Hermes June 2026 hardening).
- MCP and inference port-forward are **not** behind Traefik SSO (same posture as MCP NodePorts).
- Do not expose `:8642` / `:9119` on untrusted networks without VPN or firewall rules.
- Review `hermes/data/.env` before production; never commit `hermes/data/`.

## Upgrades

```bash
docker compose -f hermes/docker-compose.yaml pull
docker compose -f hermes/docker-compose.yaml up -d
```

Data in `hermes/data/` is preserved across image upgrades.

## Related

- [mcp-agent-toolkit.md](mcp-agent-toolkit.md)
- [nemotron-agentic-stack.md](nemotron-agentic-stack.md)
- [hermes/README.md](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/hermes/README.md)