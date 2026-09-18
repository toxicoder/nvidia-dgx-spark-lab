[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/mocks/fixtures](../README.md) / fakeVisualClusterCapacity

# Variable: fakeVisualClusterCapacity

> `const` **fakeVisualClusterCapacity**: [`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)

Defined in: [lib/mocks/fixtures.ts:273](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/mocks/fixtures.ts#L273)

Busy 2-node DGX Spark lab for Playwright goldens (VISUAL_TEST=1).
kimi-test (2 GPU) saturates the cluster; Coder + monitoring add CPU/RAM requests.
Numbers mirror `cluster-resources.sh status --json` output shape.
