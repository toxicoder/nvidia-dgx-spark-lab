#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``get_inference_status_json``).

Invoked by shell as: ``python3 scripts/lib/py/models_get_inference_status_json.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from pathlib import Path

models = json.loads(sys.argv[1])
policy = json.loads(Path(sys.argv[2]).read_text())
ns = "ai-inference"
out = {"jobs": [], "namespace": ns}

model_meta = policy.get("models", {})

for model in models:
    job = model
    meta = model_meta.get(model, {})
    kind = meta.get("kind", "job")
    try:
        if kind == "deployment":
            data = json.loads(subprocess.check_output(
                ["kubectl", "get", "deployment", job, "-n", ns, "-o", "json"],
                stderr=subprocess.DEVNULL, timeout=5,
            ))
            ready = data.get("status", {}).get("readyReplicas") or 0
            out["jobs"].append({
                "model": model,
                "job": job,
                "active": ready,
                "state": "running" if ready > 0 else "absent",
                "kind": "deployment",
            })
        else:
            data = json.loads(subprocess.check_output(
                ["kubectl", "get", "job", job, "-n", ns, "-o", "json"],
                stderr=subprocess.DEVNULL, timeout=5,
            ))
            status = data.get("status", {})
            out["jobs"].append({
                "model": model,
                "job": job,
                "active": status.get("active", 0) or 0,
                "succeeded": status.get("succeeded", 0) or 0,
                "failed": status.get("failed", 0) or 0,
                "state": "running" if (status.get("active") or 0) > 0 else (
                    "succeeded" if (status.get("succeeded") or 0) > 0 else (
                        "failed" if (status.get("failed") or 0) > 0 else "absent"
                    )
                ),
                "kind": "job",
            })
    except subprocess.CalledProcessError:
        out["jobs"].append({
            "model": model,
            "job": job,
            "active": 0,
            "state": "absent",
            "kind": kind,
        })
    except Exception as e:
        out["jobs"].append({"model": model, "job": job, "state": "error", "error": str(e), "kind": kind})

print(json.dumps(out))
