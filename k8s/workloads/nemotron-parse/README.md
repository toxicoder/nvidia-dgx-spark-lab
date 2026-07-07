# Nemotron Parse

GPU NIM document parsing service (1 GPU).

**What's on this page**

- NIM Deployment for Nemotron Parse (1 GPU) with explicit resources, replicas 1
- Requirements, usage via kubectl/kustomize, safety notes

**What this enables**

- Running Nemotron Parse as a long-lived NIM service in `ai-inference`

## Requirements

- NIM image: `nvcr.io/nim/nvidia/nemotron-parse:1.0.0`
- Model cache at `/mnt/models/nim-cache`
- Port 8000 exposed via ClusterIP service

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-parse/
```

## Safety

- Explicit `resources.requests` + `limits`
- Deployment `replicas: 1` (no Job backoff; managed by Deployment controller)
- Always run `stop` before reboot (see reboot-safety.md)
