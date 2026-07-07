# Ray Worker

Ray worker nodes that join the head for distributed execution.

Started together with ray-head via the start-ray command.

See ray-head/README.md and the generated Shell reference for usage and safety notes.

**What's on this page**

- Ray worker Job + Service with modest resources for distributed compute
- How it pairs with ray-head, start command, links to head docs
- Role in enabling large-model TP/PP across nodes

**What this enables**

- Horizontal scaling of Ray cluster for memory/compute heavy inference jobs
- Clean separation of head coordination vs worker execution with proper labeling and resources

## Related

## NCCL High-Speed Settings

Inherits the same NCCL environment block as ray-head/kimi (see ray-head/README.md). Workers join the head over `ray-head:6379` with `hostNetwork: true` for dual-400G visibility.

## Safety notes (inherited from ray-head flow)
- restartPolicy OnFailure + low backoff.
- Always stop before reboot.
- (Fixed in this cleanup) Correctly-nested volumeMounts; service is client-only (outbound to ray-head:6379).