# flux-quality

FLUX.2 **Dev FP8** ComfyUI overlay (max quality image gen on DGX Spark).

## Models

| Role | HF repo | Layout |
| --- | --- | --- |
| FLUX.2 Dev (FP8 / split) | `black-forest-labs/FLUX.2-dev` | `/models/comfy/` |

## Resources

- GPU: 1 · Memory request **70Gi** / limit 100Gi

## Commands

```bash
bazelisk run //scripts:run-utility -- download-flux run --tier quality
bazelisk run //:manage -- start-flux-quality
kubectl -n ai-inference port-forward svc/flux-quality 8188:8188
bazelisk run //:manage -- stop-visual
```

## Safety

Manual start only; heavier than flux-fast; exclusive visual GPU consumer.
