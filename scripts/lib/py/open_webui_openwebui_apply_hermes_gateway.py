#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/open-webui.sh`` (``openwebui_apply_hermes_gateway``).

Invoked by shell as: ``python3 scripts/lib/py/open_webui_openwebui_apply_hermes_gateway.py [args...]``.
"""
from __future__ import annotations

import sys, yaml
ip, port = sys.argv[1], int(sys.argv[2])
docs = [
    {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": "hermes-gateway",
            "namespace": "dev",
            "labels": {"app": "hermes-gateway", "lab.tier": "optional_dev"},
        },
        "spec": {
            "clusterIP": "None",
            "ports": [{"name": "http", "port": port, "targetPort": port, "protocol": "TCP"}],
            "selector": {},
        },
    },
    {
        "apiVersion": "v1",
        "kind": "Endpoints",
        "metadata": {
            "name": "hermes-gateway",
            "namespace": "dev",
            "labels": {"app": "hermes-gateway"},
        },
        "subsets": [
            {
                "addresses": [{"ip": ip}],
                "ports": [{"name": "http", "port": port, "protocol": "TCP"}],
            }
        ],
    },
]
for doc in docs:
    print("---")
    print(yaml.safe_dump(doc, sort_keys=False).rstrip())
