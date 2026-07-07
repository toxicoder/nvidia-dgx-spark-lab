---
title: Open WebUI (Agent Chat)
description: Standalone browser chat UI backed by the Hermes gateway for MCP agent orchestration.
tags: [open-webui, agents, hermes, chat, sso]
---

# Open WebUI (Agent Chat)

**What's on this page**

- Prerequisites and deploy paths for the Open WebUI Helm stack
- Hermes gateway backend wiring and SSO exposure options
- Policy configuration and operational commands

**What this enables**

- Browser chat UI backed by Hermes MCP orchestration on the lab cluster
- A polished agent surface without bypassing existing safety gates

Deploy [Open WebUI](https://github.com/open-webui/open-webui) as a polished chat surface for lab AI agents. Conversations route through the **Hermes gateway** (`:8642/v1`), so MCP tools (SearXNG, fetch, memory, Context7, etc.) are orchestrated by Hermes — not by Open WebUI directly.

## Prerequisites

Bring up the agent stack before Open WebUI:

```bash
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes
./scripts/manage.sh start-hermes
```

## Deploy (standalone)

```bash
./scripts/manage.sh start-open-webui
# or
bazelisk run //scripts:run-utility -- open-webui-stack start open-webui-lab --confirm yes
```

Stop:

```bash
./scripts/manage.sh stop-open-webui
```

Open WebUI is **not** auto-started with `start-monitoring` or `start-hermes`.

## Access

| Mode | URL |
|------|-----|
| SSO (recommended) | `https://chat.lab.local:32443` |
| NodePort bypass | `http://<spark0-ip>:32085` |

Add `chat.lab.local` to `/etc/hosts` (see [sso.md](sso.md)).

Traefik forward-auth protects the SSO route. Open WebUI trusts the `Remote-User` header from Authelia for account mapping.

## Architecture

```text
Browser → Traefik/Authelia → Open WebUI (dev namespace, Helm)
              ↓
    hermes-gateway Service (headless)
              ↓
    Endpoints → spark0:8642 (host-network Hermes)
              ↓
    Nemotron orchestrator + MCP toolkit
```

The `hermes-gateway` Endpoints IP is rendered at deploy time from the control-plane node InternalIP (`LAB_SPARK0_IP` override supported).

## Dashboard

The lab portal **Agent Chat** panel shows prerequisites, deploy/stop controls, and launch links.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Start fails: Hermes not running | `./scripts/manage.sh start-hermes` |
| Gateway not reachable from pod | Re-run `start-open-webui` to refresh Endpoints IP after node IP change |
| 401 from Hermes | Re-sync secrets: stop/start Open WebUI (reads `API_SERVER_KEY` from `hermes/data/.env`) |
| Models empty in chat | Confirm Hermes gateway: `curl -H "Authorization: Bearer $API_SERVER_KEY" http://127.0.0.1:8642/v1/models` |

## Related

- [hermes-agent.md](hermes-agent.md) — gateway and MCP wiring
- [mcp-agent-toolkit.md](mcp-agent-toolkit.md)
- [nemotron-agentic-stack.md](nemotron-agentic-stack.md)
- `config/open-webui-policy.yaml`