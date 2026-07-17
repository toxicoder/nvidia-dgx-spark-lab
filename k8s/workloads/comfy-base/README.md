# comfy-base

ComfyUI base runtime for visual generative AI on DGX Spark (GB10 unified memory).

**What's on this page**

- Deployment + Service + PVC for persistent ComfyUI state
- Spark-specific unified-memory patch and env defaults
- Manual lifecycle via `manage.sh`

**What this enables**

- A shared ComfyUI install on which FLUX.2 / LTX-2.3 overlays are built
- Host model cache at `/mnt/models` with PVC-backed workflows and custom nodes

## Requirements

| Item | Value |
| --- | --- |
| GPU | 1× Blackwell (GB10) |
| Memory request / limit | 60Gi / 100Gi (tunable) |
| Models host path | `/mnt/models` |
| PVC | `comfy-state` (100Gi, K3s local-path or default SC) |
| Namespace | `ai-inference` |

## Spark optimizations

| Setting | Purpose |
| --- | --- |
| `get_free_memory` patch | Use host free RAM instead of under-reporting `cudaMemGetInfo` on unified memory |
| `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` | Reduce allocator fragmentation |
| `LAB_VISUAL_ENABLE_NVFP4=1` | Hint for NVFP4 / Nunchaku paths on Blackwell |
| Init install of Nunchaku + SageAttention | Best-effort; fail-soft if aarch64 wheels missing |

Cold start (first PVC populate) can take 10–30+ minutes. Probes allow long initial delays.

## Usage

```bash
# Prefer manage.sh (capacity gate + confirmation):
bazelisk run //:manage -- start-comfy-base

# Or raw kustomize:
kubectl apply -k k8s/workloads/comfy-base/

# UI access (ClusterIP):
kubectl -n ai-inference port-forward svc/comfy-base 8188:8188

bazelisk run //:manage -- stop-comfy-base
```

## Safety

- Explicit `resources.requests` + `limits` (1 GPU, 60–100Gi memory)
- Deployment `replicas: 1`; **no auto-start** on reboot
- Manual start only via `manage.sh` / operator apply
- Mutually exclusive with other heavy GPU workloads (Resource Guard)
- Always run `stop` / `stop-comfy-base` before reboot (see reboot-safety.md)

## Layout

| Path in pod | Backend |
| --- | --- |
| `/models` | hostPath `/mnt/models` (shared weights) |
| `/comfy-state` | PVC `comfy-state` (ComfyUI tree, custom_nodes, outputs) |
| `/scripts/*` | ConfigMap `comfy-base-scripts` from `scripts/install-comfy.sh`, `scripts/run-comfy.sh` |
| `/patches/*` | ConfigMap `comfy-base-spark-patches` from `scripts/patch_get_free_memory.py` |

Install/run and Spark patch sources live under `scripts/` and are wired via
`configMapGenerator` in `kustomization.yaml` (not inline ConfigMap YAML), so
shellcheck/mypy can lint them.
