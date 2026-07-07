# Qwen 3.5 122B A10B NVFP4 (1-node substitute)

1-GPU vLLM job for `RedHatAI/Qwen3.5-122B-A10B-NVFP4` (~75 GB).

Substitutes for `nvidia/Qwen3.5-397B-A17B-NVFP4` on single-Spark clusters where the 397B checkpoint cannot fit.

## Requirements

- 1 GPU, ~95 Gi memory
- vLLM `cu130-nightly` + transformers 5.x (see [eugr/spark-vllm-docker](https://github.com/eugr/spark-vllm-docker))
- Weights at `/mnt/models`

## Usage

```bash
bazelisk run //scripts:run-utility -- download-qwen-models run --tier 122b
bazelisk run //scripts:run-utility -- nemotron-stack start qwen-agentic-spark-1 --confirm yes
```