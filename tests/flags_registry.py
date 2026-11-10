#!/usr/bin/env python3
"""Feature-flag registry gate for ``config/flags.yaml``.

The repository ships unfinished work behind flags that default off, and it keeps
every flag declared in one checked-in file so a reviewer can see the whole switch
surface in one read and a retirement is one edit plus a grep. This gate proves the
registry stays honest: each flag names an owner, an expiry, its default, and the
single place that branches on it.

Rules enforced (see docs/branching.md):

* ``version: 1`` and a non-empty ``flags`` mapping.
* Flag names are ``UPPER_SNAKE`` env-var style, so a grep finds every site.
* Each flag declares ``default``, ``owner``, ``description``, ``expires``,
  ``kind`` and ``reader``.
* ``kind: feature`` and ``kind: harness`` ship with ``default: false``: a flag that
  is on by default is an unfinished feature that already became load-bearing.
* ``kind: capability`` may ship on, but only with a ``reason`` saying why it is a
  deployed capability rather than unfinished work.
* ``reader`` is one existing file that actually names the flag. Only
  ``kind: harness`` may list up to three, and it must name its production ``guard``.
* ``environments``, when present, maps environment names to booleans.
* No value looks like a credential: this file is committed, so secrets belong in
  the GitHub Environment or the deploy env file instead.

Usage:
  bazelisk test //tests:flags_registry
  python3 tests/flags_registry.py
"""

from __future__ import annotations

import datetime
import os
import pathlib
import re
import sys
from typing import Protocol, TypeAlias

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - exercised only on a thin interpreter
    sys.stderr.write(
        "flags_registry: PyYAML is required to read config/flags.yaml\n"
        "  (pip install pyyaml, or use the devcontainer / CI lint image)\n"
    )
    raise SystemExit(2)

#: Registry path, relative to the repository root.
REL_FLAGS_PATH: str = "config/flags.yaml"

#: The only registry schema version this gate accepts.
REGISTRY_VERSION: int = 1

#: One value a YAML document can hold, declared recursively so the walkers below
#: never have to widen to a broad type. ``datetime.date`` appears because PyYAML
#: parses an unquoted ``2027-03-31`` into a date object.
JsonValue: TypeAlias = (
    "bool | float | int | str | None | datetime.date | list[JsonValue] | dict[str, JsonValue]"
)

#: The settings map behind one flag name.
FlagSpec: TypeAlias = "dict[str, JsonValue]"

#: Keys every flag entry must carry.
REQUIRED_FLAG_KEYS: tuple[str, ...] = (
    "default",
    "owner",
    "description",
    "expires",
    "kind",
    "reader",
)

#: The flag ladder. ``feature`` gates unfinished work, ``capability`` is a shipped
#: control that may default on, ``harness`` is a dev/test switch with a production guard.
KINDS: tuple[str, ...] = ("feature", "capability", "harness")

#: A harness switch may be read from a few edge/server files; nothing else may.
MAX_HARNESS_READS: int = 3

_NAME_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_SECRET_VALUE_RE = re.compile(
    r"(?:\bgh[pousr]_[A-Za-z0-9]{16,}\b"
    r"|\bsk-[A-Za-z0-9]{16,}\b"
    r"|\bAKIA[0-9A-Z]{16}\b"
    r"|-----BEGIN"
    r"|\bxox[baprs]-[A-Za-z0-9-]{8,})"
)
_SECRET_KEY_RE = re.compile(r"(?:secret|token|password|passwd|api[_-]?key|private[_-]?key)", re.I)
_PLACEHOLDER_EXPIRY = frozenset({"someday", "never", "tbd", "todo", "soon", "unknown", "n/a"})


class Repo(Protocol):
    """The slice of the repository this gate needs: named files and their text."""

    def is_file(self, relpath: str) -> bool:
        """Return True when ``relpath`` exists as a file under the repository root."""
        ...

    def read_text(self, relpath: str) -> str:
        """Return the text of ``relpath`` relative to the repository root."""
        ...


class RepoRoot:
    """Filesystem-backed :class:`Repo` rooted at a checkout."""

    def __init__(self, root: pathlib.Path) -> None:
        self._root = root

    def is_file(self, relpath: str) -> bool:
        """Return True when ``relpath`` is a file inside the checkout."""
        return (self._root / relpath).is_file()

    def read_text(self, relpath: str) -> str:
        """Return the decoded text of ``relpath``."""
        return (self._root / relpath).read_text(encoding="utf-8")


def load_registry(path: pathlib.Path) -> dict[str, JsonValue]:
    """Load ``config/flags.yaml`` and insist on a mapping at the top level.

    Raises:
        FileNotFoundError: When the registry is absent.
        ValueError: When the document is not a mapping.
    """
    if not path.is_file():
        raise FileNotFoundError(str(path))
    loaded: JsonValue = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError(
            f"{path}: expected a mapping at the top level, got {type(loaded).__name__}"
        )
    return loaded


def _readers_of(reader: JsonValue) -> list[str] | None:
    """Normalise ``reader`` to a list of paths, or None when it is unusable."""
    if isinstance(reader, str):
        return [reader]
    if isinstance(reader, list):
        items: list[str] = []
        for item in reader:
            if not isinstance(item, str):
                return None
            items.append(item)
        return items
    return None


def _expiry_is_checkable(value: JsonValue) -> bool:
    """Accept a real date, or prose long enough for a human to verify."""
    if isinstance(value, (datetime.date, datetime.datetime)):
        return True
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text or text.lower() in _PLACEHOLDER_EXPIRY:
        return False
    if _ISO_DATE_RE.match(text):
        try:
            datetime.date.fromisoformat(text)
        except ValueError:
            return False
        return True
    return len(text.split()) >= 2


def _secret_violations(flag_name: str, spec: FlagSpec) -> list[str]:
    """Flag registry entries that carry something shaped like a credential."""
    violations: list[str] = []
    for key, value in spec.items():
        named_credential = _SECRET_KEY_RE.search(key) is not None
        if named_credential and isinstance(value, str) and value.strip():
            violations.append(
                f"{flag_name}: key {key!r} looks like a credential; keep secrets in the "
                "GitHub Environment or the deploy env file, never in config/flags.yaml"
            )
        if isinstance(value, str) and _SECRET_VALUE_RE.search(value):
            violations.append(
                f"{flag_name}: value for {key!r} looks like a credential; keep secrets out "
                "of config/flags.yaml"
            )
    return violations


def _text(value: JsonValue | None) -> str:
    """Render a scalar setting for a truthiness test without widening its type."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def validate_flag(flag_name: str, spec: JsonValue, repo: Repo) -> list[str]:
    """Return every rule violation for one flag entry."""
    if not isinstance(spec, dict):
        return [f"{flag_name}: expected a mapping of flag settings"]

    violations: list[str] = []
    for key in REQUIRED_FLAG_KEYS:
        if key not in spec:
            violations.append(f"{flag_name}: missing required key {key!r}")

    kind = spec.get("kind")
    if kind is not None and not (isinstance(kind, str) and kind in KINDS):
        violations.append(f"{flag_name}: kind {kind!r} is not one of {list(KINDS)}")

    default = spec.get("default")
    if (
        isinstance(kind, str)
        and kind in ("feature", "harness")
        and "default" in spec
        and default is not False
    ):
        violations.append(
            f"{flag_name}: kind {kind!r} must declare default: false so trunk ships the "
            "unfinished path switched off"
        )
    if kind == "capability" and default is True and not _text(spec.get("reason")).strip():
        violations.append(
            f"{flag_name}: a capability that defaults on must explain itself with 'reason'"
        )

    readers = _readers_of(spec.get("reader"))
    if readers is None:
        violations.append(f"{flag_name}: reader must be a path or a list of paths")
    else:
        if not readers:
            violations.append(f"{flag_name}: reader must name at least one file")
        if isinstance(kind, str) and kind in ("feature", "capability") and len(readers) != 1:
            violations.append(
                f"{flag_name}: kind {kind!r} needs exactly one reader so retiring the flag "
                "is one edit and a grep"
            )
        if kind == "harness" and len(readers) > MAX_HARNESS_READS:
            violations.append(
                f"{flag_name}: a harness flag may name at most {MAX_HARNESS_READS} readers"
            )
        for reader in readers:
            if not repo.is_file(reader):
                violations.append(
                    f"{flag_name}: reader {reader!r} does not exist{_under_bazel_hint()}"
                )
            elif flag_name not in repo.read_text(reader):
                violations.append(
                    f"{flag_name}: reader {reader!r} never names the flag, so it is not where "
                    "the flag is branched on"
                )

    if kind == "harness":
        guard = _text(spec.get("guard")).strip()
        if not guard:
            violations.append(
                f"{flag_name}: a harness flag must name the 'guard' that refuses it in production"
            )
        elif not repo.is_file(guard):
            violations.append(f"{flag_name}: guard {guard!r} does not exist{_under_bazel_hint()}")

    if "expires" in spec and not _expiry_is_checkable(spec["expires"]):
        violations.append(f"{flag_name}: expires must be a date or a condition a human can check")

    environments = spec.get("environments")
    if environments is not None and (
        not isinstance(environments, dict)
        or not all(isinstance(value, bool) for value in environments.values())
    ):
        violations.append(f"{flag_name}: environments must map environment names to booleans")

    violations.extend(_secret_violations(flag_name, spec))
    return violations


def validate_registry_document(document: JsonValue, repo: Repo) -> list[str]:
    """Return every rule violation for the whole registry document."""
    if not isinstance(document, dict):
        return [f"registry: expected a mapping at the top level, got {type(document).__name__}"]

    violations: list[str] = []
    if document.get("version") != REGISTRY_VERSION:
        violations.append(f"registry: version must be {REGISTRY_VERSION}")

    flags = document.get("flags")
    if not isinstance(flags, dict) or not flags:
        violations.append("registry: flags must be a non-empty mapping")
        return violations

    seen_readers: dict[str, tuple[str, JsonValue]] = {}
    for raw_name, spec in flags.items():
        flag_name = str(raw_name)
        if not _NAME_RE.match(flag_name):
            violations.append(
                f"registry: flag name {flag_name!r} must be UPPER_SNAKE so a grep audits it completely"
            )
        violations.extend(validate_flag(flag_name, spec, repo))

        spec_kind: JsonValue = spec.get("kind") if isinstance(spec, dict) else None
        readers = _readers_of(spec.get("reader")) if isinstance(spec, dict) else None
        for reader in readers or []:
            prior = seen_readers.get(reader)
            if prior is None:
                seen_readers[reader] = (flag_name, spec_kind)
            elif prior[1] != "harness" or spec_kind != "harness":
                violations.append(
                    f"{flag_name}: shares its reader {reader!r} with {prior[0]}; one seam belongs "
                    "to one unfinished feature"
                )

    return violations


def check_flags_file(root: pathlib.Path) -> list[str]:
    """Validate the registry in ``root`` and return every violation found."""
    path = root / REL_FLAGS_PATH
    if not path.is_file():
        return [
            f"{REL_FLAGS_PATH} is missing: every flag needs a declaration with default, "
            "owner, expiry and one reader"
        ]
    try:
        document = load_registry(path)
    except ValueError as error:
        return [str(error)]
    return validate_registry_document(document, RepoRoot(root))


def _under_bazel_hint() -> str:
    """Explain the one false-positive shape: a reader the test did not declare as data."""
    if os.environ.get("TEST_SRCDIR"):
        return (
            " (under Bazel this file must also be listed in data of "
            "//tests:flags_registry in tests/BUILD.bazel)"
        )
    return ""


def _repo_root() -> pathlib.Path:
    """Locate the repository root under Bazel and from a plain shell."""
    override = os.environ.get("BUILD_WORKSPACE_DIRECTORY")
    if override:
        return pathlib.Path(override)
    if os.environ.get("TEST_SRCDIR"):
        return pathlib.Path(str(os.environ["TEST_SRCDIR"])) / "_main"
    return pathlib.Path(__file__).resolve().parent.parent


def main() -> int:
    """Run the gate; report violations on stderr and exit non-zero."""
    violations = check_flags_file(_repo_root())
    if violations:
        sys.stderr.write("flags_registry: config/flags.yaml is not compliant\n")
        for violation in violations:
            sys.stderr.write(f"  - {violation}\n")
        return 1
    sys.stderr.write("flags_registry: config/flags.yaml is compliant\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
