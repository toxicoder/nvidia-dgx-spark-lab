# Nemotron 3 Nano Omni 30B A3B

Single-GPU NVFP4 multimodal/reasoning model on vLLM v0.8.5.

**What's on this page**

- Production Job for Nemotron 3 Nano Omni 30B A3B (1 GPU NVFP4) with explicit resources, OnFailure + backoff 1, high-speed NCCL
- Requirements, usage via kubectl/kustomize, safety and stop notes

**What this enables**

- Running Nemotron 3 Nano Omni 30B A3B on a single DGX Spark GPU with proper resource isolation and interconnect config

## Requirements

- 1 GPU available in `ai-inference` namespace
- Model weights at `/mnt/models` (HF_HOME=/models)
- Validate cluster with kimi-test first on new setups

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-3-nano-omni-30b/
```

## Safety

- Explicit `resources.requests` + `limits`
- `restartPolicy: OnFailure` + `backoffLimit: 1`
- Always run `stop` before reboot (see reboot-safety.md)

**Unified vLLM image**: v0.8.5; NCCL block aligned to kimi-test baseline. hostNetwork omitted (see models-catalog).
