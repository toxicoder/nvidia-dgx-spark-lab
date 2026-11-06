#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/workspace-hermes.sh`` (``workspace_hermes_seed_data_dir``).

Invoked by shell as: ``python3 scripts/lib/py/workspace_hermes_workspace_hermes_seed_data_dir.py [args...]``.
"""
from __future__ import annotations

import re, subprocess, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
changed = False

def _ensure_key(name: str) -> str:
    """Make sure one ``KEY=value`` line carries a value.

    The updated text is also stored in the module-level ``text``/``changed``
    state so the caller can decide whether to rewrite the file.

    Args:
        name: Environment key to check in the ``.env`` text.

    Returns:
        The ``.env`` text, with a freshly generated secret written in when the
        key was missing or empty.
    """
    global changed, text
    m = re.search(rf'^{re.escape(name)}=(.*)$', text, re.M)
    if not m or not m.group(1).strip():
        val = subprocess.check_output(["openssl", "rand", "-hex", "32"], text=True).strip()
        if m:
            text = re.sub(rf'^{re.escape(name)}=.*$', f'{name}={val}', text, count=1, flags=re.M)
        else:
            text = text.rstrip() + f'\n{name}={val}\n'
        changed = True
    return text

for key in (
    "API_SERVER_KEY",
    "HERMES_DASHBOARD_BASIC_AUTH_SECRET",
    "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD",
):
    text = _ensure_key(key)

if changed:
    path.write_text(text)
