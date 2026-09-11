# MedGemma 4B sidecar (optional)

Cheap labs/EHR/vision extract path. **Not** the primary medical model.

- Checkpoint: `google/medgemma-1.5-4b-it` (NF4-blackwell builds are optional if they load on sm_121)
- Alias: `lab-med-extract`
- Off by default. Enable only after Resource Guard says spark2 (or spark0) still has headroom **after** the primary Job
- Never treat 4B as the only medical model
- Same HAI-DEF / not-a-medical-device rules as MedGemma 27B
