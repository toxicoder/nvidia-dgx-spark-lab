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
4. **Host reservation** — kubelet `system-reserved` / `kube-reserved` via Ansible `group_vars` (do not double-count in policy)

## Headroom floor (24Gi)

Resource Guard reserves **`max(24Gi, 15% of allocatable)` per node**. It does **not** try to keep 64Gi free after kubelet reservations.

| Layer | Role |
| --- | --- |
| kubelet `system-reserved` / `kube-reserved` | Host hang line (sshd, k3s). Ansible still documents 64Gi+8Gi; measure live `allocatable` before changing it. 95Gi Jobs already schedule, so those args are probably not applied as written. |
| Policy `memory_min_per_node: 24Gi` | Capacity math only. 24 GiB is above 15% of ~121.7 GiB visible RAM (~18.3 GiB) and above the community hang line (~8–12 GiB MemAvailable). |

The old 64Gi policy floor reserved ~192 GiB across three Sparks before any Job, so Mode A (~189 GiB) always failed and operators clicked through. That made the guard a paper tiger.

### Util matrix (do not flatten)

| Mode | Engine knob | Cap | Notes |
| --- | --- | --- | --- |
| A daily fleet | vLLM `--gpu-memory-utilization` | **≤ 0.82** | Shared with K3s, LiteLLM, dashboard, SSH |
| B GLM exclusive | vLLM `--gpu-memory-utilization` | **≤ 0.85** | Exclusive ring only. 0.88 is not shipped |
| C DeepSeek-V4.1 exclusive | SGLang `--mem-fraction-static` | **≤ 0.95** | MiaAI measured load for ~101 GiB/rank. Not a global util raise |

Never ship vLLM **0.88 / 0.90**. Do not raise `llm_gpu_memory_utilization` in Ansible.

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