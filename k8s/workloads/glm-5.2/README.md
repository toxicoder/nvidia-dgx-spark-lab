# GLM-5.2 (Heavy Production — 1-bit UD-IQ1_M + llama.cpp RPC)

Ultra-low-footprint GLM-5.2 on 2× DGX Spark GB10 nodes using Unsloth dynamic 1-bit quantization and llama.cpp RPC over dual 400G.

**What's on this page**

- Model download (`unsloth/GLM-5.2-GGUF` → `UD-IQ1_M/*`, ~228 GB)
- GB10-native llama.cpp image build (`GGML_RPC`, `sm_121`)
- 2-node RPC topology (spark0 server, spark1 backend)
- Job manifests with strict resources, OnFailure + backoff 1, privileged unified-memory access
- Start via manage.sh, tuning knobs, expected performance, safety notes

**What this enables**

- Running GLM-5.2 (~753B MoE) on exactly two DGX Spark nodes when higher-quant paths do not fit
- Leveraging dual 400G interconnect for MoE expert/layer offloading via llama.cpp RPC
- OpenAI-compatible HTTP API on port 8000 (same Service pattern as other workloads)

## Requirements

- **2 nodes**: spark0 (primary `llama-server`) + spark1 (RPC backend `llama-rpc-server`)
- Run **kimi-test** first to validate the stack
- Model shards on both nodes at `/mnt/models/GLM-5.2-GGUF/UD-IQ1_M/` (shared NVMe or synced storage)
- Custom image built on GB10: `docker build -t lab/llama-cpp-gb10:rpc k8s/workloads/glm-5.2/`
- Significant unified memory pressure; expect ~8 tokens/s at 256K context (quality trade-off accepted)

## Model Download

```bash
bazelisk run //scripts:run-utility -- download-glm52-gguf status
bazelisk run //scripts:run-utility -- download-glm52-gguf run
```

Downloads `unsloth/GLM-5.2-GGUF` with `--include "UD-IQ1_M/*"` to `/mnt/models`. Resumable.

Point llama.cpp at the first shard (auto-detects remaining shards):

`/mnt/models/GLM-5.2-GGUF/UD-IQ1_M/GLM-5.2-UD-IQ1_M-00001-of-XXXX.gguf`

## Image Build (on each GB10 node)

```bash
cd k8s/workloads/glm-5.2
docker build -t lab/llama-cpp-gb10:rpc .
```

Key CMake flags (pinned in Dockerfile):

- `GGML_CUDA=ON`, `GGML_RPC=ON`, `CMAKE_CUDA_ARCHITECTURES=121a-real`
- Targets: `llama-server`, `llama-rpc-server`

## 2-Node RPC Topology

| Node | Role | Process | Highspeed |
|------|------|---------|-----------|
| spark0 | Primary | `llama-server` :8000 | `192.168.100.1` |
| spark1 | RPC backend | `llama-rpc-server` :50052 | `192.168.100.2` |

Server connects via `--rpc 192.168.100.2:50052` (override with `RPC_PEER` env in job yaml).

## Deploy

```bash
./scripts/manage.sh start-test
./scripts/manage.sh estimate glm-5.2
./scripts/manage.sh start-glm-5.2
```

Starts RPC on spark1 first, then server on spark0. **No Ray** required.

```bash
kubectl port-forward svc/glm-5.2 8000:8000
curl http://localhost:8000/v1/models
```

## Tuning

- **Context**: default `262144` (256K); scale toward 1M carefully (throughput drops)
- **KV cache**: `--cache-type-k q4_0 --cache-type-v q4_0` (try `q3_0` for more speed)
- **Load time**: 15–30+ minutes on first start (ARM CPU repack)
- **Stop**: `./scripts/manage.sh stop` (main server then RPC backend)

## Safety

- `restartPolicy: OnFailure`, `backoffLimit: 1` — never auto-restarts heavy load
- Explicit `resources.requests` + `limits` (1 GPU + ~110Gi per node)
- Privileged containers for GB10 unified memory (scoped to glm-5.2 jobs only)
- Stop before any reboot
- 1-bit quality trade-off — confirmation required in `start_glm()`

See the Shell reference for exact command and safety warnings.