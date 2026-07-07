# Qwen 3.5 397B A17B NVFP4 (4-node)

4-node SGLang distributed deployment for `nvidia/Qwen3.5-397B-A17B-NVFP4` (~250 GB).

Requires spark0 (leader) + spark1..spark3 (workers), each with 1 GPU and ~115 Gi memory.

## Requirements

- 4× DGX Spark nodes with dual-400G interconnect
- SGLang `lmsysorg/sglang:v0.5.9`
- Weights at `/mnt/models` on all nodes

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 397b-nvfp4
./scripts/manage.sh start-qwen3.5-397b-nvfp4
# or full stack:
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-4 --confirm yes
```

On 1–2 node clusters, use `qwen-agentic-spark-1` or `qwen-agentic-spark-2` instead.