# Qwen3.8 Flash Next on one DGX Spark (TensorFold)

Kubernetes lane of [MiaAI-Lab/Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold](https://github.com/MiaAI-Lab/Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold):
Qwen3.8 Flash Next served by **TensorFold's Zig engine (tensorfold-native v1.1.4)** on a
**single** DGX Spark (GB10, 128 GB unified memory). This is the single-node sibling of the
[qwen3.8-27b-tensorfold](../qwen3.8-27b-tensorfold/) lane and of the
[qwen3.8-flash-next-nvfp4](../qwen3.8-flash-next-nvfp4/) lane.

## Requirements

1. **One Spark only.** The Job pins `kubernetes.io/hostname: spark0`; never run two of these
   (or another exclusive model) on the same node - the 512-expert MoE checkpoint needs the
   whole 128 GB unified memory pool and the GPU to itself.
2. **Image: `qwen38-flash-next-tf:local`** with `imagePullPolicy: IfNotPresent` - built
   **locally on the Spark**; this lane depends on no registry image, so a start never waits
   on egress. Upstream `scripts/prepare.sh` builds the engine into
   `tensorfold-qwen38:v1.1.4-eab8582`: TensorFold's Zig engine `tensorfold-native` v1.1.4
   (commit `eab85828`) with this recipe's patches `0001`-`0017` applied, on
   `nvcr.io/nvidia/pytorch:26.07-py3`. Build it on spark0 with the upstream kit (Docker +
   NVIDIA runtime, user in the `docker` group):

   ```bash
   git clone https://github.com/MiaAI-Lab/Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold.git
   cd Qwen3.8-Flash-Next-Single-DGX-Spark-TensorFold
   ./start.sh                    # first run builds/pulls the engine, fetches the
                                 # checkpoint, smoke tests, then prints
                                 # "Qwen3.8-Flash-Next is now LIVE! on port 8888"
   ./stop.sh
   DRY_RUN=1 ./start.sh          # preview without touching Docker
   scripts/prepare.sh --rebuild   # or: PREPARE=1 ./start.sh restart
   PULL=0 ./start.sh              # build locally instead of pulling
   ```

   Then tag what the kit produced as `qwen38-flash-next-tf:local` (`docker tag <image>
   qwen38-flash-next-tf:local`) so the Job's `IfNotPresent` never waits on egress
   mid-start. Upstream also publishes prebuilt tags `v1.1.4-eab8582-4baf16137ecd` and
   `latest` on GHCR, but **publication of those tags is unconfirmed**, so this lane does
   not reference a public image.
3. **Checkpoint on the hostPath** (`/mnt/models` -> `/models`, `HF_HOME=/models`,
   `HF_HUB_OFFLINE=1`). `nvidia/Qwen3.8-Flash-Next-FP4-Local` at revision
   `b9ce18a6887e18c089fdea8509a33e63429a3300` - about **96 GiB** on disk:

   ```bash
   bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold status
   bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold run
   ```

   Plan for **~160 GB free disk** on a fresh Spark (~96 GiB checkpoint plus the image) and
   keep **>= 100 GB** free afterwards.

## Memory budget

| Figure | Value |
| --- | --- |
| MemAvailable needed at start | **~107 GiB** (loading ~81 GiB; enforced upstream by `MEM_NEED_GIB`) |
| Checkpoint on disk | ~96 GiB, 512-expert MoE, NVFP4 routed experts + MXFP8 attention/shared experts |
| KV pool | engine-sized, **not pinned**: a 9 GiB host reserve plus 2 GiB for the vision helper |
| Full window per stream | 4.78 GiB at fp8 for a whole 262,144-token window |
| Concurrency | 5 streams; a `PARALLEL` whose windows do not fit is refused at startup |

The Job requests 96Gi / limits 110Gi so the kubelet refuses to co-schedule anything else
heavy on spark0. There is no vLLM-style `--gpu-memory-utilization` and no `KV_POOL_GB` here
(unlike the 27B lane): memory is controlled by `TENSORFOLD_MEMORY_RESERVE_GIB`, `PARALLEL`,
`CONTEXT`, `KV_DTYPE`, and `VISION` (setting `VISION=0` hands the helper's 2 GiB back).

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen38-flash-next-tensorfold run
bazelisk run //:manage -- start-qwen38-flash-next-tensorfold
bazelisk run //:manage -- start-qwen38-flash-next-tensorfold --with-litellm
bazelisk run //:manage -- stop-qwen38-flash-next-tensorfold
```

Manual start only, exclusive, one lane at a time - the `start-` path adds the interactive
confirmation and capacity checks the other exclusive lanes use.

Raw kubectl path (what the `start-` command applies under the hood):

```bash
kubectl create namespace ai-inference --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k k8s/workloads/qwen3.8-flash-next-tensorfold
kubectl -n ai-inference logs -f job/qwen3.8-flash-next-tensorfold
# OpenAI endpoint: http://qwen3.8-flash-next-tensorfold.ai-inference.svc.cluster.local:8000/v1
# Served model id: Qwen3.8-Flash-Next
kubectl -n ai-inference delete job qwen3.8-flash-next-tensorfold
```

LiteLLM: profile `files/profiles/qwen3.8-flash-next-tensorfold.yaml` + overlay
[`k8s/overlays/litellm-qwen38-flash-next-tensorfold`](../../overlays/litellm-qwen38-flash-next-tensorfold/)
(`lab-auto`, `lab-quality`, `lab-qwen38-flash-next-tensorfold`).

## Tuning (every knob is an env var)

The image entrypoint is configured entirely through env - upstream runs the container with
`docker run -e ...` and its launcher is `tensorfold-native serve` with the settings from
`scripts/config.sh` - so the manifest sets no `command`/`args`. **Unverified until the first
Spark run:** if this build's entrypoint expects argv instead of env, override `args:` in the
Job with `tensorfold-native serve "$MODEL_DIR"` per upstream `scripts/config.sh`.

| Env | Default | Notes |
| --- | --- | --- |
| `MODEL_DIR` | `/models/nvidia__Qwen3.8-Flash-Next-FP4-Local` | Snapshot from the download utility (`<org>__<name>` folding) |
| `MODEL_ID` | `nvidia/Qwen3.8-Flash-Next-FP4-Local` | HF repo id recorded for the snapshot |
| `MODEL_REVISION` | `b9ce18a6887e18c089fdea8509a33e63429a3300` | Pinned; do not float |
| `SERVED_NAME` | `Qwen3.8-Flash-Next` | Must match the LiteLLM profile's `openai/<name>` |
| `PARALLEL` | `5` | Concurrent requests; windows must fit the pool the engine can size |
| `CONTEXT` | `262144` | Native window; **`CONTEXT=1048576` enables the YaRN factor-4 1M window** |
| `DRAFTS` | `1` | MTP drafts ship **in the checkpoint** (no separate drafter repo); `0` = `--no-drafts` |
| `TF_FLASHNEXT_DRAFTS` | `6` | Batched-MTP draft depth |
| `THINKING` | `1` | Reasoning mode on |
| `MAX_TOKENS` | `32768` | Generation cap |
| `KV_DTYPE` | `fp8` | ~1.8x the pool at ~98.8% top-1 agreement; `bf16` is exact and roughly halves it |
| `TENSORFOLD_MEMORY_RESERVE_GIB` | `9` | Host headroom the engine keeps off the pool |
| `TENSORFOLD_MAX_IMAGES` | `50` | Images per request |
| `TENSORFOLD_MAX_VIDEOS` | `4` | Videos per request |
| `VISION` | `1` | Vision tower on; `0` returns the helper's 2 GiB to the pool |
| `PORT` / `HOST` | `8000` / `0.0.0.0` | Upstream default is **8888**; pinned to 8000 for the Service, probes, and profile |
| `HF_HOME` / `HF_HUB_OFFLINE` | `/models` / `1` | HostPath share with the download utility; no egress at start |
| `ABLIT` | unset (off) | Gated overlay, see below |

Probes use `/v1/models` with a 900s initial delay on both (a ~96 GiB checkpoint load outruns
the 27B lane's 600s). The engine also serves `/health` and `/metrics` on the same port.

### Alternate checkpoint (not this recipe)

`azampatti/Qwen3.8-Flash-Next-125B-A5B-INT4-AutoRound` (~122 GiB) is served by the
`db281878` recipe on the upstream **main** branch, not by this v1.1.4 branch. Do not point
`MODEL_DIR` at it from this lane - switch recipes upstream instead.

### Gated abliteration overlay (off by default)

`ABLIT=1` grafts drowzeys's Keys house-qsa abliteration overlay
(`ablit-b9ce18a6-c44f5b92`) onto the checkpoint. It is **gated**: accept its terms and
export `HF_TOKEN`, then re-run the download utility so the overlay lands under
`/models/<org>__<name>`. The exact HF repo id is unconfirmed upstream - the utility takes
`ABLIT_REPO=` as an override, and nothing is fetched without `HF_TOKEN`.

## Safety

- **Manual start only.** Nothing here runs at boot or self-scales; start it deliberately
  with `//:manage -- start-qwen38-flash-next-tensorfold` (interactive confirmation plus
  capacity checks) or `kubectl apply -k`.
- **Exclusive.** The Job takes the whole 128 GB unified-memory pool and the GPU on spark0
  (`nvidia.com/gpu: 1`, requests 96Gi / limits 110Gi, `nodeSelector: spark0`) so the kubelet
  refuses to co-schedule anything else heavy on the node.
- **One lane at a time.** Stop this lane before starting any other exclusive model, and
  vice versa - the engine sizes its KV pool from what is free at start and refuses a
  `PARALLEL` whose windows do not fit.
- **Bounded failure.** `restartPolicy: OnFailure` with `backoffLimit: 1` and
  `ttlSecondsAfterFinished: 7200`, so a crash does not loop into the next workload. No
  hostNetwork or hostIPC; the container drops all capabilities, does not escalate, and runs
  as UID 1000.
- **No egress at start.** `HF_HUB_OFFLINE=1` with the checkpoint on the hostPath, and
  `imagePullPolicy: IfNotPresent` on a locally built image.

## Licensing

- Weights: **NVIDIA Open Model Agreement** (the FP4 checkpoint) whose base model Qwen3.8
  Flash Next is under the **Qwen Community License 1.0** - check both cards before
  commercial or >1M MAU use. The INT4 alternative is Qwen Community License 1.0.
- Gated `ABLIT=1` overlay: its own Responsible Use Agreement, accepted separately.
- Upstream recipe: **MIT** (scripts only; the GitHub license field says NOASSERTION).
- The `nvcr.io/nvidia/pytorch:26.07-py3` base image carries the NVIDIA Software License
  Agreement and Product-Specific Terms.
