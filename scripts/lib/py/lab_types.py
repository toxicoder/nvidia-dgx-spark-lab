#!/usr/bin/env python3
"""Shared domain types for the Resource Guard policy readers.

This module is the single place the lab's capacity vocabulary is declared for
Python. The shell entry points in ``scripts/lib/resources.sh`` invoke the
``scripts/lib/py`` helpers as CLIs, and those helpers previously passed policy
records, node lists, and capacity verdicts around as ``dict[str, Any]``, which
mypy cannot check and a reader cannot verify.

The names here deliberately mirror the TypeScript contracts in
``dashboard/lib/types/index.ts`` (``ResourceAmount``, ``ClusterCapacity``,
``CapacityCheck``, ``FreeResourceSuggestion``). A field renamed on one side is a
breaking change for the other, and the paired test
``tests/test_lab_capacity_contract.py`` fails when the two drift.

Safety: ``CapacityCheck`` gates heavy GPU workload starts. A misspelled field
here must fail loudly at import or in that test rather than silently degrading a
capacity verdict into "no requirement recorded".
"""
from __future__ import annotations

from enum import StrEnum
from typing import Final, Literal, TypedDict

#: Resource kinds understood by :func:`parse_quantity`.
QuantityKind = Literal["cpu", "memory", "gpu"]

#: A Kubernetes quantity as written in the policy files: ``"600m"``, ``"4"``,
#: ``"640Mi"``, ``"1Gi"``. YAML folds unquoted values, so an author may write
#: ``cpu: 500`` or ``memory: 1Gi`` and both are legal.
PolicyQuantity = str | int | float

#: Whole-numbered core count after parsing (``"600m"`` -> ``0.6``).
CoreCount = float

#: Byte count after parsing (``"1Gi"`` -> ``1073741824``).
ByteCount = int

#: Whole GPU count.
GpuCount = int


class CapacityVerdict(StrEnum):
    """Why a capacity check passed or failed.

    The composed members come from stacking resource shortfalls in the order
    GPU, CPU, memory: a workload that is short on GPUs and CPU reports
    ``INSUFFICIENT_GPU_CPU``. Only the base forms combine, and only forward in
    that order, which is why the full cross product is not listed.
    """

    OK = "ok"
    UNKNOWN_MODEL = "unknown_model"
    UNKNOWN_STACK = "unknown_stack"
    INSUFFICIENT_NODES = "insufficient_nodes"
    TOO_MANY_NODES = "too_many_nodes"
    INSUFFICIENT_GPU = "insufficient_gpu"
    INSUFFICIENT_CPU = "insufficient_cpu"
    INSUFFICIENT_MEMORY = "insufficient_memory"
    INSUFFICIENT_GPU_CPU = "insufficient_gpu_cpu"
    INSUFFICIENT_GPU_MEMORY = "insufficient_gpu_memory"
    INSUFFICIENT_CPU_MEMORY = "insufficient_cpu_memory"
    INSUFFICIENT_GPU_CPU_MEMORY = "insufficient_gpu_cpu_memory"


class ResourceAmount(TypedDict):
    """A CPU/memory/GPU triple as it crosses the CLI boundary to the shell.

    ``cpu`` and ``memory`` are formatted strings (``"12"``, ``"24.5Gi"``) so the
    shell and the dashboard can print them without re-parsing; use
    :class:`ResourceRequirement` for values still under arithmetic.
    """

    gpus: GpuCount
    cpu: str
    memory: str


class ResourceRequirement(TypedDict):
    """A workload's summed requirement, still in arithmetic form."""

    gpus: GpuCount
    cpu: CoreCount
    memory: ByteCount


class Headroom(TypedDict, total=False):
    """The ``headroom`` block of ``config/resource-policy.yaml``."""

    cpu_percent: PolicyQuantity
    memory_percent: PolicyQuantity
    memory_min_per_node: PolicyQuantity
    cpu_min_per_node: PolicyQuantity


class ModelSpec(TypedDict, total=False):
    """One entry of the policy ``models`` map.

    Only ``gpus`` is meaningfully required; every key is optional because
    ``.get(key, default)`` is how the readers have always tolerated a partial
    entry, and tightening that would change Resource Guard behaviour.
    """

    gpus: PolicyQuantity
    cpu: PolicyQuantity
    memory: PolicyQuantity
    heavy: bool
    job_name: str
    stack_with: list[str]


class StackSpec(TypedDict, total=False):
    """One entry of the policy ``stacks`` map."""

    heavy: bool
    stack_with: list[str]
    min_nodes: PolicyQuantity
    max_nodes: PolicyQuantity
    label: str


class TierService(TypedDict, total=False):
    """A pinned service reservation inside a priority tier."""

    namespace: str
    cpu: PolicyQuantity
    memory: PolicyQuantity


class Tier(TypedDict, total=False):
    """One entry of the policy ``tiers`` map."""

    priority_class: str
    namespaces: list[str]
    services: dict[str, TierService]


class FreeAction(TypedDict, total=False):
    """One entry of the policy ``free_actions`` list."""

    id: str
    label: str
    action: str
    reversible: bool
    impact: str


class ResourcePolicy(TypedDict, total=False):
    """The parsed ``config/resource-policy.yaml`` / ``.json`` pair."""

    headroom: Headroom
    tiers: dict[str, Tier]
    inference: dict[str, object]
    models: dict[str, ModelSpec]
    stacks: dict[str, StackSpec]
    free_actions: list[FreeAction]


class NodeAllocatable(TypedDict, total=False):
    """The subset of a ``kubectl get nodes -o json`` item that headroom uses."""

    allocatable: dict[str, PolicyQuantity]


class CapacitySnapshot(TypedDict, total=False):
    """Cluster capacity handed to the ``check`` verb as a JSON argument."""

    node_count: PolicyQuantity
    available: dict[str, PolicyQuantity]
    allocatable: dict[str, PolicyQuantity]


class HeadroomTotals(TypedDict):
    """Cluster-wide reservable headroom after per-node floors are applied."""

    cpu: CoreCount
    memory: ByteCount


class CapacityCheck(TypedDict):
    """The verdict the ``check`` verb prints and the dashboard parses.

    Mirrors ``CapacityCheck`` in ``dashboard/lib/types/index.ts``.
    """

    ok: bool
    verdict: CapacityVerdict
    action: str
    heavy: bool
    required: ResourceAmount
    available: ResourceAmount
    deficit: dict[str, str | int | float]


class FreeResourceSuggestion(TypedDict):
    """One row of the ``suggest_free_resources`` list.

    Mirrors ``FreeResourceSuggestion`` in ``dashboard/lib/types/index.ts``.
    ``frees`` mixes formatted quantities (``"4Gi"``), counts (``0``) and the
    literal ``"all"``, so it stays a permissive mapping on purpose.
    """

    id: str
    label: str
    action: str
    reversible: bool
    impact: str
    applicable: bool
    frees: dict[str, str | int]


#: Per-node memory floor used when the policy omits ``memory_min_per_node``.
DEFAULT_MEMORY_MIN_PER_NODE: Final[str] = "24Gi"

#: Per-node CPU floor used when the policy omits ``cpu_min_per_node``.
DEFAULT_CPU_MIN_PER_NODE: Final[str] = "4"

#: Headroom percentage used when the policy omits ``cpu_percent``/``memory_percent``.
DEFAULT_HEADROOM_PERCENT: Final[float] = 15.0

__all__ = [
    "CapacityCheck",
    "CapacitySnapshot",
    "CapacityVerdict",
    "CoreCount",
    "DEFAULT_CPU_MIN_PER_NODE",
    "DEFAULT_HEADROOM_PERCENT",
    "DEFAULT_MEMORY_MIN_PER_NODE",
    "FreeAction",
    "FreeResourceSuggestion",
    "GpuCount",
    "Headroom",
    "HeadroomTotals",
    "ModelSpec",
    "NodeAllocatable",
    "PolicyQuantity",
    "QuantityKind",
    "ResourceAmount",
    "ResourcePolicy",
    "ResourceRequirement",
    "StackSpec",
    "Tier",
    "TierService",
]
