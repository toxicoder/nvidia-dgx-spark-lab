# Qwen 3.5 397B Spark-2 (int4-AutoRound)

2-GPU vLLM + Ray job for `Intel/Qwen3.5-397B-A17B-int4-AutoRound`.

Substitutes for `nvidia/Qwen3.5-397B-A17B-NVFP4` on dual-Spark clusters. Proven ~26–30 tok/s on community dual-Spark setups.

## Requirements

- 2 GPUs, ~220 Gi memory total
- Ray head + worker running first
- vLLM `cu130-nightly` with transformers 5.x + Qwen3.5 AutoRound patch
- Weights at `/mnt/models`

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 397b-spark2
./scripts/manage.sh start-qwen3.5-397b-spark2
# or full stack:
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-2 --confirm yes
```