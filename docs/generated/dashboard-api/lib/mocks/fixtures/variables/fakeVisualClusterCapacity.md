[**dgx-lab-dashboard**](../../../../README.md)

***

[dgx-lab-dashboard](../../../../README.md) / [lib/mocks/fixtures](../README.md) / fakeVisualClusterCapacity

# Variable: fakeVisualClusterCapacity

> `const` **fakeVisualClusterCapacity**: [`ClusterCapacity`](../../../types/interfaces/ClusterCapacity.md)

Defined in: lib/mocks/fixtures.ts:273

Busy 2-node DGX Spark lab for Playwright goldens (VISUAL_TEST=1).
kimi-test (2 GPU) saturates the cluster; Coder + monitoring add CPU/RAM requests.
Numbers mirror `cluster-resources.sh status --json` output shape.
