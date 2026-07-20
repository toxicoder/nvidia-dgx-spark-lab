#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/visual.sh`` (``check_visual_unified_memory``).

Invoked by shell as: ``python3 scripts/lib/py/visual_check_visual_unified_memory.py [args...]``.
"""
from __future__ import annotations

import json, sys
from pathlib import Path
p = json.loads(Path(sys.argv[1]).read_text())
m = p.get("models", {}).get(sys.argv[2], {})
print(m.get("memory", ""))
