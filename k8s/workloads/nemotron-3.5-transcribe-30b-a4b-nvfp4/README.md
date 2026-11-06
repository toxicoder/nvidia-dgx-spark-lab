# Nemotron 3.5 Transcribe 30B-A4B NVFP4

GPU vLLM automatic-speech-recognition service for `nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4`
(34B total / ~4.3B active params incl. the audio encoder, 40 languages, 1-hour recordings,
65,536-token context).

**What's on this page**

- vLLM Deployment for Nemotron 3.5 Transcribe (1 GPU) with explicit resources, replicas 1
- Requirements, usage, safety notes

**What this enables**

- OpenAI-compatible transcription (`POST /v1/audio/transcriptions`) in `ai-inference`

## Requirements

- Image: `nemotron-3.5-transcribe:local` - upstream publishes **no** container tag for this
  model, so the pin in `Dockerfile` (`vllm/vllm-openai:v0.32.0` + NeMo Speech from main) is ours.
  Build it on a Blackwell host; NVFP4 will not run on anything older. The model card lists
  DGX Spark (GB10) among the supported NVFP4 hardware.
- Weights at `/mnt/models/nvidia__NVIDIA-Nemotron-3.5-Transcribe-30B-A4B-NVFP4`
  (`bazelisk run //scripts:run-utility -- download-nemotron-transcribe run`)
- Port 8000 exposed via ClusterIP service; probes hit `/health` (vLLM convention, not the NIM `/v1/health/ready`)
- Word timestamps need the V1 model runner: `VLLM_USE_V2_MODEL_RUNNER=0` is set in the Deployment

## Usage

```bash
bazelisk run //scripts:run-utility -- inference-workloads start nemotron-3.5-transcribe-30b-a4b-nvfp4 --confirm yes
```

In-cluster endpoint: `http://nemotron-3.5-transcribe-30b-a4b-nvfp4.ai-inference.svc.cluster.local:8000/v1`.
Use the OpenAI SDK with `api_key="EMPTY"`, `temperature=0`, and reasoning off (the model card's
recommended transcription settings).

## Safety

- Explicit `resources.requests` + `limits`; `nvidia.com/gpu: 1`, cpu 8 / 48Gi limits
- Deployment `replicas: 1` (managed by the Deployment controller, no Job backoff)
- License OpenMDW-1.1 - commercial use allowed
- Always run `stop` before reboot (see reboot-safety.md)
