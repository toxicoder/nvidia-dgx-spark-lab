# Resource Guard

**What's on this page**

- Service tiers (critical, management, optional dev, inference) and how they are protected
- Policy file (`config/resource-policy.yaml` / `.json`), CLI commands, and dashboard panels
- Kubernetes guardrails (PriorityClass, ResourceQuota, kubelet reservation)

**What this enables**

- Keep SSH and the lab dashboard responsive under heavy GPU load
- Pre-flight checks before starting inference or dev workspaces
- Actionable "free resources" suggestions when capacity is tight

## Overview

Resource Guard uses **defense in depth**:

1. **Policy** — `config/resource-policy.yaml` (human) + `config/resource-policy.json` (parsed by scripts)
2. **Runtime checks** — `scripts/lib/resources.sh` blocks unsafe `start-*` unless you confirm or `--force`
3. **Kubernetes** — `k8s/base/resource-guard/` (PriorityClass, ResourceQuota, LimitRange, PDB)
4. **Host reservation** — kubelet `system-reserved` / `kube-reserved` via Ansible `group_vars`

## CLI

```bash
./scripts/manage.sh resources
./scripts/manage.sh resources check model:kimi --json
./scripts/manage.sh resources suggest model:kimi
./scripts/manage.sh resources apply-policy
./scripts/manage.sh doctor    # includes capacity summary
./scripts/manage.sh estimate kimi-test
```

## Dashboard

- **Resource Guard** panel — GPU/CPU/memory available vs allocatable (30s refresh)
- **Inference Workloads** — start/stop with the same gates as `manage.sh` (heavy models require typing `yes`)
- **Capacity gate dialog** — suggests stopping Coder/Kasm or lighter jobs when blocked

## Safety impact

- **kubelet reservation** reduces schedulable CPU/RAM; protects sshd/k3s from OOM
- **ResourceQuota** on `ai-inference` caps total GPU/memory requests
- **`enforce_capacity`** in `start_workload` may block apply when cluster is tight
- Inference `restartPolicy`, `backoffLimit`, and NCCL settings are unchanged

Apply guardrails after bootstrap:

```bash
./scripts/manage.sh resources apply-policy
```

Reboot nodes after Ansible kubelet reservation changes.