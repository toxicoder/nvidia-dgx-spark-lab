#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/resources.sh`` (``suggest_free_resources``).

Invoked by shell as:
``python3 scripts/lib/py/resources_suggest_free_resources.py <policy> <capacity-check>``.

Prints a JSON array of :class:`~lab_types.FreeResourceSuggestion` rows describing
which ``free_actions`` from the Resource Guard policy would actually help right
now: a ``dev:*`` action only when its Helm release is running, a ``stop-job:*``
action only when one of its Jobs is active.

The second argument is the capacity-check blob the caller already computed. It is
read for the argv contract the shell passes and is not consulted here; the
applicability probes below are the whole decision.
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from lab_types import FreeAction, FreeResourceSuggestion, ResourcePolicy

#: Namespace inference Jobs run in unless the caller says otherwise.
DEFAULT_JOB_NAMESPACE = "ai-inference"

#: Seconds a single ``helm``/``kubectl`` applicability probe may take.
PROBE_TIMEOUT_SECONDS = 5


def helm_release_running(namespace: str, release: str) -> bool:
    """Report whether a Helm release is installed in a namespace.

    Args:
        namespace: Kubernetes namespace to query.
        release: Helm release name.

    Returns:
        ``True`` when ``helm list`` names the release. ``False`` on any failure,
        including a missing or timed-out ``helm`` binary: an unavailable probe must
        read as "nothing to free" rather than crash the panel.
    """
    try:
        result = subprocess.run(
            ["helm", "list", "-n", namespace, "-q"],
            capture_output=True,
            text=True,
            timeout=PROBE_TIMEOUT_SECONDS,
            check=False,
        )
    except Exception:  # noqa: BLE001 - any probe failure means "not applicable"
        return False
    return release in (result.stdout or "").splitlines()


def job_active(job: str, namespace: str = DEFAULT_JOB_NAMESPACE) -> bool:
    """Report whether a Kubernetes Job currently has active pods.

    Args:
        job: Job name.
        namespace: Namespace to query; defaults to the inference namespace.

    Returns:
        ``True`` when ``status.active`` is a positive integer. ``False`` on any
        failure, including a missing or timed-out ``kubectl`` binary.
    """
    try:
        result = subprocess.run(
            ["kubectl", "get", "job", job, "-n", namespace, "-o", "jsonpath={.status.active}"],
            capture_output=True,
            text=True,
            timeout=PROBE_TIMEOUT_SECONDS,
            check=False,
        )
        return bool(result.stdout.strip()) and int(result.stdout.strip() or 0) > 0
    except Exception:  # noqa: BLE001 - any probe failure means "not applicable"
        return False


def _skeleton(action: FreeAction) -> FreeResourceSuggestion:
    """Build a not-yet-applicable suggestion row from a policy action.

    Args:
        action: One entry of the policy ``free_actions`` list.

    Returns:
        A row with ``applicable`` false and no frees recorded, ready for a probe
        to promote.
    """
    action_id = action.get("id", "")
    return FreeResourceSuggestion(
        id=action_id,
        label=action.get("label", action_id),
        action=action.get("action", ""),
        reversible=action.get("reversible", True),
        impact=action.get("impact", ""),
        applicable=False,
        frees={},
    )


def _gpu_frees(active_count: int, action: str) -> dict[str, str | int]:
    """Estimate what stopping ``active_count`` Jobs would free.

    Args:
        active_count: How many of the action's Jobs are active.
        action: The raw ``stop-job:`` action token; a Ray job reserves more.

    Returns:
        A frees map with the approximate GPU and memory figures.
    """
    return {
        "gpus": 4 * active_count if "ray" in action else 2,
        "memory": "16Gi",
        "gpus_note": "approx",
    }


def applicable_suggestions(
    policy: ResourcePolicy,
    helm_running: Callable[[str, str], bool] = helm_release_running,
    job_running: Callable[[str], bool] = job_active,
) -> list[FreeResourceSuggestion]:
    """Select the policy ``free_actions`` that would actually free resources.

    Only the two ``dev:*`` actions with a known namespace are probed; any other
    ``dev:*`` token in the policy stays non-applicable rather than being guessed
    at from its suffix.

    Args:
        policy: The parsed Resource Guard policy.
        helm_running: Probe for a running Helm release, injectable for tests.
        job_running: Probe for an active Job, injectable for tests.

    Returns:
        One row per applicable action, in policy order.
    """
    out: list[FreeResourceSuggestion] = []
    for action in policy.get("free_actions", []):
        entry = _skeleton(action)
        act = entry["action"]
        if act == "dev:coder":
            if helm_running("coder", "coder"):
                entry["applicable"] = True
                entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
        elif act == "dev:kasm":
            if helm_running("kasm", "kasm"):
                entry["applicable"] = True
                entry["frees"] = {"cpu": "2", "memory": "4Gi", "gpus": 0}
        elif act.startswith("stop-job:"):
            jobs = [j.strip() for j in act.split(":", 1)[1].split(",")]
            active = [j for j in jobs if job_running(j)]
            if active:
                entry["applicable"] = True
                entry["frees"] = _gpu_frees(len(active), act)
        elif act == "stop-inference":
            entry["applicable"] = True
            entry["frees"] = {"gpus": "all", "memory": "all", "cpu": "all"}
        if entry["applicable"]:
            out.append(entry)
    return out


def main(argv: list[str]) -> None:
    """Read the policy and the caller's capacity blob, and print the suggestions.

    Args:
        argv: Argument vector including the program name, then the policy path and
            the capacity-check JSON.
    """
    policy = json.loads(Path(argv[1]).read_text())
    json.loads(argv[2])
    print(json.dumps(applicable_suggestions(policy)))


if __name__ == "__main__":
    main(sys.argv)
