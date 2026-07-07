# Nemotron Safety (NeMo Guard)

CPU-only NIM content safety guard service.

**What's on this page**

- NIM Deployment for Nemotron Safety (NeMo Guard) (CPU-only) with explicit resources, replicas 1
- Requirements, usage via kubectl/kustomize, safety notes

**What this enables**

- Running Nemotron Safety (NeMo Guard) as a long-lived NIM service in `ai-inference`

## Requirements

- NIM image: `nvcr.io/nim/nvidia/llama-3.1-nemoguard-8b-content-safety:1.0.0`
- Model cache at `/mnt/models/nim-cache`
- Port 8000 exposed via ClusterIP service

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-safety-guard/
```

## Safety

- Explicit `resources.requests` + `limits`
- Deployment `replicas: 1` (no Job backoff; managed by Deployment controller)
- Always run `stop` before reboot (see reboot-safety.md)
