# flux-to-ltx

Single-pod **Flux → LTX** text-to-image-to-video pipeline (audio-synced) on DGX Spark.

## Resources

| Resource | Value |
| --- | --- |
| GPU | 1 |
| Memory request / limit | **90Gi** / 100Gi |
| CPU request / limit | 12 / 18 |

## Defaults

- Flux tier: **fast** (Klein NVFP4 + Nunchaku)
- LTX tier: **balanced** (distilled FP8)

## Commands

```bash
bazelisk run //scripts:run-utility -- download-flux run --tier fast
bazelisk run //scripts:run-utility -- download-ltx run --tier balanced
bazelisk run //:manage -- start-flux-to-ltx
kubectl -n ai-inference port-forward svc/flux-to-ltx 8188:8188
bazelisk run //:manage -- stop-visual
```

## Safety

Highest-memory visual workload. Exclusive GPU. Manual start + Resource Guard only.
