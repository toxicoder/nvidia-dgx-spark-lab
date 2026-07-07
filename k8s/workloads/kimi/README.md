# kimi (Full Production) Workload

Heavy production version for very large models (Kimi-K2.6 and similar). Scalable for 1-4 nodes (use inter-node parallelism for 2+).

Deployed by `./scripts/manage.sh start-kimi` (or `start-full`).

See the auto-generated [Shell reference](../../../docs/generated/shell/reference.md) for the exact `start-kimi` command, safety checks, and resource profile.

**What's on this page**

- Full production Job + Service manifests for 8-GPU Kimi-scale inference with strict resources.requests/limits, backoffLimit:1, restartPolicy: OnFailure
- Complete NCCL dual-400G high-speed interconnect settings, affinity rules, vLLM args, model volume mounts
- Safety warnings, differences from kimi-test, deploy/stop instructions via manage.sh

**What this enables**

- Running the heavy production inference workload reliably after lighter validation
- Explicit control over GPU/memory so the host and SSH stay responsive
- Multi-node tensor/pipeline parallelism over the dual 400G links

## WARNING — Heavy workload

This workload requests a large number of GPUs and host memory.

- **Only run this after successful `kimi-test` runs** and `estimate kimi`.
- Always `manage.sh stop` before rebooting nodes (see reboot-safety.md).
- Monitor host memory and SSH responsiveness closely while it is running.
- The Job is defined with `restartPolicy: OnFailure` + very low `backoffLimit`.
- Uses explicit `resources.requests` + `limits` for CPU, memory, and GPU.

## NCCL / Multi-node

On 2+ nodes the workload is configured (via the Job manifest + manage.sh environment) to prefer the dual 400G high-speed interfaces for NCCL.

**Unified image**: v0.8.5 across kimi/kimi-test/nemotron/glm-5.2 (MoE/FP8/aarch64 support; see models-catalog.md). NCCL blocks kept aligned (SOCKET_NTHREADS etc to kimi-test baseline). hostNetwork decision: omitted here (see k8s yaml comments + catalog).

## Differences from kimi-test

| Setting                    | kimi-test     | kimi (production) |
|---------------------------|---------------|-------------------|
| GPUs requested            | 2             | 8                 |
| Memory request            | 32Gi          | 128Gi             |
| tensor-parallel-size      | 2             | 8                 |
| max-model-len             | 8192          | 32768             |
| backoffLimit              | 2             | 1                 |
| gpu-memory-utilization    | 0.85          | 0.82              |

## NCCL High-Speed Settings

The critical variables are set in the pod spec (for 2-4 nodes):

- `NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1`
- `NCCL_IB_HCA=mlx5_0,mlx5_1`

For 1 node: local NCCL (no inter-node vars needed).

Verify on startup that NCCL picks up the links (or local GPUs for single-node).

## Before Deploying

1. Ensure models are present at `/mnt/models` on the target nodes (or use a shared filesystem).
2. Run `./scripts/manage.sh status` and confirm spare capacity.
3. Use the management script (it has confirmation prompt).

## Stopping

```bash
./scripts/manage.sh stop
# or manually
kubectl delete job kimi -n ai-inference --ignore-not-found
```
