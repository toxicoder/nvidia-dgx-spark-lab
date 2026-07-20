# ltx-quality

LTX-2.3 **quality** (bf16-distilled) ComfyUI overlay for audio-synced video on DGX Spark.

## Models

| Component | Source |
| --- | --- |
| Transformer + TE + proj + audio VAE | `Kijai/LTX2.3_comfy` |
| Quant | bf16-distilled |

## Resources

- GPU: 1 · Memory request **80Gi** / limit 100Gi

## Commands

```bash
bazelisk run //scripts:run-utility -- download-ltx run --tier quality
bazelisk run //:manage -- start-ltx-quality
kubectl -n ai-inference port-forward svc/ltx-quality 8188:8188
bazelisk run //:manage -- stop-visual
```

## Safety

Manual start only; exclusive visual GPU consumer; Resource Guard capacity check.
