#!/usr/bin/env python3
"""Unit tests for resources_suggest_free_resources: probes and the suggestion list.

The suggestion list is what the capacity gate offers an operator when the Resource
Guard refuses a start, so the cases here hold two things: a row is only offered when
the workload really is running, and the frees map keeps the mixed value kinds the
dashboard renders (``0``, ``"all"``, ``"approx"``). The probes are exercised against
fake ``helm``/``kubectl`` executables so the real subprocess path is covered too.
"""

from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from collections.abc import Callable
from pathlib import Path
from typing import Final, cast
from unittest import mock

from lab_types import FreeResourceSuggestion, ResourcePolicy
from resources_suggest_free_resources import (
    DEFAULT_JOB_NAMESPACE,
    _gpu_frees,
    _skeleton,
    applicable_suggestions,
    helm_release_running,
    job_active,
)

_POLICY: Final[ResourcePolicy] = {
    "free_actions": [
        {
            "id": "stop-coder",
            "action": "dev:coder",
            "label": "Stop Coder workspaces",
            "reversible": True,
            "impact": "Frees VS Code dev environments",
        },
        {
            "id": "stop-kasm",
            "action": "dev:kasm",
            "label": "Stop Kasm desktops",
            "reversible": True,
            "impact": "Frees streamed desktops",
        },
        {
            "id": "stop-an-unlisted-dev",
            "action": "dev:somethingelse",
            "label": "An unlisted dev service",
            "reversible": True,
            "impact": "Unknown",
        },
        {
            "id": "stop-kimi-test",
            "action": "stop-job:kimi-test",
            "label": "Stop kimi-test job",
            "reversible": True,
            "impact": "Frees 2 GPUs",
        },
        {
            "id": "stop-ray",
            "action": "stop-job:ray-head,ray-worker",
            "label": "Stop Ray cluster",
            "reversible": True,
            "impact": "Frees Ray GPUs",
        },
        {
            "id": "stop-inference-all",
            "action": "stop-inference",
            "label": "Stop all inference jobs",
            "reversible": True,
            "impact": "Stops everything in ai-inference",
        },
        {
            "id": "stop-junk",
            "action": "stop-junk:thing",
            "label": "Shares the stop-j prefix",
            "reversible": True,
            "impact": "Not a Job action",
        },
        {
            "id": "stop-stack-mcp",
            "action": "stop-stack:mcp",
            "label": "Stop MCP toolkit",
            "reversible": True,
            "impact": "Stops agent-tools",
        },
    ]
}


def _nothing_running(_namespace: str, _release: str) -> bool:
    """A Helm probe that finds nothing.

    Args:
        _namespace: Ignored.
        _release: Ignored.

    Returns:
        Always ``False``.
    """
    return False


def _no_jobs(_job: str) -> bool:
    """A Job probe that finds nothing.

    Args:
        _job: Ignored.

    Returns:
        Always ``False``.
    """
    return False


def _all_running(_namespace: str, _release: str) -> bool:
    """A Helm probe that finds everything.

    Args:
        _namespace: Ignored.
        _release: Ignored.

    Returns:
        Always ``True``.
    """
    return True


def _all_jobs(_job: str) -> bool:
    """A Job probe that finds everything.

    Args:
        _job: Ignored.

    Returns:
        Always ``True``.
    """
    return True


def _rows(
    helm_running: Callable[[str, str], bool] = _all_running,
    job_running: Callable[[str], bool] = _all_jobs,
) -> dict[str, FreeResourceSuggestion]:
    """Run the selector and index the result by action token.

    Args:
        helm_running: Helm probe to inject.
        job_running: Job probe to inject.

    Returns:
        The applicable rows, keyed by their ``action``.
    """
    rows = applicable_suggestions(_POLICY, helm_running, job_running)
    return {row["action"]: row for row in rows}


#: The frees map one active non-Ray Job reports.
_JOB_FREES: Final[dict[str, str | int]] = {"gpus": 2, "memory": "16Gi", "gpus_note": "approx"}


def _write_fake_bin(directory: Path, name: str, body: str) -> None:
    """Write an executable stub into ``directory``.

    Args:
        directory: Directory to write into.
        name: Executable name.
        body: Script body.
    """
    path = directory / name
    path.write_text(f"#!/usr/bin/env bash\n{body}\n")
    path.chmod(path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


class SkeletonTest(unittest.TestCase):
    """The default row a policy action becomes before any probe."""

    def test_defaults_when_the_policy_entry_is_sparse(self) -> None:
        row = _skeleton({"action": "dev:coder"})
        self.assertEqual(row["id"], "")
        self.assertEqual(row["label"], "")
        self.assertEqual(row["action"], "dev:coder")
        self.assertTrue(row["reversible"])
        self.assertEqual(row["impact"], "")
        self.assertFalse(row["applicable"])
        self.assertEqual(row["frees"], {})

    def test_label_defaults_to_the_id(self) -> None:
        self.assertEqual(_skeleton({"id": "stop-coder"})["label"], "stop-coder")


class GpuFreesTest(unittest.TestCase):
    """The Job estimate, including the Ray multiplier."""

    def test_plain_job_estimate(self) -> None:
        self.assertEqual(_gpu_frees(1, "stop-job:kimi-test"), _JOB_FREES)

    def test_ray_job_reserves_four_each(self) -> None:
        self.assertEqual(
            _gpu_frees(2, "stop-job:ray-head,ray-worker"),
            {"gpus": 8, "memory": "16Gi", "gpus_note": "approx"},
        )


class ApplicableSuggestionsTest(unittest.TestCase):
    """Which policy actions get offered, and with what frees map."""

    def test_nothing_running_offers_only_the_unconditional_action(self) -> None:
        rows = _rows(_nothing_running, _no_jobs)
        self.assertEqual(list(rows), ["stop-inference"])

    def test_coder_offers_a_cpu_and_memory_row(self) -> None:
        rows = _rows(_nothing_running, _no_jobs)
        self.assertNotIn("dev:coder", rows)
        rows = _rows(lambda ns, rel: ns == "coder" and rel == "coder", _no_jobs)
        self.assertEqual(rows["dev:coder"]["frees"], {"cpu": "2", "memory": "4Gi", "gpus": 0})
        self.assertEqual(rows["dev:coder"]["id"], "stop-coder")
        self.assertTrue(rows["dev:coder"]["applicable"])

    def test_kasm_is_probed_in_its_own_namespace(self) -> None:
        seen: list[tuple[str, str]] = []

        def probe(namespace: str, release: str) -> bool:
            seen.append((namespace, release))
            return False

        applicable_suggestions(_POLICY, probe, _no_jobs)
        self.assertIn(("kasm", "kasm"), seen)

    def test_an_unlisted_dev_suffix_is_never_offered(self) -> None:
        # The selector knows coder and kasm by name; a new dev:* token must not be
        # assumed safe to stop just because it shares the prefix.
        rows = _rows(_all_running, _all_jobs)
        self.assertNotIn("dev:somethingelse", rows)

    def test_stop_job_requires_an_active_job(self) -> None:
        rows = _rows(_nothing_running, lambda job: job == "kimi-test")
        self.assertEqual(rows["stop-job:kimi-test"]["frees"], _JOB_FREES)
        self.assertNotIn("stop-job:ray-head,ray-worker", rows)

    def test_partially_active_ray_counts_only_the_active_ones(self) -> None:
        rows = _rows(_nothing_running, lambda job: job == "ray-head")
        self.assertEqual(rows["stop-job:ray-head,ray-worker"]["frees"]["gpus"], 4)

    def test_stop_inference_uses_the_all_sentinel(self) -> None:
        rows = _rows(_nothing_running, _no_jobs)
        self.assertEqual(
            rows["stop-inference"]["frees"],
            {"gpus": "all", "memory": "all", "cpu": "all"},
        )

    def test_an_action_with_no_probe_is_never_offered(self) -> None:
        rows = _rows(_all_running, _all_jobs)
        self.assertNotIn("stop-stack:mcp", rows)

    def test_a_token_that_only_shares_the_job_prefix_is_not_treated_as_a_job(self) -> None:
        # Matching on "stop-j" instead of "stop-job:" would offer this row and probe
        # a nonexistent Job named "unk:thing", so the prefix has to match exactly.
        rows = _rows(_all_running, _all_jobs)
        self.assertNotIn("stop-junk:thing", rows)

    def test_policy_order_is_preserved(self) -> None:
        rows = applicable_suggestions(_POLICY, _all_running, _all_jobs)
        self.assertEqual(
            [row["action"] for row in rows],
            [
                "dev:coder",
                "dev:kasm",
                "stop-job:kimi-test",
                "stop-job:ray-head,ray-worker",
                "stop-inference",
            ],
        )

    def test_frees_values_keep_their_mixed_kinds(self) -> None:
        rows = _rows(_all_running, _all_jobs)
        numeric = rows["dev:coder"]["frees"]["gpus"]
        self.assertIsInstance(numeric, int)
        self.assertIsInstance(rows["stop-inference"]["frees"]["gpus"], str)

    def test_an_empty_policy_yields_nothing(self) -> None:
        self.assertEqual(applicable_suggestions({}, _all_running, _all_jobs), [])


class ProbeTest(unittest.TestCase):
    """The real helm/kubectl probes, against stub executables."""

    def setUp(self) -> None:
        """Create a directory of stub executables and put it first on PATH."""
        self._bin = tempfile.TemporaryDirectory()
        self.bin_dir = Path(self._bin.name)
        self._old_path = os.environ["PATH"]
        os.environ["PATH"] = f"{self.bin_dir}{os.pathsep}{self._old_path}"

    def tearDown(self) -> None:
        """Restore PATH and remove the stub directory."""
        os.environ["PATH"] = self._old_path
        self._bin.cleanup()

    def test_helm_release_running_true(self) -> None:
        _write_fake_bin(
            self.bin_dir,
            "helm",
            'if [[ "$2" == "-n" && "$3" == "coder" ]]; then echo coder; fi',
        )
        self.assertTrue(helm_release_running("coder", "coder"))

    def test_helm_release_running_false_when_absent(self) -> None:
        _write_fake_bin(self.bin_dir, "helm", "exit 0")
        self.assertFalse(helm_release_running("coder", "coder"))

    def test_helm_release_running_false_when_helm_fails(self) -> None:
        _write_fake_bin(self.bin_dir, "helm", "echo 'boom' >&2; exit 1")
        self.assertFalse(helm_release_running("coder", "coder"))

    def test_job_active_true(self) -> None:
        _write_fake_bin(self.bin_dir, "kubectl", "echo 1")
        self.assertTrue(job_active("kimi-test"))

    def test_job_active_false_when_absent(self) -> None:
        _write_fake_bin(self.bin_dir, "kubectl", "echo 0")
        self.assertFalse(job_active("kimi-test"))

    def test_job_active_uses_the_default_namespace(self) -> None:
        captured: list[str] = []
        call = subprocess.CompletedProcess(args=[], returncode=0, stdout="1", stderr="")

        def fake_run(
            cmd: list[str],
            **_kwargs: object,
        ) -> subprocess.CompletedProcess[str]:
            captured.extend(cmd)
            return call

        with mock.patch.object(subprocess, "run", fake_run):
            self.assertTrue(job_active("kimi-test"))
        self.assertIn(DEFAULT_JOB_NAMESPACE, captured)
        self.assertIn("get", captured)

    def test_probe_failure_degrades_to_not_running(self) -> None:
        # No kubectl on a host must not surface a traceback to the capacity gate.
        os.environ["PATH"] = str(self.bin_dir)
        self.assertFalse(job_active("kimi-test"))


class CliTest(unittest.TestCase):
    """The CLI contract the shell utility uses."""

    def test_prints_suggestions_and_ignores_the_capacity_blob(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            policy_path = Path(tmp) / "policy.json"
            policy_path.write_text(json.dumps(_POLICY))
            script = Path(__file__).with_name("resources_suggest_free_resources.py")
            result = subprocess.run(
                [sys.executable, str(script), str(policy_path), "{}"],
                capture_output=True,
                text=True,
                check=False,
                env={**os.environ, "PATH": str(self._empty_bin(tmp))},
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            rows = cast("list[dict[str, object]]", json.loads(result.stdout))
            actions = [row["action"] for row in rows]
            # With no helm/kubectl nothing is running, so only the unconditional row remains.
            self.assertEqual(actions, ["stop-inference"])

    @staticmethod
    def _empty_bin(tmp: str) -> Path:
        """An empty directory to use as PATH so the probes find nothing.

        Args:
            tmp: Directory to create the bin under.

        Returns:
            The empty bin directory.
        """
        bin_dir = Path(tmp) / "empty-bin"
        bin_dir.mkdir(exist_ok=True)
        return bin_dir


if __name__ == "__main__":
    unittest.main()
