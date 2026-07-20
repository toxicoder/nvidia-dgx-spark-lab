#!/usr/bin/env python3
"""Patch comfy/model_management.py get_free_memory for DGX Spark unified memory.

On GB10 unified memory, cudaMemGetInfo under-reports free VRAM when another
CUDA process holds allocations. ComfyUI then thrash-offloads models onto the
same physical RAM. Replace the free query with host available RAM.

Mounted via ConfigMap comfy-base-spark-patches at /patches/.
See: https://forums.developer.nvidia.com/t/comfyui-setup-optimized-for-dgx-spark/364846
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    """Apply single-line free-memory patch; idempotent if already applied."""
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/comfy-state/ComfyUI")
    path = root / "comfy" / "model_management.py"
    if not path.is_file():
        print(f"[spark-patch] skip: missing {path}", file=sys.stderr)
        return 0
    text = path.read_text(encoding="utf-8")
    marker = "LAB_SPARK_UNIFIED_MEMORY_PATCH"
    if marker in text:
        print("[spark-patch] already applied")
        return 0
    old = "mem_free_cuda, _ = torch.cuda.mem_get_info(dev)"
    # Keep assignment shape so callers still receive an int free-bytes value.
    new = (
        f"import psutil as _lab_psutil  # {marker}\n"
        f"        mem_free_cuda = _lab_psutil.virtual_memory().available  # {marker}"
    )
    if old not in text:
        # Alternate patterns seen in some ComfyUI revisions.
        alts = [
            "mem_free_total, mem_free_torch = torch.cuda.mem_get_info(dev)",
            "free_memory, total_memory = torch.cuda.mem_get_info(device)",
        ]
        for alt in alts:
            if alt in text:
                old = alt
                new = (
                    f"import psutil as _lab_psutil  # {marker}\n"
                    f"        mem_free_cuda = _lab_psutil.virtual_memory().available  # {marker}\n"
                    f"        mem_free_total = mem_free_cuda  # {marker}"
                )
                break
        else:
            print(
                "[spark-patch] WARNING: expected mem_get_info pattern not found; "
                "unified-memory patch skipped (ComfyUI version drift)",
                file=sys.stderr,
            )
            return 0
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"[spark-patch] applied unified-memory free-memory override to {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
