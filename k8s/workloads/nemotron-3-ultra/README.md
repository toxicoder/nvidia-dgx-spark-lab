# Nemotron-3-Ultra (Heavy Production)

Heavy NVFP4 model workload.

**What's on this page**

- Production Job for Nemotron-3-Ultra (8 GPU NVFP4) with explicit resources, OnFailure + backoff 1, high-speed NCCL
- Requirements, usage via manage.sh, safety and stop notes
- Relation to Ray + kimi-test pre-validation

**What this enables**

- Running a large FP4 expert model with proper resource isolation and interconnect config
- Safe scaling after lighter tests and Ray setup

## Requirements
- Validate with kimi-test + start-ray first.
- 2+ nodes strongly recommended.
- High GPU + host memory usage.

See manage.sh start-nemotron and the auto-generated reference for full details, safety, and resource profile.

Always stop before reboot (reboot-safety.md).

**Unified vLLM image**: now v0.8.5 (with kimi/kimi-test/glm); NCCL block aligned to kimi-test baseline. hostNetwork: true kept here (heavy ray case); see models-catalog.md + job.yaml for consistency notes.