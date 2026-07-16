# GPU time-slicing (dual logical GPUs)

Opt-in ConfigMap for NVIDIA device plugin time-slicing with `replicas: 2`.

## When to use

Concurrent dual Qwen3.6 (or any two 1-GPU Jobs) on a single DGX Spark physical GPU.

## Apply

```bash
kubectl apply -k k8s/base/gpu-time-slicing
# Then reconfigure device plugin to use this ConfigMap (see Ansible gpu_operator role
# or NVIDIA docs: devicePlugin.config.name=time-slicing-config).
```

`start-qwen36-dual` applies the ConfigMap and checks allocatable GPU ≥ 2.

## Safety

- Default lab bootstrap leaves time-slicing **off** (`gpu_time_slicing_enabled: false`).
- Processes must split VRAM with `--gpu-memory-utilization` (do not run two jobs at 0.9 util).
