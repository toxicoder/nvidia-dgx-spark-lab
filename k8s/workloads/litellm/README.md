# LiteLLM (rounded stack proxy)

Management Deployment. `Always` is OK. No GPU. LAN only (ClusterIP + NodePort `32040` on spark0). Do not use `hostNetwork` or QSFP.

## Config

Real files under `files/` via `configMapGenerator` `files:` (no inline blobs).

Aliases: `lab-fast`, `lab-code`, `lab-smart`, `lab-agent`, `lab-quality`, `lab-med`, `lab-med-vision`, `lab-med-extract`, `lab-frontier`, `lab-frontier-ds`, `lab-auto`.

The proxy must stay up if backends are down (per-model 503 is fine). Medical prompts live in `files/lab-med-system.txt` and `files/lab-med-frontier-fallback.txt` (frontier fallback: MedGemma is offline; this is a general model). `lab-med` never points at a cloud API.

Open WebUI model base URL: `http://litellm.ai-inference.svc.cluster.local:4000/v1` (or `http://<spark0-lan>:32040/v1`). Raw vLLM Services remain a debug bypass.

```bash
bazelisk run //:manage -- start-litellm
bazelisk run //:manage -- start-litellm --backend qwen3.8-27b-nvfp4
bazelisk run //:manage -- stop-litellm
```

`--backend` overlays live under `k8s/overlays/litellm-*` and replace `files/profiles/*.yaml`. Exclusive profiles expose `lab-auto` plus one canonical alias. Open WebUI default model is `lab-auto`.
