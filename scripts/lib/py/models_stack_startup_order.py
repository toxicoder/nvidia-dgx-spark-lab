#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/models.sh`` (``_stack_startup_order``).

Invoked by shell as: ``python3 scripts/lib/py/models_stack_startup_order.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
policy = json.loads(Path(sys.argv[1]).read_text())
stack = policy.get("stacks", {}).get(sys.argv[2], {})
order = stack.get("startup_order") or stack.get("stack_with", [])
print("\n".join(order))
