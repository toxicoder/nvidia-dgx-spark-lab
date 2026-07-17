# flux-fast

FLUX.2 Klein 9B **NVFP4 + Nunchaku** ComfyUI overlay (speed-first image gen on DGX Spark).

## Models

| Role | HF repo | Layout |
| --- | --- | --- |
| Diffusion (NVFP4) | `black-forest-labs/FLUX.2-klein-9b-nvfp4` | `/models/comfy/diffusion_models` |
| Nunchaku (optional) | `tonera/FLUX.2-klein-9B-Nunchaku` | `/models/comfy/diffusion_models` |

## Resources

- GPU: 1 · Memory request 60Gi / limit 100Gi (inherits comfy-base)

## Commands

```bash
bazelisk run //scripts:run-utility -- download-flux run --tier fast
bazelisk run //:manage -- start-flux-fast
kubectl -n ai-inference port-forward svc/flux-fast 8188:8188
bazelisk run //:manage -- stop-visual
```

## Safety

Manual start only; Resource Guard capacity check; exclusive with other visual workloads.
