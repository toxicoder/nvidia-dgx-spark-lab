# overlays/single-node/qwen36-dual

Deploys both Qwen3.6 models with dual-safe GPU memory utilization (0.38) and max-len 65536.

## Prerequisites

- GPU time-slicing with 2 logical GPUs (`k8s/base/gpu-time-slicing`)
- Weights for both NVFP4 checkpoints under `/mnt/models`

## Build / apply

```bash
kubectl kustomize k8s/overlays/single-node/qwen36-dual
# Prefer manage.sh:
bazelisk run //:manage -- start-qwen36-dual
```
