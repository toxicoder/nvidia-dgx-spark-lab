#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``stop_nemotron_stack``).

Invoked by shell as: ``python3 scripts/lib/py/models_stop_nemotron_stack.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
policy = json.loads(Path(sys.argv[1]).read_text())
names = set()
for stack in policy.get("stacks", {}).values():
    for m in stack.get("stack_with", []):
        names.add(m)
for n in sorted(names):
    print(n)
