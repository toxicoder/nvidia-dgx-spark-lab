#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/monitoring.sh`` (``verify_scrape_targets``).

Invoked by shell as: ``python3 scripts/lib/py/monitoring_verify_scrape_targets.py [args...]``.
"""
from __future__ import annotations

import json, subprocess, sys
from typing import TypedDict, cast

pod, ns = sys.argv[1:3]
required_jobs = {"node-exporter", "kube-state-metrics", "prometheus"}


class _Sample(TypedDict, total=False):
    """One ``up`` series returned by the Prometheus query API."""

    metric: dict[str, str]
    value: list[object]


class _QueryData(TypedDict, total=False):
    """``data`` block of a Prometheus instant-query response."""

    result: list[_Sample]


class _QueryResult(TypedDict, total=False):
    """Prometheus instant-query response."""

    data: _QueryData


def _query(expr: str) -> _QueryResult:
    """Run an instant query against Prometheus inside the pod.

    Args:
        expr: PromQL expression to evaluate.

    Returns:
        The decoded Prometheus response, or an empty mapping when the query
        cannot be executed or decoded.
    """
    try:
        out = subprocess.check_output([
            "kubectl", "exec", "-n", ns, pod, "--",
            "wget", "-qO-", f"http://localhost:9090/api/v1/query?query={expr}"
        ], text=True, stderr=subprocess.DEVNULL)
        return cast(_QueryResult, json.loads(out))
    except Exception:
        return {}

result = _query("up")
series = result.get("data", {}).get("result", [])
jobs_up: dict[str, int] = {}
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
