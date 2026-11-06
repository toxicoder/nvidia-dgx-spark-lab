# Qwen3.8-27B EXL3 on 16 GB+ consumer NVIDIA GPUs (ExLlamaV3)

Kubernetes lane of [MiaAI-Lab/Qwen3.8-27B-16gb-NVIDIA-GPUs-one-click-install](https://github.com/MiaAI-Lab/Qwen3.8-27B-16gb-NVIDIA-GPUs-one-click-install).
Upstream is a Windows/Linux **venv kit with no official container image** - this lane's
[Dockerfile](Dockerfile) is our pin of the same stack: ExLlamaV3 **v1.6.0**
([turboderp-org/exllamav3](https://github.com/turboderp-org/exllamav3)) from prebuilt
wheels plus PyTorch cu128.

One Job, one GPU, no nodeSelector: it schedules on **any** node advertising
`nvidia.com/gpu: 1`. It is *not* a DGX Spark lane - see [qwen3.8-27b-tensorfold](../qwen3.8-27b-tensorfold/)
for the single-Spark TensorFold recipe and [qwen3.8-27b-nvfp4](../qwen3.8-27b-nvfp4/) for vLLM on Spark.

## Requirements

- Node: single NVIDIA GPU with **>= 16 GB VRAM**, Turing or newer (compute capability
  **7.5+**), driver **570+**. 12 GB cards run the 2.0 bpw tier with `GPU_MEM_GB` lowered.
- Image built locally on the GPU node, tag must match the Job exactly:

  ```bash
  docker build -t qwen38-27b-exl3:local -f k8s/workloads/qwen3.8-27b-exl3-16gb/Dockerfile .
  ```

  `imagePullPolicy: IfNotPresent` - the tag is never pushed to a registry.
- Weights on the host at `/mnt/models` (mounted read-write at `/models`, `HF_HOME=/models`).
  Download first:

  ```bash
  bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 status
  bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 run --tier 3.0bpw
  ```

## Pick the quant by VRAM

EXL3 bits-per-weight is the memory knob. Upstream guidance (disk 9.7-22.9 GB per quant):

| VRAM | Sensible bpw |
| --- | --- |
| 12 GB (floor) | 2.0 bpw (`--tier 2.0bpw`, Mia-AiLab repo) |
| 16 GB | 2.0 - 3.5 bpw (default `MODEL_DIR` is `3.0bpw`) |
| 24 GB | up to 4.0 bpw |
| 32 GB+ | up to 6.0 bpw text, or 4.0 bpw at 262k with images |

## Usage

```bash
kubectl create namespace ai-inference --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k k8s/workloads/qwen3.8-27b-exl3-16gb
kubectl -n ai-inference logs -f job/qwen3.8-27b-exl3-16gb
# OpenAI endpoint: http://qwen3.8-27b-exl3-16gb.ai-inference.svc.cluster.local:8000/v1
kubectl -n ai-inference delete job qwen3.8-27b-exl3-16gb
```

LiteLLM: profile `files/profiles/qwen3.8-27b-exl3-16gb.yaml` + overlay
[`k8s/overlays/litellm-qwen38-27b-exl3`](../../overlays/litellm-qwen38-27b-exl3/)
(`lab-auto`, `lab-quality`, `lab-qwen38-27b-exl3`).

## Tuning (every knob is an env var)

Upstream's `.env` maps onto the Job's `env:` block; `python -m exllamav3_server --help`
lists the full flag set.

| Env | Default | Notes |
| --- | --- | --- |
| `MODEL_DIR` | `/models/turboderp__Qwen3.8-27B-exl3/3.0bpw` | Quant snapshot; use `/models/Mia-AiLab__Qwen3.8-27B-EXL3-2.0bpw/2.0bpw` for the 2.0 tier |
| `CONTEXT_SIZE` | `199936` | **Must stay a multiple of the 256-token page size** |
| `MAX_PARALLEL` | `4` | Concurrent streams; each one costs KV memory |
| `GPU_MEM_GB` | `14.7` | VRAM cap for a 16 GB card; lower it on 12 GB |
| `HF_HOME` | `/models` | Keep on the hostPath so cache and snapshots share one disk |

Port is pinned to **8000** (`--port 8000`, `containerPort`, Service port). Upstream's
default is **8888**; the Service and the LiteLLM profile both assume 8000, so do not
change one without the other.

## Draft decoding

Upstream exposes `DRAFT=mtp|none|dflash2`. The Job args ship plain target-model serving
(equivalent to upstream `DRAFT=none`) so the pinned command stays reviewable. For
`dflash2`, fetch the drafter and add its flag to the Job args:

```bash
bazelisk run //scripts:run-utility -- download-qwen38-27b-exl3 run --tier 3.0bpw --drafter
# -> /models/r0b0tlab__Qwen3.8-27B-DFlash2-EXL3-4.00bpw (~1.25 GB)
```

Then add the drafter flag your ExLlamaV3 build expects (check
`python -m exllamav3_server --help`) pointing at that directory. `mtp` is the upstream
default where the checkpoint ships an MTP head.

## Licensing

- Weights: **Qwen Community License** (check the upstream model card before any
  commercial or >1M MAU use).
- Kit scripts (the upstream venv launcher): **MIT**. The ExLlamaV3 engine is under its own
  license; the chat UI bundled upstream (DeepSeek Harness / Cherry Studio) is not used here.
