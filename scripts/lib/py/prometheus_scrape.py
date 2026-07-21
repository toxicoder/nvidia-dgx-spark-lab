#!/usr/bin/env python3
"""Generate Prometheus scrape ConfigMap and pure prometheus.yml for the lab.

Writes:
  - ``prometheus.yml`` (language-native scrape config)
  - ``prometheus-scrape-config.yaml`` (ConfigMap with literal-block data)

Invoked by ``scripts/lib/monitoring.sh`` via ``monitoring_generate_prometheus_scrape_config``.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


def load_yaml(path: str) -> dict[str, Any]:
    """Load a YAML mapping from ``path`` (empty dict if PyYAML is missing)."""
    text = Path(path).read_text(encoding="utf-8")
    if yaml:
        data = yaml.safe_load(text) or {}
        return data if isinstance(data, dict) else {}
    return {}


def build_scrape_configs(policy: dict[str, Any], spark0_ip: str) -> list[dict[str, Any]]:
    """Build Prometheus scrape_configs from monitoring-probes policy."""
    scrape_configs: list[dict[str, Any]] = [
        {
            "job_name": "prometheus",
            "static_configs": [{"targets": ["localhost:9090"]}],
        },
        {
            "job_name": "node-exporter",
            "kubernetes_sd_configs": [
                {"role": "endpoints", "namespaces": {"names": ["monitoring"]}}
            ],
            "relabel_configs": [
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "regex": "node-exporter-prometheus-node-exporter",
                    "action": "keep",
                },
                {
                    "source_labels": ["__meta_kubernetes_endpoint_port_name"],
                    "regex": "metrics",
                    "action": "keep",
                },
                {
                    "source_labels": ["__meta_kubernetes_pod_node_name"],
                    "target_label": "node",
                },
            ],
        },
        {
            "job_name": "dcgm",
            "kubernetes_sd_configs": [
                {"role": "endpoints", "namespaces": {"names": ["gpu-operator"]}}
            ],
            "relabel_configs": [
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "regex": "nvidia-dcgm-exporter",
                    "action": "keep",
                },
                {
                    "source_labels": ["__meta_kubernetes_pod_node_name"],
                    "target_label": "node",
                },
            ],
        },
        {
            "job_name": "kube-state-metrics",
            "kubernetes_sd_configs": [
                {"role": "endpoints", "namespaces": {"names": ["monitoring"]}}
            ],
            "relabel_configs": [
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "regex": "kube-state-metrics",
                    "action": "keep",
                },
            ],
        },
        {
            "job_name": "kubernetes-pods-annotated",
            "kubernetes_sd_configs": [{"role": "pod"}],
            "relabel_configs": [
                {
                    "source_labels": [
                        "__meta_kubernetes_pod_annotation_prometheus_io_scrape"
                    ],
                    "regex": "true",
                    "action": "keep",
                },
                {
                    "source_labels": [
                        "__meta_kubernetes_pod_annotation_prometheus_io_path"
                    ],
                    "target_label": "__metrics_path__",
                    "regex": "(.+)",
                },
                {
                    "source_labels": [
                        "__address__",
                        "__meta_kubernetes_pod_annotation_prometheus_io_port",
                    ],
                    "regex": "([^:]+)(?::\\d+)?;(\\d+)",
                    "replacement": "$1:$2",
                    "target_label": "__address__",
                },
                {
                    "source_labels": ["__meta_kubernetes_namespace"],
                    "target_label": "namespace",
                },
                {
                    "source_labels": ["__meta_kubernetes_pod_name"],
                    "target_label": "pod",
                },
                {
                    "source_labels": ["__meta_kubernetes_pod_label_app"],
                    "target_label": "app",
                },
            ],
        },
        {
            "job_name": "kubernetes-services-annotated",
            "kubernetes_sd_configs": [{"role": "service"}],
            "relabel_configs": [
                {
                    "source_labels": [
                        "__meta_kubernetes_service_annotation_prometheus_io_scrape"
                    ],
                    "regex": "true",
                    "action": "keep",
                },
                {
                    "source_labels": [
                        "__meta_kubernetes_service_annotation_prometheus_io_path"
                    ],
                    "target_label": "__metrics_path__",
                    "regex": "(.+)",
                },
                {
                    "source_labels": [
                        "__address__",
                        "__meta_kubernetes_service_annotation_prometheus_io_port",
                    ],
                    "regex": "([^:]+)(?::\\d+)?;(\\d+)",
                    "replacement": "$1:$2",
                    "target_label": "__address__",
                },
                {
                    "source_labels": ["__meta_kubernetes_namespace"],
                    "target_label": "namespace",
                },
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "target_label": "service",
                },
            ],
        },
        {
            "job_name": "traefik",
            "kubernetes_sd_configs": [
                {"role": "endpoints", "namespaces": {"names": ["traefik"]}}
            ],
            "relabel_configs": [
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "regex": "traefik",
                    "action": "keep",
                },
                {
                    "source_labels": ["__meta_kubernetes_endpoint_port_name"],
                    "regex": "metrics",
                    "action": "keep",
                },
            ],
        },
        {
            "job_name": "ray-head",
            "kubernetes_sd_configs": [
                {"role": "service", "namespaces": {"names": ["ai-inference"]}}
            ],
            "metrics_path": "/metrics",
            "relabel_configs": [
                {
                    "source_labels": ["__meta_kubernetes_service_name"],
                    "regex": "ray-head",
                    "action": "keep",
                },
            ],
        },
    ]

    blackbox = (
        "blackbox-exporter-prometheus-blackbox-exporter.monitoring.svc.cluster.local:9115"
    )

    cluster_targets = [
        f"{probe['service']}.{probe['namespace']}.svc.cluster.local:{probe['port']}"
        for probe in policy.get("cluster_probes", [])
    ]
    if cluster_targets:
        scrape_configs.append(
            {
                "job_name": "blackbox-cluster",
                "metrics_path": "/probe",
                "params": {"module": ["http_2xx"]},
                "static_configs": [
                    {"targets": cluster_targets, "labels": {"probe_type": "cluster"}}
                ],
                "relabel_configs": [
                    {"source_labels": ["__address__"], "target_label": "__param_target"},
                    {"source_labels": ["__param_target"], "target_label": "instance"},
                    {"target_label": "__address__", "replacement": blackbox},
                ],
            }
        )

    inf = policy.get("inference_probes", {})
    inf_ns = inf.get("namespace", "ai-inference")
    inf_port = inf.get("port", 8000)
    inf_targets = [
        f"{svc}.{inf_ns}.svc.cluster.local:{inf_port}" for svc in inf.get("services", [])
    ]
    if inf_targets:
        scrape_configs.append(
            {
                "job_name": "blackbox-inference",
                "metrics_path": "/probe",
                "params": {"module": ["http_2xx"]},
                "static_configs": [
                    {"targets": inf_targets, "labels": {"probe_type": "inference"}}
                ],
                "relabel_configs": [
                    {"source_labels": ["__address__"], "target_label": "__param_target"},
                    {"source_labels": ["__param_target"], "target_label": "instance"},
                    {"target_label": "__address__", "replacement": blackbox},
                ],
            }
        )

    mcp_targets = [f"{spark0_ip}:{p['port']}" for p in policy.get("mcp_nodeport_probes", [])]
    if mcp_targets:
        scrape_configs.append(
            {
                "job_name": "blackbox-mcp",
                "metrics_path": "/probe",
                "params": {"module": ["http_2xx"]},
                "static_configs": [
                    {"targets": mcp_targets, "labels": {"probe_type": "mcp"}}
                ],
                "relabel_configs": [
                    {"source_labels": ["__address__"], "target_label": "__param_target"},
                    {"source_labels": ["__param_target"], "target_label": "instance"},
                    {"target_label": "__address__", "replacement": blackbox},
                ],
            }
        )

    host_targets = [
        probe["url"].replace("{{SPARK0_IP}}", spark0_ip)
        for probe in policy.get("host_probes", [])
    ]
    if host_targets:
        scrape_configs.append(
            {
                "job_name": "blackbox-host",
                "metrics_path": "/probe",
                "params": {"module": ["http_2xx"]},
                "static_configs": [
                    {"targets": host_targets, "labels": {"probe_type": "host"}}
                ],
                "relabel_configs": [
                    {"source_labels": ["__address__"], "target_label": "__param_target"},
                    {"source_labels": ["__param_target"], "target_label": "instance"},
                    {"target_label": "__address__", "replacement": blackbox},
                ],
            }
        )

    return scrape_configs


def dump_yaml_literal(doc: Any) -> str:
    """Serialize YAML using literal block style for multi-line strings."""
    if yaml is None:
        return str(doc)

    def _str_presenter(dumper: Any, data: str) -> Any:
        if "\n" in data:
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
        return dumper.represent_scalar("tag:yaml.org,2002:str", data)

    # Local Dumper so we do not mutate global state across imports.
    class _LiteralDumper(yaml.SafeDumper):
        pass

    _LiteralDumper.add_representer(str, _str_presenter)
    return yaml.dump(
        doc,
        Dumper=_LiteralDumper,
        default_flow_style=False,
        sort_keys=False,
        allow_unicode=True,
    )


def main(argv: list[str] | None = None) -> int:
    """CLI: probes_path spark0_ip out_prometheus_yml_or_configmap_path.

    Writes language-native ``prometheus.yml`` next to (or as) the out path.
    ConfigMap is materialised by ``k8s/monitoring/kustomization.yaml``.
    """
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 3:
        print(
            "usage: prometheus_scrape.py <probes.yaml> <spark0_ip> <out-path>",
            file=sys.stderr,
        )
        return 2
    probes_path, spark0_ip, out_file = args
    policy = load_yaml(probes_path)
    prometheus_yml = {
        "global": {"scrape_interval": "30s", "evaluation_interval": "30s"},
        "scrape_configs": build_scrape_configs(policy, spark0_ip),
    }

    out_path = Path(out_file)
    if out_path.name.endswith(".yaml") and out_path.name != "prometheus.yml":
        pure_path = out_path.with_name("prometheus.yml")
    else:
        pure_path = out_path if out_path.suffix in {".yml", ".yaml"} else out_path / "prometheus.yml"

    if yaml:
        pure_body = yaml.dump(
            prometheus_yml, default_flow_style=False, sort_keys=False, allow_unicode=True
        )
    else:
        pure_body = str(prometheus_yml)
    pure_header = (
        "# Purpose: Prometheus scrape configuration (language-native YAML)\n"
        "# Source of truth: config/monitoring-probes.yaml via prometheus_scrape.py\n"
        "# Regenerate: monitoring-stack.sh or manage.sh start-monitoring\n"
        "# Safety: read-only scrape targets; no cluster credentials\n\n"
    )
    pure_header = pure_header.encode().decode("unicode_escape")
    pure_path.parent.mkdir(parents=True, exist_ok=True)
    pure_path.write_text(pure_header + pure_body, encoding="utf-8")
    legacy_cm = pure_path.with_name("prometheus-scrape-config.yaml")
    if legacy_cm.is_file():
        legacy_cm.unlink()
    print(str(pure_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
