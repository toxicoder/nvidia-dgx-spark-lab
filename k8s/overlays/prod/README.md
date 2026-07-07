# overlays/prod

Production overlay for the lab.

## Current state (prod == base workload today)

The prod overlay has **no patches** — it references `k8s/workloads/kimi` directly and applies the full production Job + Service manifests as authored in the workload directory.

```yaml
resources:
  - ../../workloads/kimi
```

This is intentional: production values (8 GPUs, tensor-parallel-size 8, full NCCL block, backoffLimit 1) live in the base workload YAML. The overlay exists as the stable entry point for `kustomize build k8s/overlays/prod` and for future prod-only patches without editing the workload base.

Compare with:

- **test** overlay — `kimi-test` + lighter resource patches
- **single-node** overlay — `kimi-test` + lowered tensor-parallel for 1-node

## When to use

For "real" runs of heavy models after successful `kimi-test` validation.

Rebuild with kustomize or use the manage.sh commands which target the right manifests:

```bash
kubectl kustomize k8s/overlays/prod
```