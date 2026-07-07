---
title: Monitoring & Observability
description: Full observability stack (Prometheus, DCGM, Grafana dashboards, lab dashboard integration), ports, startup commands, and metric troubleshooting for the lab cluster.
---

# Monitoring & Observability

**What's on this page**

- Full stack: Prometheus, exporters, Grafana (provisioned), Headlamp, lab dashboard Observability panel
- How to start and verify (`start-monitoring`, `monitoring verify`)
- All 8 enterprise Grafana dashboards
- DCGM + GPU Operator troubleshooting
- Service scrape coverage

**What this enables**

- End-to-end metrics from DGX Spark hosts, GPUs, Kubernetes, inference, platform, and agent services
- Git-provisioned Grafana dashboards (no manual import)
- One-click access from the lab dashboard `#observability` section
- Validated scrape targets via `manage.sh monitoring verify`

## Stack Components

| Component | Role |
|-----------|------|
| **node-exporter** | Host CPU, memory, disk, network on every DGX node |
| **DCGM exporter** | GPU util, memory, power, temperature (GPU Operator) |
| **kube-state-metrics** | Pods, jobs, deployments, quotas, PVCs |
| **blackbox-exporter** | HTTP probes for SSO routes, inference, MCP, Hermes |
| **Prometheus** | Scrapes all targets; 7-day retention |
| **Grafana** | Provisioned Prometheus datasource + 8 dashboards |
| **Headlamp** | Kubernetes UI (read-focused) |
| **Lab dashboard** | Observability panel with deep links |

## Starting the Stack

```bash
./scripts/manage.sh start-monitoring
# Verify scrape targets
./scripts/manage.sh monitoring verify
# or
./scripts/utilities/monitoring-stack.sh verify --json

./scripts/manage.sh urls
```

Ansible path (same underlying `scripts/lib/monitoring.sh`):

```bash
ansible-playbook -i inventory/hosts.ini playbooks/install-dev-workspaces.yml
```

## Access

| Service | NodePort (bypass) | SSO (Traefik :32443) |
|---------|-------------------|----------------------|
| Grafana | `:32083` | `https://grafana.lab.local` |
| Headlamp | `:32084` | `https://headlamp.lab.local` |
| Lab dashboard | `:32082` | `https://dashboard.lab.local` → `#observability` |
| node-exporter | `:32090` | (internal scrape only) |
| Prometheus | ClusterIP | (internal; use Grafana) |

Default Grafana credentials (dev): `admin` / `admin` — change in production.

## Provisioned Dashboards

All dashboards live in `config/grafana/dashboards/` and are loaded via ConfigMap on deploy.

| UID | Title | Focus |
|-----|-------|-------|
| `spark-overview` | Lab Overview | Enterprise home — nodes, GPUs, probes, failed jobs |
| `spark-nodes` | DGX Nodes | Per-node CPU, memory, disk, network, load |
| `spark-gpu` | GPU Cluster | DCGM util, memory, power, temperature |
| `spark-k8s` | Kubernetes | Pods by namespace, job failures, quota usage |
| `spark-inference` | Inference | vLLM requests, GPU cache, probe health |
| `spark-platform` | Platform Services | Traefik, probes, cert-manager |
| `spark-dev-agent` | Dev & Agent Stack | Coder, Kasm, Open WebUI, Hermes, MCP |
| `spark-storage-net` | Storage & Network | Disk I/O, high-speed `enp1s0*` interfaces |

Regenerate dashboard JSON after edits:

```bash
python3 config/grafana/generate-dashboards.py
```

## Lab Dashboard Integration

The Next.js control plane includes an **Observability** section (`#observability`):

- Component status (Grafana, Prometheus, exporters, DCGM)
- **Open Grafana** / **Open Headlamp** external links (SSO-aware)
- Quick links to all 8 provisioned dashboards
- Resource Guard cross-links to GPU/Overview dashboards when utilization exceeds 75%

## Scrape Coverage

Prometheus jobs (see `config/monitoring-probes.yaml`):

- `node-exporter`, `dcgm`, `kube-state-metrics`, `traefik`
- `kubernetes-pods-annotated` — inference + MCP workloads
- `blackbox-cluster`, `blackbox-inference`, `blackbox-mcp`, `blackbox-host`

Inference jobs and services include `prometheus.io/scrape` annotations for vLLM `/metrics`.

## DCGM + GPU Operator

DCGM is explicitly enabled in the GPU Operator role. If GPU metrics are missing:

```bash
kubectl get pods -n gpu-operator | grep dcgm
kubectl logs -n gpu-operator -l app=nvidia-dcgm-exporter --tail=20
./scripts/manage.sh monitoring verify
```

## Troubleshooting

**Grafana empty / no data**

1. Run `./scripts/manage.sh monitoring verify` — check `missingRequiredJobs`
2. Confirm Prometheus pod: `kubectl get pods -n monitoring -l app.kubernetes.io/name=prometheus`
3. Re-deploy: `./scripts/manage.sh start-monitoring`

**Probe failures for Hermes/MCP**

- Hermes runs on host Docker — blackbox probes use spark0 InternalIP
- MCP NodePorts (32100–32106) must be reachable from the cluster

**Quota exceeded**

Monitoring namespace quota is `4 CPU / 6Gi` requests. Check: `kubectl describe quota -n monitoring`

## Related

- [dev-workspaces.md](dev-workspaces.md)
- [troubleshooting.md](troubleshooting.md)
- [getting-started.md](getting-started.md)