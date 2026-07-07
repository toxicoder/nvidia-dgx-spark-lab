# lab-dashboard Helm Chart

Thin Helm chart for the custom Next.js Spark Lab dashboard (Tasks, Storage Treemap, Machine State).

## Usage (Bazel or direct)

```bash
# After building image (see dashboard/Dockerfile)
helm upgrade --install lab-dashboard ./helm/lab-dashboard \
  -n dev --create-namespace \
  --set image.tag=local \
  --set service.nodePort=32082
```

Values come from group_vars or --set. See values.yaml.

This replaces direct kubectl apply for the dashboard component (consistent with Coder/Kasm/Grafana which already use Helm).

Core inference workloads (kimi etc.) remain as explicit YAML + kustomize for safety (resources, OnFailure, low backoff).

## Development

- Update values for resources/ports.
- Template uses standard helpers.
- To render: helm template lab-dashboard ./helm/lab-dashboard -n dev

See scripts/lib/dev.sh and ansible roles for how manage.sh / ansible invoke it.