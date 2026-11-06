#!/usr/bin/env python3
"""Python helper extracted from ``scripts/lib/resources.sh`` (``_resource_python``).

Invoked by shell as: ``python3 scripts/lib/py/resource_policy.py <verb> <policy> [args...]``.

Verbs: ``load``, ``model_req``, ``headroom``, ``stack_req``, ``check``. Every verb
prints one JSON document on stdout. ``check`` exits 1 when the verdict is not
``ok``; ``model_req``/``stack_req`` exit 1 on an unknown id. The exit code and the
JSON shape are the contract ``scripts/lib/resources.sh`` and the dashboard rely on.

The policy record, the node list, and the capacity argument all arrive as JSON and
are typed here through :mod:`lab_types` rather than as ``dict[str, Any]``.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import NoReturn, TypedDict, cast

from lab_types import (
    DEFAULT_CPU_MIN_PER_NODE,
    DEFAULT_HEADROOM_PERCENT,
    DEFAULT_MEMORY_MIN_PER_NODE,
    ByteCount,
    CapacityCheck,
    CapacitySnapshot,
    CapacityVerdict,
    CoreCount,
    GpuCount,
    HeadroomTotals,
    ModelSpec,
    NodeAllocatable,
    PolicyQuantity,
    ResourceAmount,
    ResourcePolicy,
    ResourceRequirement,
    StackSpec,
    TierService,
)

#: Byte multipliers for the binary and decimal Kubernetes storage suffixes.
_MEMORY_MULTIPLIERS: dict[str, int] = {
    "Ki": 1024,
    "Mi": 1024**2,
    "Gi": 1024**3,
    "Ti": 1024**4,
    "K": 1000,
    "M": 1000**2,
    "G": 1000**3,
    "T": 1000**4,
}

#: ``<digits>[.<digits>]<optional binary or decimal suffix>`` as accepted for memory.
_MEMORY_RE = re.compile(r"^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$")


class ModelRequirement(TypedDict):
    """Output of the ``model_req`` verb: a model plus its ``stack_with`` closure."""

    gpus: GpuCount
    cpu: CoreCount
    memory: ByteCount
    heavy: bool
    job_name: str
    stack_with: list[str]


class StackRequirement(TypedDict):
    """Output of the ``stack_req`` verb.

    ``min_nodes``/``max_nodes`` are always emitted, as ``null`` when the stack
    does not bound them, because the shell readers key on their presence.
    """

    gpus: GpuCount
    cpu: CoreCount
    memory: ByteCount
    heavy: bool
    stack_with: list[str]
    min_nodes: PolicyQuantity | None
    max_nodes: PolicyQuantity | None
    label: str


class _RejectionBase(TypedDict):
    """Fields every rejected verdict carries."""

    ok: bool
    verdict: CapacityVerdict
    action: str


class CapacityRejection(_RejectionBase, total=False):
    """Output of ``check`` when it refuses before it can total up resources.

    ``required``/``available`` are node counts (``{"nodes": 2}``) rather than the
    :class:`~lab_types.ResourceAmount` triple of a full verdict, so they stay an
    open mapping here. The dashboard models the same split as a discriminated
    union over ``ok``.
    """

    heavy: bool
    required: dict[str, object]
    available: dict[str, object]
    deficit: dict[str, object]


class PolicyError(TypedDict):
    """Output of ``model_req``/``stack_req`` for an id the policy does not define."""

    error: str


class Deficit(TypedDict, total=False):
    """Raw per-dimension shortfall, carrying only the dimensions that are short.

    Distinct from ``CapacityCheck["deficit"]``, which is the same information with
    memory formatted as a Kubernetes quantity.
    """

    gpus: GpuCount
    cpu: CoreCount
    memory: ByteCount


def load_policy(path: str) -> ResourcePolicy:
    """Read and type the Resource Guard policy JSON.

    Args:
        path: Filesystem path to ``config/resource-policy.json`` (or its YAML
            twin; the shell loader picks the twin and hands us the path).

    Returns:
        The policy document as declared in :mod:`lab_types`.
    """
    return cast(ResourcePolicy, json.loads(Path(path).read_text()))


def parse_cpu(val: PolicyQuantity | None) -> CoreCount:
    """Parse a CPU quantity into cores.

    Args:
        val: A policy or ``kubectl`` CPU value: ``"600m"``, ``"4"``, ``500``,
            ``None``, or an empty string.

    Returns:
        Whole or fractional cores. ``"600m"`` becomes ``0.6``. A missing or
        empty value becomes ``0``; a value that is not numeric raises
        ``ValueError``, which is what the original parser did and what keeps a
        typo in the policy from silently reading as zero cores.
    """
    if val is None:
        return 0
    text = str(val).strip()
    if not text:
        return 0
    if text.endswith("m"):
        return int(text[:-1]) / 1000.0
    return float(text)


def parse_memory(val: PolicyQuantity | None) -> ByteCount:
    """Parse a memory quantity into bytes.

    Args:
        val: A policy or ``kubectl`` memory value such as ``"24Gi"``, ``"640Mi"``,
            a bare byte count, ``None``, or an empty string.

    Returns:
        Bytes. A missing value or a suffix the expression does not cover becomes
        ``0`` rather than raising, matching the tolerant behaviour the shell
        loaders depend on.
    """
    if val is None:
        return 0
    text = str(val).strip()
    if not text:
        return 0
    match = _MEMORY_RE.match(text)
    if not match:
        return 0
    num = float(match.group(1))
    unit = match.group(2) or ""
    return int(num * _MEMORY_MULTIPLIERS.get(unit, 1))


def parse_gpu(val: PolicyQuantity | None) -> GpuCount:
    """Parse a GPU count.

    Args:
        val: A GPU count as a number or numeric string, ``None``, or empty.

    Returns:
        Whole GPUs. ``0`` when absent or empty; a non-numeric value raises
        ``ValueError`` rather than silently reading as zero GPUs.
    """
    if val is None:
        return 0
    text = str(val).strip()
    if not text:
        return 0
    return int(float(text))


def fmt_cpu(cores: float) -> str:
    """Render cores for display: ``"12"`` when near-whole, else ``"12.34"``.

    Args:
        cores: Core count.

    Returns:
        A string safe to print and to re-parse with :func:`parse_cpu`.
    """
    if cores >= 1 and abs(cores - round(cores)) < 0.01:
        return str(int(round(cores)))
    return f"{cores:.2f}"


def fmt_mem(b: int) -> str:
    """Render bytes as a Kubernetes-style quantity.

    Args:
        b: Byte count.

    Returns:
        ``Gi`` above a gibibyte, ``Mi`` above a mebibyte, otherwise raw bytes
        with a ``B`` suffix.
    """
    if b >= 1024**3:
        return f"{b / 1024**3:.1f}Gi"
    if b >= 1024**2:
        return f"{int(b / 1024**2)}Mi"
    return f"{b}B"


def _amount(gpus: GpuCount, cpu: CoreCount, memory: ByteCount) -> ResourceAmount:
    """Format an arithmetic resource triple as the display triple.

    Args:
        gpus: Whole GPUs.
        cpu: Cores.
        memory: Bytes.

    Returns:
        The ``{gpus, cpu, memory}`` object the shell and dashboard print.
    """
    return {"gpus": gpus, "cpu": fmt_cpu(cpu), "memory": fmt_mem(memory)}


def _model_or_unknown(policy: ResourcePolicy, model: str) -> ModelSpec:
    """Look up a model spec, exiting with the legacy error payload when absent.

    Args:
        policy: The parsed policy.
        model: Model id from the CLI.

    Returns:
        The model's spec.

    Raises:
        SystemExit: Always, when the model is unknown. Prints
            ``{"error": "unknown model: <model>"}`` and exits 1.
    """
    spec = policy.get("models", {}).get(model)
    if not spec:
        print(json.dumps(PolicyError(error=f"unknown model: {model}")))
        sys.exit(1)
    return spec


def _stack_or_unknown(policy: ResourcePolicy, stack_id: str) -> StackSpec:
    """Look up a stack spec, exiting with the legacy error payload when absent.

    Args:
        policy: The parsed policy.
        stack_id: Stack id from the CLI.

    Returns:
        The stack's spec.

    Raises:
        SystemExit: Always, when the stack is unknown. Prints
            ``{"error": "unknown stack: <stack_id>"}`` and exits 1.
    """
    stack = policy.get("stacks", {}).get(stack_id)
    if not stack:
        print(json.dumps(PolicyError(error=f"unknown stack: {stack_id}")))
        sys.exit(1)
    return stack


def _model_demand(spec: ModelSpec) -> ResourceRequirement:
    """Total a model's own requirement.

    Args:
        spec: The model spec to total.

    Returns:
        GPUs, cores, and bytes the model alone needs.
    """
    return {
        "gpus": int(spec.get("gpus", 0)),
        "cpu": parse_cpu(spec.get("cpu", 0)),
        "memory": parse_memory(spec.get("memory", 0)),
    }


def _add_companions(
    policy: ResourcePolicy,
    requirement: ResourceRequirement,
    companions: list[str],
) -> ResourceRequirement:
    """Add the requirement of every ``stack_with`` companion model in place.

    Args:
        policy: The parsed policy.
        requirement: The running total to extend.
        companions: Model ids listed in ``stack_with``.

    Returns:
        The same ``requirement`` object, extended.
    """
    for name in companions:
        companion: ModelSpec = policy.get("models", {}).get(name, {})
        requirement["gpus"] += int(companion.get("gpus", 0))
        requirement["cpu"] += parse_cpu(companion.get("cpu", 0))
        requirement["memory"] += parse_memory(companion.get("memory", 0))
    return requirement


def cmd_model_req(policy: ResourcePolicy, model: str) -> None:
    """Handle ``model_req``: print a model's summed requirement, or error and exit.

    Args:
        policy: The parsed policy.
        model: Model id from ``argv[3]``.
    """
    spec = _model_or_unknown(policy, model)
    requirement = ModelRequirement(
        gpus=int(spec.get("gpus", 0)),
        cpu=parse_cpu(spec.get("cpu", 0)),
        memory=parse_memory(spec.get("memory", 0)),
        heavy=bool(spec.get("heavy", False)),
        job_name=spec.get("job_name", model),
        stack_with=list(spec.get("stack_with", [])),
    )
    _add_companions(policy, requirement, requirement["stack_with"])
    print(json.dumps(requirement))


def cmd_headroom(policy: ResourcePolicy, nodes_json: str) -> None:
    """Handle ``headroom``: print cluster-reservable headroom after node floors.

    Each node contributes at least ``memory_min_per_node`` / ``cpu_min_per_node``,
    so a small node still reserves the floor rather than the percentage.

    Args:
        policy: The parsed policy.
        nodes_json: JSON array of ``kubectl get nodes`` items.
    """
    nodes = cast("list[NodeAllocatable]", json.loads(nodes_json))
    headroom = policy.get("headroom", {})
    pct_cpu = float(headroom.get("cpu_percent", DEFAULT_HEADROOM_PERCENT)) / 100.0
    pct_mem = float(headroom.get("memory_percent", DEFAULT_HEADROOM_PERCENT)) / 100.0
    min_mem = parse_memory(headroom.get("memory_min_per_node", DEFAULT_MEMORY_MIN_PER_NODE))
    min_cpu = parse_cpu(headroom.get("cpu_min_per_node", DEFAULT_CPU_MIN_PER_NODE))
    total_cpu = 0.0
    total_mem = 0
    for node in nodes:
        allocatable = node.get("allocatable", {})
        cpu = parse_cpu(allocatable.get("cpu", 0))
        mem = parse_memory(allocatable.get("memory", 0))
        total_cpu += max(min_cpu, cpu * pct_cpu)
        total_mem += max(min_mem, int(mem * pct_mem))
    print(json.dumps(HeadroomTotals(cpu=total_cpu, memory=total_mem)))


def cmd_stack_req(policy: ResourcePolicy, stack_id: str) -> None:
    """Handle ``stack_req``: print a stack's summed requirement.

    Args:
        policy: The parsed policy.
        stack_id: Stack id from ``argv[3]``.
    """
    stack = _stack_or_unknown(policy, stack_id)
    requirement = StackRequirement(
        gpus=0,
        cpu=0.0,
        memory=0,
        heavy=bool(stack.get("heavy", False)),
        stack_with=list(stack.get("stack_with", [])),
        min_nodes=stack.get("min_nodes"),
        max_nodes=stack.get("max_nodes"),
        label=stack.get("label", stack_id),
    )
    _add_companions(policy, requirement, requirement["stack_with"])
    print(json.dumps(requirement))


def _reject(
    verdict: CapacityVerdict,
    action: str,
    *,
    heavy: bool | None = None,
    required: dict[str, object] | None = None,
    available: dict[str, object] | None = None,
    deficit: dict[str, object] | None = None,
) -> NoReturn:
    """Print a pre-flight rejection and exit 1.

    Args:
        verdict: Why the check refused.
        action: The action token that was checked.
        heavy: Heavy-model flag, when the stack spec was already resolved.
        required: Node-count requirement, for the node-count verdicts.
        available: Node-count availability, for the node-count verdicts.
        deficit: Shortfall map; defaults to ``{}`` when the node counts are given
            and is omitted entirely for the unknown-id verdicts.

    Raises:
        SystemExit: Always, with status 1.
    """
    payload = CapacityRejection(ok=False, verdict=verdict, action=action)
    if heavy is not None:
        payload["heavy"] = heavy
    if required is not None:
        payload["required"] = required
    if available is not None:
        payload["available"] = available
    if deficit is not None:
        payload["deficit"] = deficit
    elif required is not None or available is not None:
        payload["deficit"] = {}
    print(json.dumps(payload))
    sys.exit(1)


def _dev_demand(policy: ResourcePolicy, service: str) -> ResourceRequirement:
    """Total the pinned reservation for an optional dev service.

    Args:
        policy: The parsed policy.
        service: Service name from a ``dev:<name>`` action token.

    Returns:
        The service's CPU and memory reservation; zero GPUs.
    """
    tiers = policy.get("tiers", {})
    optional_dev = tiers.get("optional_dev", {})
    services: dict[str, TierService] = optional_dev.get("services", {})
    pinned: TierService = services.get(service, {})
    return {
        "gpus": 0,
        "cpu": parse_cpu(pinned.get("cpu", 0)),
        "memory": parse_memory(pinned.get("memory", 0)),
    }


def _shortfall(
    required: ResourceRequirement,
    available: tuple[GpuCount, CoreCount, ByteCount],
) -> tuple[bool, CapacityVerdict, Deficit]:
    """Compare a requirement against availability.

    Shortfalls are stacked in GPU, CPU, memory order, so the verdict names every
    dimension that is short.

    Args:
        required: What the action needs.
        available: ``(gpus, cpu_cores, memory_bytes)`` actually free.

    Returns:
        ``(ok, verdict, deficit)`` where ``deficit`` carries only the short
        dimensions, in raw (unformatted) form.
    """
    avail_gpus, avail_cpu, avail_mem = available
    deficit = Deficit()
    verdict = CapacityVerdict.OK
    if required["gpus"] > avail_gpus:
        verdict = CapacityVerdict.INSUFFICIENT_GPU
        deficit["gpus"] = required["gpus"] - avail_gpus
    if required["cpu"] > avail_cpu:
        verdict = (
            CapacityVerdict.INSUFFICIENT_CPU
            if verdict is CapacityVerdict.OK
            else CapacityVerdict(f"{verdict.value}_cpu")
        )
        deficit["cpu"] = round(required["cpu"] - avail_cpu, 2)
    if required["memory"] > avail_mem:
        verdict = (
            CapacityVerdict.INSUFFICIENT_MEMORY
            if verdict is CapacityVerdict.OK
            else CapacityVerdict(f"{verdict.value}_memory")
        )
        deficit["memory"] = required["memory"] - avail_mem
    return not deficit, verdict, deficit


def _deficit_view(deficit: Deficit) -> dict[str, str | int | float]:
    """Format a deficit map for output, memory as a quantity.

    Args:
        deficit: Raw shortfalls, holding only the short dimensions.

    Returns:
        The same keys in GPU, CPU, memory order, with memory rendered as
        ``Gi``/``Mi``/``B``.
    """
    view: dict[str, str | int | float] = {}
    if "gpus" in deficit:
        view["gpus"] = deficit["gpus"]
    if "cpu" in deficit:
        view["cpu"] = deficit["cpu"]
    if "memory" in deficit:
        view["memory"] = fmt_mem(deficit["memory"])
    return view


def cmd_check(policy: ResourcePolicy, capacity_json: str, action: str) -> None:
    """Handle ``check``: print the Resource Guard verdict and set the exit code.

    Args:
        policy: The parsed policy.
        capacity_json: JSON cluster capacity from ``argv[3]``.
        action: Action token from ``argv[4]``, one of ``model:<id>``,
            ``stack:<id>``, or ``dev:<service>``.
    """
    capacity = cast(CapacitySnapshot, json.loads(capacity_json))
    required = ResourceRequirement(gpus=0, cpu=0.0, memory=0)
    heavy = False
    node_count = int(capacity.get("node_count", 0) or 0)

    if action.startswith("stack:"):
        stack_id = action.split(":", 1)[1]
        stack = policy.get("stacks", {}).get(stack_id)
        if not stack:
            _reject(CapacityVerdict.UNKNOWN_STACK, action)
        heavy = bool(stack.get("heavy", False))
        min_nodes = stack.get("min_nodes")
        max_nodes = stack.get("max_nodes")
        if min_nodes is not None and node_count < int(min_nodes):
            _reject(
                CapacityVerdict.INSUFFICIENT_NODES,
                action,
                heavy=heavy,
                required={"nodes": min_nodes},
                available={"nodes": node_count},
                deficit={"nodes": int(min_nodes) - node_count},
            )
        if max_nodes is not None and node_count > int(max_nodes):
            _reject(
                CapacityVerdict.TOO_MANY_NODES,
                action,
                heavy=heavy,
                required={"nodes": max_nodes},
                available={"nodes": node_count},
            )
        _add_companions(policy, required, list(stack.get("stack_with", [])))
    elif action.startswith("model:"):
        model = action.split(":", 1)[1]
        spec = policy.get("models", {}).get(model)
        if not spec:
            _reject(CapacityVerdict.UNKNOWN_MODEL, action)
        required = _model_demand(spec)
        heavy = bool(spec.get("heavy", False))
        _add_companions(policy, required, list(spec.get("stack_with", [])))
    elif action.startswith("dev:"):
        required = _dev_demand(policy, action.split(":", 1)[1])

    available = capacity.get("available", {})
    avail_gpus = int(available.get("gpus", 0) or 0)
    avail_cpu = parse_cpu(available.get("cpu", 0))
    avail_mem = parse_memory(available.get("memory", 0))

    ok, verdict, deficit = _shortfall(required, (avail_gpus, avail_cpu, avail_mem))
    print(
        json.dumps(
            CapacityCheck(
                ok=ok,
                verdict=verdict,
                action=action,
                heavy=heavy,
                required=_amount(required["gpus"], required["cpu"], required["memory"]),
                available=_amount(avail_gpus, avail_cpu, avail_mem),
                deficit=_deficit_view(deficit),
            )
        )
    )
    sys.exit(0 if ok else 1)


def _dispatch(policy: ResourcePolicy, cmd: str, argv: list[str]) -> None:
    """Route one CLI verb to its handler.

    Args:
        policy: The parsed policy, already loaded.
        cmd: The verb from ``argv[1]``.
        argv: The full argument vector.
    """
    if cmd == "load":
        print(json.dumps(policy))
    elif cmd == "model_req":
        cmd_model_req(policy, argv[3])
    elif cmd == "headroom":
        cmd_headroom(policy, argv[3])
    elif cmd == "stack_req":
        cmd_stack_req(policy, argv[3])
    elif cmd == "check":
        cmd_check(policy, argv[3], argv[4])


def main(argv: list[str]) -> None:
    """Parse arguments, load the policy, and dispatch one verb.

    Args:
        argv: The argument vector including the program name.
    """
    cmd = argv[1]
    policy = load_policy(argv[2])
    _dispatch(policy, cmd, argv)


if __name__ == "__main__":
    main(sys.argv)
