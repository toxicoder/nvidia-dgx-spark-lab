# overlays/single-node

Kustomize overlay tuned for 1-node (spark0 only) deployments.

## Differences from prod

- Uses `kimi-test` (lighter workload) instead of full production `kimi`.
- Patch `patches/single-node-tensor-parallel.yaml` lowers tensor-parallel-size from 2 → 1 and GPU requests/limits from 2 → 1 for minimal single-host validation.
- No multi-node affinity or highspeed requirements beyond the base workload's soft preferences.
- Still uses the same safety policies (OnFailure, explicit limits).

## Patches

| Patch | Effect |
|-------|--------|
| `single-node-tensor-parallel.yaml` | `--tensor-parallel-size 1`, `nvidia.com/gpu: 1` (requests == limits) |

Rebuild to inspect:

```bash
kubectl kustomize k8s/overlays/single-node
# or: kustomize build k8s/overlays/single-node
```

## Usage

Use when running the full lab on a single DGX Spark.

See getting-started.md "1-node (simplest...)" inventory section and the manage.sh commands.