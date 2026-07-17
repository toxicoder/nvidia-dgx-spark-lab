# ltx-balanced

LTX-2.3 **balanced** (distilled-fp8) ComfyUI overlay for audio-synced video on DGX Spark.

## Models

| Component | Source |
| --- | --- |
| Transformer + TE + proj + audio VAE | `Kijai/LTX2.3_comfy` |
| Quant | distilled-fp8 |

## Resources

- GPU: 1 · Memory request **70Gi** / limit 100Gi

## Commands

```bash
bazelisk run //scripts:run-utility -- download-ltx run --tier balanced
bazelisk run //:manage -- start-ltx-balanced
kubectl -n ai-inference port-forward svc/ltx-balanced 8188:8188
bazelisk run //:manage -- stop-visual
```

## Safety

Manual start only; exclusive visual GPU consumer; Resource Guard capacity check.
