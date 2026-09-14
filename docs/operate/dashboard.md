---
title: Dashboard operator journey
description: Human path through the lab portal panels — capacity gate, inference, storage, secrets, workspaces — and docker.sock blast radius.
tags: [dashboard, operate, safety]
---

# Dashboard operator journey

**What's on this page**

- What each panel is for (not the TypeDoc API)
- Capacity gate and heavy confirm
- Storage tree, secrets vault, workspaces
- Blast radius of host mounts

**What this enables**

- Using the portal the same way `manage.sh` gates starts
- Knowing when to drop to kubectl / `manage.sh` instead

--8<-- "docs/includes/cluster-config.md"

Generated API: [Dashboard API](../generated/dashboard-api/README.md). Chart: `helm/lab-dashboard/` (NodePort **32082** by default).

```bash
bazelisk run //:manage -- urls
# Dashboard: http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}
```

## Panels

| Panel | Operator job | Watch for |
| --- | --- | --- |
| **Resource Guard / Resources** | GPU/CPU/memory vs allocatable (refresh ~30s) | Headroom below 24Gi / 15% |
| **Inference** | Start/stop models with the same gates as `manage.sh` | Heavy models require typing `yes` |
| **Capacity gate dialog** | Suggests stopping Coder/Kasm or lighter Jobs | Do not force on a remote node |
| **Tasks** | Docker containers / Ollama list (host docker.sock) | Destructive stop/delete confirms |
| **Storage** | Treemap of `/mnt/models` (allow-listed paths) | Bulk delete is permanent |
| **Machine State** | nvidia-smi, packages, services | Read-mostly |
| **Utilities** | Allow-listed scripts only (`ALLOWED_UTILITIES`) | Unknown names are rejected |
| **Secrets** | Encrypted vault; optional K8s sync to `dev` / `ai-inference` | Never screenshot values |
| **Workspaces** | Links/embed to Coder and Kasm | Separate from inference Jobs |
| **Nemotron / Open WebUI / Observability** | Stack status and Grafana entry | Red scrape targets |

Layout: `app/(dashboard)/page.tsx` loads all panel data in one `Promise.all`. Mutations: `actions/host-actions.ts` after `requireSession()` + Zod.

## Capacity and inference

1. Open Inference.
2. If the gate blocks, read the suggestion (stop optional_dev first).
3. Type `yes` for heavy models — same as `LAB_CONFIRM_TOKEN`.
4. Confirm with `bazelisk run //:manage -- status` if the UI and cluster disagree.

## Coder vs Kasm (from the portal)

- **Coder** — hosted VS Code, workspace pods. Daily coding against this repo.
- **Kasm** — streamed desktop/apps in the browser.

Install is Ansible (`install-dev-workspaces.yml`). Journeys: [Dev workspaces](../dev-workspaces.md).

!!! warning "docker.sock blast radius"

    The dashboard Deployment may mount the host Docker socket and `/mnt/models` so Tasks/Storage work. Anyone who can log in can stop containers and delete allow-listed files. Keep auth on; never set `AUTH_BYPASS` outside tests. SSO: [SSO](../sso.md).

## Verify

```bash
kubectl get deploy,svc -n dev
curl -fsS "http://{{SPARK0_IP}}:{{DASHBOARD_PORT}}/" -o /dev/null
```
