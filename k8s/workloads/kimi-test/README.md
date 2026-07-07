# kimi-test Workload

Lighter, safer version of the Kimi inference workload (scalable for 1-4 nodes).

Deployed by `./scripts/manage.sh start-test`.

See the auto-generated [Shell Commands & Helpers reference](../../../docs/generated/shell/reference.md) and `estimate kimi-test` for current resource advice and the exact command.

**What's on this page**

- Lighter test Job manifest (2 GPU) with resources, backoffLimit:2, restartPolicy OnFailure, NCCL config
- Purpose as first validation step, key safety features, usage, customization, monitoring notes
- Links to related start/stop and full production counterpart

**What this enables**

- Safe first run on new or changed clusters to validate K3s + GPU Operator + (on multi-node) high-speed links
- Low-risk capacity and scheduling checks before attempting heavy production jobs

## Purpose

- First validation workload on a new or changed cluster.
- Confirms K3s scheduling, GPU Operator device plugin, (on 2+ nodes) high-speed NCCL.
- Low enough footprint to run even on limited capacity.

## Key Safety Features

- Conservative `resources.requests` + `limits`
- `restartPolicy: OnFailure` + low `backoffLimit`
- `enforce-eager` mode for more predictable startup behavior
- Always run `stop` before reboot (see reboot-safety.md)

## Related

- kimi/ (full production)
- ray-head / ray-worker (for multi-node large models)
- start-test in manage.sh / models.sh
- Small `max-model-len`

## Usage

Deploy via the management script:

```bash
./scripts/manage.sh start-test
```

## Customization

1. Change `MODEL_NAME`
2. Adjust tensor-parallel-size to match available GPUs on your nodes
3. Increase memory limits only after monitoring

## Monitoring NCCL

```bash
kubectl logs job/kimi-test -n ai-inference -c inference | grep -i nccl
```

**Image/NCCL/hostNetwork**: Unified to v0.8.5 (see models-catalog). NCCL kept in sync with baseline. hostNetwork omitted (documented decision in job yaml + catalog for consistency w/ heavies).
