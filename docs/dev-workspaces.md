---
title: Remote Developer Workspaces & Dashboard
description: Coder, Kasm, and the custom Spark Lab Dashboard — NodePort access, Ansible setup, auth, SQLite persistence, and safety notes for dev tooling on-cluster.
tags: [coder, kasm, dashboard, devcontainer, helm]
---

# Remote Developer Workspaces & Dashboard

**What's on this page**

- Coder, Kasm, and the custom Spark Lab Dashboard (Headlamp + Grafana + Next.js portal)
- NodePort access, Ansible quick start, and resource/safety notes
- Dashboard auth, SQLite persistence, Docker build, and K8s Secret setup

**What this enables**

- Remote browser access to dev workspaces and cluster management without local heavy setup
- A self-hosted lab portal with Tasks, Storage treemap, Machine State, and Utilities
- Documented login and persistence configuration for production-like dashboard deploys

This lab now supports running **Coder** (self-hosted VS Code + workspaces), **Kasm Workspaces** (browser desktops/apps), and a custom **improved DGX Lab Dashboard** (Headlamp + Grafana + lab portal) directly on the DGX Spark cluster.

Goal: remotely connect via browser and have everything needed to work on the lab or other projects, without local heavy setup.

## Overview

- **Coder**: Hosted VS Code IDE. Provisions workspaces as K8s pods (templates define image, resources, mounts). Clone this repo inside a workspace, run bazel/make, use local cluster tools.
- **Kasm**: Additional flexibility for containerized or desktop sessions streamed to browser.
- **Dashboard stack**:
  - **Headlamp** (CNCF): full modern K8s web UI.
  - **Grafana** (+ Prometheus/DCGM via GPU Operator): metrics, GPU util graphs, node health, inference pods.
  - **Custom Spark Lab Portal**: Self-hosted Next.js 16+ app (refactored; legacy static nginx removed 2026) featuring:
  - **Tasks** (default): Docker containers, Ollama models/services, with real stop/delete actions.
  - **Storage**: interactive treemap size viz, largest files, move/delete, duplicate finder scoped to safe paths.
  - **Machine State**: packages, running services, NVIDIA/OS identity.
  Plus links to Grafana/Headlamp and legacy inference controls.

All use explicit resource requests/limits. Dev management components use Deployments (restartPolicy handled by controller). Inference remains strict Jobs.

## Prerequisites & Exposure

- Cluster bootstrapped + GPU Operator installed.
- Helm available (playbook installs if needed).
- **Remote access**: 
  - Primary: NodePorts (default 32080 Coder, 32081 Kasm, 32082 custom dashboard, 32083 Grafana, 32084 Headlamp).
  - From control machine: `ssh -L 32080:localhost:32080 user@spark0-ip` or open firewall for trusted nets.
  - Recommended for "super easy": VPN (Tailscale etc.) + NodePort or ClusterIP.
  - **SSO (recommended):** Traefik v3 + Authelia on `https://*.lab.local:32443` — see [SSO guide](sso.md). K3s bundled Traefik stays disabled; standalone Helm Traefik is used instead.
  - **Legacy direct NodePorts:** `:32080`–`:32084` still work as SSO bypass when `SSO_BYPASS_NODEPORTS=1`.

**Important safety**: Always `manage.sh stop` before reboot. Dev components have limits to avoid impacting inference capacity.

See `ansible/inventory/group_vars/all.yml` for reference defaults (versions, ports, resources). Authoritative deploy values are in the Helm values files and `k8s/dev/dashboard/deployment.yaml`.

## Quick Start

1. From workstation with Ansible + cluster access:

```bash
ansible-playbook -i inventory/hosts.ini playbooks/install-dev-workspaces.yml
```

2. Use manage script (after KUBECONFIG set):

```bash
./scripts/manage.sh start-coder
./scripts/manage.sh start-kasm
./scripts/manage.sh start-monitoring   # grafana + headlamp + custom portal
./scripts/manage.sh status
./scripts/manage.sh stop-dev
./scripts/manage.sh help
```

3. Access:
   - Coder: http://<node-ip>:32080 (first run creates admin; set ACCESS_URL in values if needed for workspace agent comms).
   - Custom dashboard + links: http://<node-ip>:32082
   - Grafana: :32083 (default admin/admin or per values)
   - Headlamp: :32084

Inside Coder workspace template (see below): you get a full dev env with this repo, bazel, kubectl (via mounted kubeconfig or in-cluster SA), and can run `./scripts/manage.sh start-test` etc from inside the cluster.

## Ansible / Helm Details

Playbook `install-dev-workspaces.yml` follows the GPU Operator pattern:

- Ensure helm.
- Create namespaces (coder, kasm, monitoring).
- helm repo add + upgrade --install with values.
- Waits and verification.

Values examples committed under `ansible/files/` or `k8s/dev/` (copy/edit before run for production DB etc.).

In-cluster Postgres used for Coder POC (Bitnami); production use external managed Postgres and update secret.

Grafana can consume GPU metrics if DCGM exporter enabled by GPU Operator (default in recent).

## Hermes dev assistant (Coder + Kasm)

Coder and Kasm workspaces ship a **coding-focused** Hermes Agent (`workspace-dev` profile), separate from the persistent host operator (`hermes-lab` on the Spark node).

| | Host `hermes-lab` | Workspace `workspace-dev` |
|--|-------------------|---------------------------|
| Purpose | Lab operator / cluster management | Repo edits, bazel, in-workspace coding |
| Where | Docker on Spark host | Coder pod sidecar or Kasm desktop image |
| Inference | `kubectl port-forward` → localhost | In-cluster `*.ai-inference.svc.cluster.local` |
| MCP | NodePorts on host | In-cluster `*.agent-tools.svc.cluster.local` |
| Dashboard | `http://<node-ip>:9119` | `http://127.0.0.1:9119` inside the workspace |

**Prerequisites** (same as host Hermes, but no host Docker agent required):

```bash
bazelisk run //scripts:run-utility -- nemotron-stack start nemotron-agentic-spark-1 --confirm yes
bazelisk run //scripts:run-utility -- mcp-stack start mcp-agent-toolkit --confirm yes
bazelisk run //scripts:run-utility -- workspace-hermes verify
```

Profile distribution: [`hermes/profiles/workspace-dev/`](https://github.com/toxicoder/nvidia-dgx-spark-lab/tree/main/hermes/profiles/workspace-dev).

## Coder template (Hermes sidecar)

Committed template: [`k8s/dev/templates/coder-spark-lab/`](https://github.com/toxicoder/nvidia-dgx-spark-lab/tree/main/k8s/dev/templates/coder-spark-lab).

Each workspace pod runs two containers sharing a network namespace:

- **dev** — `spark-lab-coder-workspace` image (bazelisk, kubectl, helm, ansible)
- **hermes** — `nousresearch/hermes-agent:latest` gateway sidecar with per-workspace PVC

**Build workspace image** (from repo root):

```bash
docker build -t spark-lab-coder-workspace:latest -f k8s/dev/images/coder-workspace/Dockerfile .
```

**Register template in Coder:**

```bash
cd k8s/dev/templates/coder-spark-lab
coder templates create spark-lab-dev
# or: coder templates push spark-lab-dev
```

Inside a running workspace:

- Hermes dashboard: **Coder app** “Hermes Dev Assistant” or `http://127.0.0.1:9119`
- Gateway API: `http://127.0.0.1:8642/v1` (Bearer token in workspace Secret)
- MCP client config seeded to `~/.cursor/mcp.json` and `~/.vscode/mcp.json`

Workspaces land in namespace `coder-workspaces` (see [`k8s/base/namespaces-dev.yaml`](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/main/k8s/base/namespaces-dev.yaml)).

## Kasm desktop image

Build on the Spark node (where the Kasm agent pulls images):

```bash
./scripts/utilities/kasm-workspace-image.sh build
# Image tag: spark-lab-kasm-desktop:1.19.0
```

Register in **Kasm Admin → Workspaces → Add Workspace**:

- Docker Image: `spark-lab-kasm-desktop:1.19.0`
- Use an explicit tag (Kasm does not assume `latest`)

The image starts Hermes `workspace-dev` in the background on session launch. Desktop shortcuts open the dashboard (`:9119`) and Hermes CLI.

## Dashboard Details (Next.js 16)

The custom portal is a self-hosted **Next.js 16** application (`dashboard/`) with **better-auth** session protection and **Drizzle + SQLite** persistence for utility run history and preferences.

### Build and deploy

Build from the **repository root** (the image bundles `scripts/utilities/` for the Utilities panel):

```bash
docker build -t lab-dashboard:local -f dashboard/Dockerfile .
kubectl apply -f k8s/dev/dashboard/
```

Or use local compose:

```bash
docker compose -f dashboard/docker-compose.yml up --build
```

The container entrypoint applies Drizzle migrations to `DATABASE_URL` before starting the server.

### Authentication

1. Create the auth Secret (do not commit real passwords):

```bash
kubectl create secret generic lab-dashboard-auth -n dev \
  --from-literal=secret="$(openssl rand -base64 32)" \
  --from-literal=admin-email='admin@lab.local' \
  --from-literal=admin-password='change-me-on-first-login'
```

See `k8s/dev/dashboard/auth-secret.yaml.example` for the template.

2. Create the secrets vault master key (separate from auth; loss is unrecoverable):

```bash
./scripts/manage.sh secrets ensure-key
# or: kubectl create secret generic lab-dashboard-secrets -n dev \
#       --from-literal=master-key="$(openssl rand -base64 32)"
```

See `k8s/dev/dashboard/secrets-master.yaml.example`. Manage API keys and tokens in the dashboard **Secrets Vault** panel (`#secrets`); values are AES-256-GCM encrypted in SQLite and can sync to Kubernetes Secrets in `dev` or `ai-inference`.

3. Set browser-reachable URLs in `k8s/dev/dashboard/deployment.yaml`:

- `BETTER_AUTH_URL` — e.g. `http://<node-ip>:32082`
- `NEXT_PUBLIC_BETTER_AUTH_URL` — same value for client-side login

4. On first boot with an empty database, the dashboard seeds the admin user from `LAB_DASHBOARD_ADMIN_EMAIL` / `LAB_DASHBOARD_ADMIN_PASSWORD` (from the Secret).

5. Open `http://<node-ip>:32082/login` and sign in.

**Test bypass** (Vitest / Playwright only): `AUTH_BYPASS=1` or `USE_MOCKS=1`.

### SQLite volume

The deployment mounts an `emptyDir` at `/data` with:

```text
DATABASE_URL=file:/data/lab-dashboard.db
```

For durable history across pod restarts, replace `emptyDir` with a small PVC in production.

### Core features

- **Tasks** — Docker containers and Ollama models/services (stop/delete with confirmations)
- **Storage** — interactive treemap, drill-down, duplicate finder (scoped to `LAB_WHITELIST_BASES`)
- **Workspaces** — Coder and Kasm toggles with embedded iframes when running (see below)
- **Machine State** — packages, services, NVIDIA/OS identity
- **Utilities** — allow-listed `scripts/utilities/*.sh` with run history in SQLite

Headlamp and Grafana provide deeper cluster views (edit resources, explore pods, historical graphs).

### Dashboard Workspaces panel

The **Workspaces** sidebar section (`#workspaces`) embeds Coder and Kasm in-tab when running, with per-service Helm start/stop toggles so you can reclaim ~2 CPU / 4Gi per stack under tight capacity.

**Behavior:**

- **Coder | Kasm tabs** — one nav item, two workspace views
- **Switch toggle** — start (`helm upgrade --install`) or stop (`helm uninstall`) individually; stop asks for confirmation
- **Iframe embed** — loads NodePort URL when `running`; falls back to **Open in new tab** if blocked by `X-Frame-Options` or still starting
- **Status polling** — refreshes every 5s while starting/stopping (Helm wait up to ~8m)

**Environment variables** (set in `k8s/dev/dashboard/deployment.yaml` or `helm/lab-dashboard` values):

| Variable | Purpose |
|----------|---------|
| `LAB_WORKSPACE_HOST` | Hostname/IP the browser uses to reach Coder/Kasm (e.g. node IP) |
| `CODER_PORT` / `KASM_PORT` | NodePorts (default `32080` / `32081`) |
| `NEXT_PUBLIC_CODER_URL` / `NEXT_PUBLIC_KASM_URL` | Optional full URL overrides for iframe `src` |

**CLI equivalents:**

```bash
./scripts/manage.sh start-coder
./scripts/manage.sh stop-coder
./scripts/manage.sh start-kasm
./scripts/manage.sh stop-kasm
```

The dashboard utility `scripts/utilities/dev-workspaces.sh` wraps the same logic for the UI. RBAC in `k8s/dev/dashboard/rbac.yaml` grants the dashboard ServiceAccount Helm lifecycle in `coder` and `kasm` namespaces only.

**Safety:** Toggling workspaces does not touch `ai-inference` Jobs. Still run `stop-dev` / `stop` before node reboot.

See `dashboard/AGENTS.md` and `dashboard/Dockerfile` for stack details.

## Safety & Resources

- All components declare requests + limits (see group_vars and values).
- Inference unchanged: Jobs, OnFailure + backoff 1, 0.82 util, NCCL highspeed only in relevant workloads, no Always.
- Dev tools are intentionally lighter and restart-tolerant.
- `manage.sh` new paths have preflight cluster checks; heavy prompts untouched.
- After changes always validate: `bazelisk test //...`

Before reboot: `./scripts/manage.sh stop-dev ; ./scripts/manage.sh stop`

## Updating / Versions

Pin via group_vars. Re-run the dev playbook to upgrade.

For custom UI changes: edit the Next.js app under `dashboard/`, rebuild the image, and roll the deployment.

## Troubleshooting

- Coder workspaces stuck "connecting": ensure CODER_ACCESS_URL points to reachable (NodePort or DNS).
- Metrics empty: check GPU Operator installed + DCGM; `kubectl get pods -n gpu-operator`.
- Port conflict: override nodeports in values or inventory.
- Logs: `kubectl logs -n coder deploy/coder` etc.

## Next

See getting-started.md for base cluster. Use this to develop the lab itself inside Coder workspaces running on the DGX Spark hardware.

Contributions: keep resources explicit, update tests/BATS, run full bazel validation.
