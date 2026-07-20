#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/monitoring.sh`` (``verify_scrape_targets``).

Invoked by shell as: ``python3 scripts/lib/py/monitoring_verify_scrape_targets.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys

pod, ns = sys.argv[1:3]
required_jobs = {"node-exporter", "kube-state-metrics", "prometheus"}

def _query(expr):
    try:
        out = subprocess.check_output([
            "kubectl", "exec", "-n", ns, pod, "--",
            "wget", "-qO-", f"http://localhost:9090/api/v1/query?query={expr}"
        ], text=True, stderr=subprocess.DEVNULL)
        return json.loads(out)
    except Exception:
        return {}

result = _query("up")
series = result.get("data", {}).get("result", [])
jobs_up = {}
for item in series:
    job = item.get("metric", {}).get("job", "")
    val = item.get("value", [None, "0"])[1]
    if val == "1":
        jobs_up[job] = jobs_up.get(job, 0) + 1

missing = sorted(required_jobs - set(jobs_up.keys()))
report = {
    "ok": len(missing) == 0,
    "jobsUp": jobs_up,
    "missingRequiredJobs": missing,
    "totalTargetsUp": sum(jobs_up.values()),
}
print(json.dumps(report))
