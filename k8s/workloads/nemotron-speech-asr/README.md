# Nemotron Speech ASR

CPU-only NIM automatic speech recognition service.

**What's on this page**

- NIM Deployment for Nemotron Speech ASR (CPU-only) with explicit resources, replicas 1
- Requirements, usage via kubectl/kustomize, safety notes

**What this enables**

- Running Nemotron Speech ASR as a long-lived NIM service in `ai-inference`

## Requirements

- NIM image: `nvcr.io/nim/nvidia/parakeet-ctc-0.6b-asr:1.0.0`
- Model cache at `/mnt/models/nim-cache`
- Port 9000 exposed via ClusterIP service

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-speech-asr/
```

## Safety

- Explicit `resources.requests` + `limits`
- Deployment `replicas: 1` (no Job backoff; managed by Deployment controller)
- Always run `stop` before reboot (see reboot-safety.md)
