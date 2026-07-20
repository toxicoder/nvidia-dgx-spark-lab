#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/resources.sh`` (``_resource_python``).

Invoked by shell as: ``python3 scripts/lib/py/resource_policy.py [args...]``.
"""
from __future__ import annotations

import json, re, sys
from pathlib import Path

def _load_policy(path):
    return json.loads(Path(path).read_text())

def _parse_quantity(val, kind):
    if val is None:
        return 0
    s = str(val).strip()
    if not s:
        return 0
    if kind == "gpu":
        return int(float(s))
    if kind == "cpu":
        if s.endswith("m"):
            return int(s[:-1]) / 1000.0
        return float(s)
    if kind == "memory":
        m = re.match(r"^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$", s)
        if not m:
            return 0
        num = float(m.group(1))
        unit = m.group(2) or ""
        mult = {"Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4,
                "K": 1000, "M": 1000**2, "G": 1000**3, "T": 1000**4}.get(unit, 1)
        return int(num * mult)
    return 0

def _fmt_cpu(cores):
    if cores >= 1 and abs(cores - round(cores)) < 0.01:
        return str(int(round(cores)))
    return f"{cores:.2f}"

def _fmt_mem(b):
    if b >= 1024**3:
        return f"{b / 1024**3:.1f}Gi"
    if b >= 1024**2:
        return f"{int(b / 1024**2)}Mi"
    return f"{b}B"

cmd = sys.argv[1]
policy_path = sys.argv[2]

if cmd == "load":
    print(json.dumps(_load_policy(policy_path)))
elif cmd == "model_req":
    policy = _load_policy(policy_path)
    model = sys.argv[3]
    m = policy.get("models", {}).get(model)
    if not m:
        print(json.dumps({"error": f"unknown model: {model}"}))
        sys.exit(1)
    req = {
        "gpus": int(m.get("gpus", 0)),
        "cpu": _parse_quantity(m.get("cpu", 0), "cpu"),
        "memory": _parse_quantity(m.get("memory", 0), "memory"),
        "heavy": bool(m.get("heavy", False)),
        "job_name": m.get("job_name", model),
        "stack_with": m.get("stack_with", []),
    }
    for extra in req["stack_with"]:
        em = policy.get("models", {}).get(extra, {})
        req["gpus"] += int(em.get("gpus", 0))
        req["cpu"] += _parse_quantity(em.get("cpu", 0), "cpu")
        req["memory"] += _parse_quantity(em.get("memory", 0), "memory")
    print(json.dumps(req))
elif cmd == "headroom":
    policy = _load_policy(policy_path)
    nodes_json = sys.argv[3]
    nodes = json.loads(nodes_json)
    h = policy.get("headroom", {})
    pct_cpu = float(h.get("cpu_percent", 15)) / 100.0
    pct_mem = float(h.get("memory_percent", 15)) / 100.0
    min_mem = _parse_quantity(h.get("memory_min_per_node", "64Gi"), "memory")
    min_cpu = _parse_quantity(h.get("cpu_min_per_node", "4"), "cpu")
    total_cpu = 0.0
    total_mem = 0
    for n in nodes:
        alloc = n.get("allocatable", {})
        cpu = _parse_quantity(alloc.get("cpu", 0), "cpu")
        mem = _parse_quantity(alloc.get("memory", 0), "memory")
        total_cpu += max(min_cpu, cpu * pct_cpu)
        total_mem += max(min_mem, int(mem * pct_mem))
    print(json.dumps({"cpu": total_cpu, "memory": total_mem}))
elif cmd == "stack_req":
    policy = _load_policy(policy_path)
    stack_id = sys.argv[3]
    stack = policy.get("stacks", {}).get(stack_id)
    if not stack:
        print(json.dumps({"error": f"unknown stack: {stack_id}"}))
        sys.exit(1)
    req = {"gpus": 0, "cpu": 0.0, "memory": 0, "heavy": bool(stack.get("heavy", False)),
           "stack_with": stack.get("stack_with", []), "min_nodes": stack.get("min_nodes"),
           "max_nodes": stack.get("max_nodes"), "label": stack.get("label", stack_id)}
    for name in stack.get("stack_with", []):
        m = policy.get("models", {}).get(name, {})
        req["gpus"] += int(m.get("gpus", 0))
        req["cpu"] += _parse_quantity(m.get("cpu", 0), "cpu")
        req["memory"] += _parse_quantity(m.get("memory", 0), "memory")
    print(json.dumps(req))
elif cmd == "check":
    policy = _load_policy(policy_path)
    capacity = json.loads(sys.argv[3])
    action = sys.argv[4]
    model = action.split(":", 1)[1] if action.startswith("model:") else None
    stack_id = action.split(":", 1)[1] if action.startswith("stack:") else None
    required = {"gpus": 0, "cpu": 0.0, "memory": 0}
    heavy = False
    node_count = int(capacity.get("node_count", 0) or 0)
    if stack_id:
        stack = policy.get("stacks", {}).get(stack_id)
        if not stack:
            print(json.dumps({"ok": False, "verdict": "unknown_stack", "action": action}))
            sys.exit(1)
        min_n = stack.get("min_nodes")
        max_n = stack.get("max_nodes")
        if min_n is not None and node_count < int(min_n):
            print(json.dumps({"ok": False, "verdict": "insufficient_nodes",
                              "action": action, "heavy": bool(stack.get("heavy", False)),
                              "required": {"nodes": min_n}, "available": {"nodes": node_count},
                              "deficit": {"nodes": int(min_n) - node_count}}))
            sys.exit(1)
        if max_n is not None and node_count > int(max_n):
            print(json.dumps({"ok": False, "verdict": "too_many_nodes",
                              "action": action, "heavy": bool(stack.get("heavy", False)),
                              "required": {"nodes": max_n}, "available": {"nodes": node_count},
                              "deficit": {}}))
            sys.exit(1)
        heavy = bool(stack.get("heavy", False))
        for name in stack.get("stack_with", []):
            m = policy.get("models", {}).get(name, {})
            required["gpus"] += int(m.get("gpus", 0))
            required["cpu"] += _parse_quantity(m.get("cpu", 0), "cpu")
            required["memory"] += _parse_quantity(m.get("memory", 0), "memory")
    elif model:
        m = policy.get("models", {}).get(model)
        if not m:
            print(json.dumps({"ok": False, "verdict": "unknown_model", "action": action}))
            sys.exit(1)
        required["gpus"] = int(m.get("gpus", 0))
        required["cpu"] = _parse_quantity(m.get("cpu", 0), "cpu")
        required["memory"] = _parse_quantity(m.get("memory", 0), "memory")
        heavy = bool(m.get("heavy", False))
        for extra in m.get("stack_with", []):
            em = policy.get("models", {}).get(extra, {})
            required["gpus"] += int(em.get("gpus", 0))
            required["cpu"] += _parse_quantity(em.get("cpu", 0), "cpu")
            required["memory"] += _parse_quantity(em.get("memory", 0), "memory")
    elif action.startswith("dev:"):
        svc = action.split(":", 1)[1]
        s = policy.get("tiers", {}).get("optional_dev", {}).get("services", {}).get(svc, {})
        required["cpu"] = _parse_quantity(s.get("cpu", 0), "cpu")
        required["memory"] = _parse_quantity(s.get("memory", 0), "memory")
    avail = capacity.get("available", {})
    avail_gpus = int(avail.get("gpus", 0) or 0)
    avail_cpu = _parse_quantity(avail.get("cpu", 0), "cpu")
    avail_mem = _parse_quantity(avail.get("memory", 0), "memory")
    deficit = {}
    ok = True
    verdict = "ok"
    if required["gpus"] > avail_gpus:
        ok = False
        verdict = "insufficient_gpu"
        deficit["gpus"] = required["gpus"] - avail_gpus
    if required["cpu"] > avail_cpu:
        ok = False
        verdict = "insufficient_cpu" if verdict == "ok" else verdict + "_cpu"
        deficit["cpu"] = round(required["cpu"] - avail_cpu, 2)
    if required["memory"] > avail_mem:
        ok = False
        verdict = "insufficient_memory" if verdict == "ok" else verdict + "_memory"
        deficit["memory"] = required["memory"] - avail_mem
    out = {
        "ok": ok,
        "verdict": verdict if ok else verdict,
        "action": action,
        "heavy": heavy,
        "required": {
            "gpus": required["gpus"],
            "cpu": _fmt_cpu(required["cpu"]),
            "memory": _fmt_mem(required["memory"]),
        },
        "available": {
            "gpus": avail_gpus,
            "cpu": _fmt_cpu(avail_cpu),
            "memory": _fmt_mem(avail_mem),
        },
        "deficit": {
            k: (v if k != "memory" else _fmt_mem(v)) for k, v in deficit.items()
        },
    }
    print(json.dumps(out))
    sys.exit(0 if ok else 1)
