# Ray Head (Distributed Orchestration)

Deploys the Ray head node for distributed workloads.

**What's on this page**

- Ray head Job + Service manifests, resource profile, startup args
- Purpose for multi-node scaling, pre-req for heavy models (nemotron/glm), relation to ray-worker
- Usage notes (start-ray) and safety

**What this enables**

- Distributed orchestration layer so large models can use tensor/pipeline parallelism across 2+ nodes
- Centralized dashboard + worker coordination with explicit (small) resources

## Purpose

Enables multi-node scaling for large models (nemotron, glm, etc.) that require tensor/pipeline parallelism across nodes.

Must usually be started before heavy multi-node inference jobs.

## Related

- ray-worker
- start-ray command in manage.sh (see auto-generated Shell reference)
- High-speed networking must be configured for good NCCL performance on 2+ nodes.

## NCCL High-Speed Settings

The Ray head Job sets the same NCCL environment block as kimi (dual-400G interconnect):

- `NCCL_SOCKET_IFNAME=enp1s0f0np0,enp1s0f1np1`
- `NCCL_IB_HCA=mlx5_0,mlx5_1`
- `NCCL_DEBUG=INFO` (tune down after validation)
- `NCCL_P2P_DISABLE=0`, `NCCL_SHM_DISABLE=0`, `NCCL_IB_DISABLE=0`
- `NCCL_SOCKET_NTHREADS=4`, `NCCL_NSOCKS_PERTHREAD=4`

`hostNetwork: true` is enabled so Ray workers can reach head/NCCL interfaces directly on multi-node setups.

## Resources

See the Job YAML for explicit requests/limits.

## Safety

- Uses restartPolicy OnFailure / low backoff.
- Part of the "start-ray" flow which is a prerequisite for heavier models.
- Always stop before reboot.
- (Fixed) Explicit nvidia.com/gpu resources + correctly nested volumeMounts for shm.