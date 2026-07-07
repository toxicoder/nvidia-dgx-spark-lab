# Nemotron Speech TTS

CPU-only NIM text-to-speech service.

**What's on this page**

- NIM Deployment for Nemotron Speech TTS (CPU-only) with explicit resources, replicas 1
- Requirements, usage via kubectl/kustomize, safety notes

**What this enables**

- Running Nemotron Speech TTS as a long-lived NIM service in `ai-inference`

## Requirements

- NIM image: `nvcr.io/nim/nvidia/fastpitch-hifigan-tts:1.0.0`
- Model cache at `/mnt/models/nim-cache`
- Port 9001 exposed via ClusterIP service

## Usage

```bash
kubectl apply -k k8s/workloads/nemotron-speech-tts/
```

## Safety

- Explicit `resources.requests` + `limits`
- Deployment `replicas: 1` (no Job backoff; managed by Deployment controller)
- Always run `stop` before reboot (see reboot-safety.md)
