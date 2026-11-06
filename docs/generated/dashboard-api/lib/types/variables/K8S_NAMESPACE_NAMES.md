[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/types](../README.md) / K8S\_NAMESPACE\_NAMES

# Variable: K8S\_NAMESPACE\_NAMES

> `const` **K8S\_NAMESPACE\_NAMES**: readonly \[`"dev"`, `"ai-inference"`, `"monitoring"`, `"kube-system"`, `"gpu-operator"`\]

Defined in: [lib/types/index.ts:87](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/251ea82c918320a234a2cca075aed07473aeb1e3/dashboard/lib/types/index.ts#L87)

Kubernetes namespaces the dashboard is allowed to name or reach.

Source of truth for [K8sNamespaceName](../type-aliases/K8sNamespaceName.md) and for the namespace field of
`OpenWebUIBackendSchema` in `lib/services/cli-json.ts`.
