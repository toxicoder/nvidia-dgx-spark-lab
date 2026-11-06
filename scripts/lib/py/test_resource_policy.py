#!/usr/bin/env python3
"""Unit tests for resource_policy: quantity parsing, formatting, and every CLI verb.

These cover the Resource Guard maths that gates heavy GPU workload starts, so the
cases are chosen around refusal: a verdict the guard should not allow must not only
say ``ok: false`` but name the right reason and carry the totals the dashboard
renders. The CLI is exercised as a subprocess because argv parsing and the exit code
are part of the contract the shell layer depends on.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Final, cast

from lab_types import CapacityVerdict, ResourcePolicy
from resource_policy import (
    fmt_cpu,
    fmt_mem,
    load_policy,
    parse_cpu,
    parse_gpu,
    parse_memory,
)

_SCRIPT: Final = Path(__file__).with_name("resource_policy.py")

#: A policy small enough to reason about, with the shapes the real one uses.
_POLICY: Final[ResourcePolicy] = {
    "headroom": {
        "cpu_percent": 15,
        "memory_percent": 15,
        "memory_min_per_node": "24Gi",
        "cpu_min_per_node": "4",
    },
    "tiers": {
        "optional_dev": {
            "priority_class": "lab-optional",
            "namespaces": ["coder", "kasm"],
            "services": {
                "coder": {"namespace": "coder", "cpu": "2", "memory": "4Gi"},
                "kasm": {"namespace": "kasm", "cpu": "2", "memory": "4Gi"},
            },
        }
    },
    "models": {
        "kimi-test": {
            "gpus": 2,
            "cpu": "8",
            "memory": "32Gi",
            "heavy": False,
            "job_name": "kimi-test",
        },
        "kimi": {"gpus": 8, "cpu": "32", "memory": "128Gi", "heavy": True},
        "embed": {"gpus": 0, "cpu": "500m", "memory": "1Gi", "heavy": False},
        "glm": {"gpus": 1, "cpu": "8", "memory": "10Gi", "stack_with": ["embed"]},
    },
    "stacks": {
        "one-node": {
            "label": "One node stack",
            "min_nodes": 1,
            "max_nodes": 1,
            "heavy": True,
            "stack_with": ["embed"],
        },
        "two-node": {"min_nodes": 2, "max_nodes": 2, "heavy": False},
        "any-node": {"min_nodes": 1, "max_nodes": 4, "heavy": False},
        "open-ended": {"min_nodes": 1},
    },
}


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    """Run one ``resource_policy.py`` verb.

    Args:
        *args: Arguments after the script name, with the policy path already
            filled in as ``argv[2]``.

    Returns:
        The completed process, stdout and stderr captured as text.
    """
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(_POLICY, handle)
        policy_path = handle.name
    try:
        return subprocess.run(
            [sys.executable, str(_SCRIPT), args[0], policy_path, *args[1:]],
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        Path(policy_path).unlink(missing_ok=True)


def _json_out(*args: str) -> dict[str, object]:
    """Run a verb and parse its stdout as a JSON object.

    Args:
        *args: Arguments for :func:`_run`.

    Returns:
        The decoded payload.
    """
    result = _run(*args)
    decoded = cast("dict[str, object]", json.loads(result.stdout))
    return decoded


class ParseCpuTest(unittest.TestCase):
    """CPU quantities, including the ones that must not read as zero."""

    def test_suffix_and_bare_forms(self) -> None:
        self.assertEqual(parse_cpu("600m"), 0.6)
        self.assertEqual(parse_cpu("4"), 4.0)
        self.assertEqual(parse_cpu(4), 4.0)
        self.assertEqual(parse_cpu(2.5), 2.5)
        self.assertEqual(parse_cpu(" 2 "), 2.0)

    def test_absent_is_zero(self) -> None:
        self.assertEqual(parse_cpu(None), 0)
        self.assertEqual(parse_cpu(""), 0)
        self.assertEqual(parse_cpu("   "), 0)

    def test_non_numeric_raises_rather_than_reading_zero(self) -> None:
        # Zero means "nothing needed" to the guard, so a typo must not collapse into it.
        with self.assertRaises(ValueError):
            parse_cpu("eight")
        with self.assertRaises(ValueError):
            parse_cpu("600x")


class ParseMemoryTest(unittest.TestCase):
    """Memory quantities across the suffixes kubectl and the policy both use."""

    def test_binary_suffixes(self) -> None:
        self.assertEqual(parse_memory("1Ki"), 1024)
        self.assertEqual(parse_memory("640Mi"), 640 * 1024**2)
        self.assertEqual(parse_memory("24Gi"), 24 * 1024**3)
        self.assertEqual(parse_memory("1Ti"), 1024**4)

    def test_decimal_suffixes(self) -> None:
        self.assertEqual(parse_memory("1K"), 1000)
        self.assertEqual(parse_memory("1M"), 1000**2)
        self.assertEqual(parse_memory("1G"), 1000**3)
        self.assertEqual(parse_memory("1T"), 1000**4)

    def test_bare_and_absent(self) -> None:
        self.assertEqual(parse_memory("4096"), 4096)
        self.assertEqual(parse_memory(4096), 4096)
        self.assertEqual(parse_memory(None), 0)
        self.assertEqual(parse_memory(""), 0)

    def test_fractional_quantity(self) -> None:
        self.assertEqual(parse_memory("1.5Gi"), int(1.5 * 1024**3))

    def test_unknown_suffix_degrades_to_zero(self) -> None:
        # Memory has always tolerated an unrecognised shape by returning 0; the
        # guard's memory shortfall then comes from the other totals.
        self.assertEqual(parse_memory("24GiB"), 0)
        self.assertEqual(parse_memory("abc"), 0)


class ParseGpuTest(unittest.TestCase):
    """GPU counts."""

    def test_numbers_and_strings(self) -> None:
        self.assertEqual(parse_gpu(2), 2)
        self.assertEqual(parse_gpu("2"), 2)
        self.assertEqual(parse_gpu("2.0"), 2)

    def test_absent_is_zero(self) -> None:
        self.assertEqual(parse_gpu(None), 0)
        self.assertEqual(parse_gpu(""), 0)

    def test_non_numeric_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_gpu("two")


class FormatTest(unittest.TestCase):
    """The display formatters, which must round-trip back through the parsers."""

    def test_fmt_cpu_rounds_near_whole(self) -> None:
        self.assertEqual(fmt_cpu(12.0), "12")
        self.assertEqual(fmt_cpu(11.995), "12")
        self.assertEqual(fmt_cpu(0.6), "0.60")
        self.assertEqual(fmt_cpu(7.7), "7.70")

    def test_fmt_mem_picks_a_readable_unit(self) -> None:
        self.assertEqual(fmt_mem(24 * 1024**3), "24.0Gi")
        self.assertEqual(fmt_mem(640 * 1024**2), "640Mi")
        self.assertEqual(fmt_mem(512), "512B")

    def test_formatted_quantities_parse_back(self) -> None:
        self.assertEqual(parse_cpu(fmt_cpu(7.7)), 7.7)
        self.assertEqual(parse_memory(fmt_mem(24 * 1024**3)), 24 * 1024**3)


class LoadPolicyTest(unittest.TestCase):
    """Reading the policy file."""

    def test_reads_the_real_policy(self) -> None:
        real = Path(__file__).resolve().parents[3] / "config" / "resource-policy.json"
        if not real.exists():
            self.skipTest(f"{real} is not present")
        policy = load_policy(str(real))
        self.assertIn("models", policy)
        self.assertIn("stacks", policy)
        self.assertIn("kimi-test", policy.get("models", {}))


class ModelReqVerbTest(unittest.TestCase):
    """``model_req``: a model's own demand plus its declared companions."""

    def test_plain_model(self) -> None:
        payload = _json_out("model_req", "kimi-test")
        self.assertEqual(payload["gpus"], 2)
        self.assertEqual(payload["cpu"], 8.0)
        self.assertEqual(payload["memory"], 32 * 1024**3)
        self.assertFalse(payload["heavy"])
        self.assertEqual(payload["job_name"], "kimi-test")
        self.assertEqual(payload["stack_with"], [])

    def test_job_name_defaults_to_the_model_id(self) -> None:
        self.assertEqual(_json_out("model_req", "kimi")["job_name"], "kimi")

    def test_companions_are_summed_in(self) -> None:
        own = _json_out("model_req", "glm")
        self.assertEqual(own["gpus"], 1)
        self.assertEqual(own["cpu"], 8.5)  # glm 8 cores + embed 500m
        self.assertEqual(own["memory"], 10 * 1024**3 + 1 * 1024**3)  # glm 10Gi + embed 1Gi

    def test_unknown_model_errors_without_a_traceback(self) -> None:
        result = _run("model_req", "banana")
        self.assertEqual(_json_out("model_req", "banana"), {"error": "unknown model: banana"})
        self.assertNotIn("Traceback", result.stderr)


class StackReqVerbTest(unittest.TestCase):
    """``stack_req``: node bounds are always present, even as null."""

    def test_bounds_and_label(self) -> None:
        payload = _json_out("stack_req", "one-node")
        self.assertTrue(payload["heavy"])
        self.assertEqual(payload["min_nodes"], 1)
        self.assertEqual(payload["max_nodes"], 1)
        self.assertEqual(payload["label"], "One node stack")
        self.assertEqual(payload["stack_with"], ["embed"])

    def test_missing_bounds_are_null_not_absent(self) -> None:
        # The key is always emitted so a caller can read it unguarded; absent in the
        # policy means "no bound", which renders as null rather than being omitted.
        payload = _json_out("stack_req", "open-ended")
        self.assertIn("min_nodes", payload)
        self.assertEqual(payload["min_nodes"], 1)
        self.assertIn("max_nodes", payload)
        self.assertIsNone(payload["max_nodes"])

    def test_companion_demand_is_included(self) -> None:
        payload = _json_out("stack_req", "one-node")
        self.assertEqual(payload["cpu"], 0.5)
        self.assertEqual(payload["memory"], 1 * 1024**3)

    def test_label_defaults_to_the_stack_id(self) -> None:
        self.assertEqual(_json_out("stack_req", "two-node")["label"], "two-node")

    def test_unknown_stack_errors(self) -> None:
        self.assertEqual(
            _json_out("stack_req", "banana"), {"error": "unknown stack: banana"}
        )


class HeadroomVerbTest(unittest.TestCase):
    """``headroom``: the per-node floor beats the percentage on a small node."""

    def test_percentage_on_a_big_node(self) -> None:
        nodes = json.dumps([{"name": "spark", "allocatable": {"cpu": "40", "memory": "200Gi"}}])
        payload = _json_out("headroom", nodes)
        self.assertEqual(payload["cpu"], 6.0)
        self.assertEqual(payload["memory"], int(200 * 1024**3 * 0.15))

    def test_floor_wins_on_a_small_node(self) -> None:
        nodes = json.dumps([{"name": "spark", "allocatable": {"cpu": "4", "memory": "8Gi"}}])
        payload = _json_out("headroom", nodes)
        self.assertEqual(payload["cpu"], 4.0)
        self.assertEqual(payload["memory"], 24 * 1024**3)

    def test_totals_accumulate_over_nodes(self) -> None:
        one = {"name": "a", "allocatable": {"cpu": "40", "memory": "200Gi"}}
        payload = _json_out("headroom", json.dumps([one, one]))
        self.assertEqual(payload["cpu"], 12.0)
        self.assertEqual(payload["memory"], 2 * int(200 * 1024**3 * 0.15))


class CheckVerbTest(unittest.TestCase):
    """``check``: the verdict, the totals, and the exit code the shell branches on."""

    @staticmethod
    def _capacity(
        gpus: int,
        cpu: str,
        memory: str,
        node_count: int = 1,
    ) -> str:
        """Build the capacity JSON the shell hands in.

        Args:
            gpus: GPUs available after requests.
            cpu: Cores available, as a Kubernetes quantity.
            memory: Memory available, as a Kubernetes quantity.
            node_count: Nodes in the cluster.

        Returns:
            A JSON string for ``argv[3]``.
        """
        return json.dumps(
            {
                "node_count": node_count,
                "available": {"gpus": gpus, "cpu": cpu, "memory": memory},
            }
        )

    def test_model_that_fits_exits_zero(self) -> None:
        result = _run("check", self._capacity(2, "20", "100Gi"), "model:kimi-test")
        self.assertEqual(result.returncode, 0)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["verdict"], CapacityVerdict.OK.value)
        self.assertEqual(payload["required"], {"gpus": 2, "cpu": "8", "memory": "32.0Gi"})
        self.assertEqual(payload["deficit"], {})

    def test_gpu_shortfall_refuses_and_reports_the_gap(self) -> None:
        result = _run("check", self._capacity(2, "40", "200Gi"), "model:kimi")
        self.assertEqual(result.returncode, 1)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["verdict"], "insufficient_gpu")
        self.assertTrue(payload["heavy"])
        self.assertEqual(payload["deficit"], {"gpus": 6})

    def test_cpu_shortfall_refuses(self) -> None:
        result = _run("check", self._capacity(8, "4", "200Gi"), "model:kimi")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["verdict"], "insufficient_cpu")

    def test_memory_shortfall_refuses(self) -> None:
        result = _run("check", self._capacity(8, "40", "16Gi"), "model:kimi")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["verdict"], "insufficient_memory")

    def test_combined_shortfall_names_every_dimension(self) -> None:
        result = _run("check", self._capacity(0, "2", "8Gi"), "model:kimi")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(
            json.loads(result.stdout)["verdict"], "insufficient_gpu_cpu_memory"
        )

    def test_companion_demand_reaches_the_verdict(self) -> None:
        # glm needs 1 GPU / 8 CPU / 10Gi plus embed's 500m / 1Gi.
        roomy = json.loads(
            _run("check", self._capacity(2, "12", "20Gi"), "model:glm").stdout
        )
        self.assertTrue(roomy["ok"])
        self.assertEqual(roomy["required"]["cpu"], "8.50")
        self.assertEqual(roomy["required"]["memory"], "11.0Gi")

    def test_dev_service_uses_the_tier_reservation(self) -> None:
        payload = json.loads(
            _run("check", self._capacity(2, "20", "100Gi"), "dev:coder").stdout
        )
        self.assertEqual(payload["required"], {"gpus": 0, "cpu": "2", "memory": "4.0Gi"})
        self.assertTrue(payload["ok"])

    def test_unknown_model_is_not_an_infrastructure_error(self) -> None:
        result = _run("check", self._capacity(2, "20", "100Gi"), "model:banana")
        self.assertEqual(result.returncode, 1)
        payload = json.loads(result.stdout)
        self.assertEqual(
            payload,
            {"ok": False, "verdict": "unknown_model", "action": "model:banana"},
        )

    def test_unknown_stack_is_not_an_infrastructure_error(self) -> None:
        payload = json.loads(
            _run("check", self._capacity(2, "20", "100Gi"), "stack:banana").stdout
        )
        self.assertEqual(
            payload,
            {"ok": False, "verdict": "unknown_stack", "action": "stack:banana"},
        )

    def test_too_few_nodes_reports_a_node_deficit(self) -> None:
        result = _run("check", self._capacity(2, "20", "100Gi", node_count=1), "stack:two-node")
        self.assertEqual(result.returncode, 1)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["verdict"], "insufficient_nodes")
        self.assertEqual(payload["required"], {"nodes": 2})
        self.assertEqual(payload["available"], {"nodes": 1})
        self.assertEqual(payload["deficit"], {"nodes": 1})

    def test_too_many_nodes_refuses(self) -> None:
        payload = json.loads(
            _run(
                "check",
                self._capacity(2, "20", "100Gi", node_count=3),
                "stack:one-node",
            ).stdout
        )
        self.assertEqual(payload["verdict"], "too_many_nodes")

    def test_node_bounds_do_not_block_a_fitting_stack(self) -> None:
        payload = json.loads(
            _run(
                "check",
                self._capacity(2, "20", "100Gi", node_count=1),
                "stack:one-node",
            ).stdout
        )
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["required"]["cpu"], "0.50")

    def test_a_zero_capacity_snapshot_refuses(self) -> None:
        payload = json.loads(
            _run("check", self._capacity(0, "0", "0"), "model:kimi-test").stdout
        )
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["available"], {"gpus": 0, "cpu": "0.00", "memory": "0B"})


class LoadVerbTest(unittest.TestCase):
    """``load`` round-trips the policy, which is how the shell reads it."""

    def test_load_prints_the_policy(self) -> None:
        payload = _json_out("load")
        self.assertEqual(payload["headroom"], _POLICY["headroom"])
        models = cast("dict[str, object]", payload["models"])
        self.assertIn("kimi", models)


if __name__ == "__main__":
    unittest.main()
