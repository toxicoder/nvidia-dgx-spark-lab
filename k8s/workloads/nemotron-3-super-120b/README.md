# Nemotron 3 Super 120B A12B

Single-GPU NVFP4 large reasoning model (120B A12B MoE) on vLLM v0.8.5.

**What's on this page**

- Production Job for Nemotron 3 Super 120B A12B (1 GPU NVFP4) with explicit resources, OnFailure + backoff 1, high-speed NCCL
- Requirements, usage via kubectl/kustomize, safety and stop notes

**What this enables**

- Running Nemotron 3 Super 120B A12B on a single DGX Spark GPU with proper resource isolation and interconnect config

## Requirements

- 1 GPU available in `ai-inference` namespace
- Model weights at `/mnt/models` (HF_HOME=/models)
- Validate cluster with kimi-test first on new setups

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-3-super-120b/
```

## Safety

- Explicit `resources.requests` + `limits`
- `restartPolicy: OnFailure` + `backoffLimit: 1`
- Always run `stop` before reboot (see reboot-safety.md)

**Unified vLLM image**: v0.8.5; NCCL block aligned to kimi-test baseline. hostNetwork omitted (see models-catalog).
