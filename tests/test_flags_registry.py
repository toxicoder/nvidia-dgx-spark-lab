#!/usr/bin/env python3
"""Unit tests for the feature-flag registry gate (tests/flags_registry.py)."""

from __future__ import annotations

import datetime
import pathlib
import tempfile
import unittest

from flags_registry import (
    REQUIRED_FLAG_KEYS,
    JsonValue,
    check_flags_file,
    load_registry,
    validate_flag,
    validate_registry_document,
)


def _feature_flag(**overrides: JsonValue) -> dict[str, JsonValue]:
    """Return a minimal valid ``kind: feature`` flag spec with overrides applied."""
    spec: dict[str, JsonValue] = {
        "default": False,
        "owner": "lab-team",
        "description": "Run the experimental indexer sidecar.",
        "expires": datetime.date(2027, 3, 31),
        "kind": "feature",
        "reader": "scripts/lib/example.sh",
    }
    spec.update(overrides)
    return spec


class ValidateFlagTests(unittest.TestCase):
    """Rules that every single flag entry must satisfy."""

    def test_valid_feature_flag_has_no_violations(self) -> None:
        """A complete off-by-default feature flag passes with nothing to report."""
        self.assertEqual(
            validate_flag("FEATURE_EXPERIMENTAL_INDEXER", _feature_flag(), _FakeRepo()), []
        )

    def test_missing_required_key_is_reported(self) -> None:
        """Dropping any required key produces a violation that names that key."""
        for key in REQUIRED_FLAG_KEYS:
            spec = _feature_flag()
            del spec[key]
            violations = validate_flag("FEATURE_X", spec, _FakeRepo())
            self.assertTrue(
                any(key in v for v in violations),
                f"missing {key!r} should be reported, got {violations}",
            )

    def test_feature_flag_must_default_off(self) -> None:
        """An unfinished feature cannot ship switched on."""
        violations = validate_flag("FEATURE_X", _feature_flag(default=True), _FakeRepo())
        self.assertTrue(any("default" in v and "false" in v for v in violations))

    def test_capability_flag_may_default_on_but_needs_a_reason(self) -> None:
        """A shipped control may default on only once it explains itself."""
        spec = _feature_flag(kind="capability", default=True)
        self.assertTrue(any("reason" in v for v in validate_flag("SSO_ENABLED", spec, _FakeRepo())))
        spec["reason"] = "Deployed security control; off-by-default would expose the lab."
        self.assertEqual(validate_flag("SSO_ENABLED", spec, _FakeRepo()), [])

    def test_unknown_kind_is_rejected(self) -> None:
        """The kind ladder is closed: anything outside it is a defect."""
        violations = validate_flag("FEATURE_X", _feature_flag(kind="maybe"), _FakeRepo())
        self.assertTrue(any("kind" in v for v in violations))

    def test_reader_must_be_one_existing_path(self) -> None:
        """One reader is required, and a list of them is rejected for a feature flag."""
        repo = _FakeRepo(existing=("scripts/lib/example.sh",))
        self.assertEqual(validate_flag("FEATURE_X", _feature_flag(), repo), [])

        missing = validate_flag("FEATURE_X", _feature_flag(reader="scripts/lib/gone.sh"), repo)
        self.assertTrue(any("does not exist" in v for v in missing))

        many = validate_flag("FEATURE_X", _feature_flag(reader=["a.sh", "b.sh"]), repo)
        self.assertTrue(any("exactly one reader" in v for v in many))

    def test_reader_must_actually_name_the_flag(self) -> None:
        """A declared reader that never mentions the flag is not where it is branched on."""
        repo = _FakeRepo(existing=("scripts/lib/example.sh",), contents="no flag here")
        violations = validate_flag("FEATURE_X", _feature_flag(), repo)
        self.assertTrue(any("never names" in v for v in violations))

    def test_expiry_must_be_a_date_or_a_checkable_condition(self) -> None:
        """A placeholder expiry is refused while real prose is accepted."""
        violations = validate_flag("FEATURE_X", _feature_flag(expires="someday"), _FakeRepo())
        self.assertTrue(any("expires" in v for v in violations))

        conditional = validate_flag(
            "FEATURE_X", _feature_flag(expires="until the backfill job lands"), _FakeRepo()
        )
        self.assertEqual(conditional, [])

    def test_secret_looking_value_is_rejected(self) -> None:
        """The registry is committed, so a credential-shaped value is a defect."""
        violations = validate_flag(
            "FEATURE_X", _feature_flag(owner="ghp_abcdefghijklmnop"), _FakeRepo()
        )
        self.assertTrue(any("secret" in v.lower() for v in violations))

    def test_harness_flag_allows_several_reads_but_needs_a_guard(self) -> None:
        """A dev-only switch may be read twice as long as it names its production guard."""
        repo = _FakeRepo(
            existing=(
                "dashboard/lib/require-session.ts",
                "dashboard/middleware.ts",
                "dashboard/lib/env-guards.ts",
            )
        )
        spec = _feature_flag(
            kind="harness",
            reader=["dashboard/lib/require-session.ts", "dashboard/middleware.ts"],
        )
        self.assertTrue(any("guard" in v for v in validate_flag("AUTH_BYPASS", spec, repo)))
        guarded = {**spec, "guard": "dashboard/lib/env-guards.ts"}
        self.assertEqual(validate_flag("AUTH_BYPASS", guarded, repo), [])

    def test_harness_flag_must_also_default_off(self) -> None:
        """A harness switch that defaults on would defeat its own production guard."""
        spec = _feature_flag(kind="harness", default=True, guard="dashboard/lib/env-guards.ts")
        violations = validate_flag("AUTH_BYPASS", spec, _FakeRepo())
        self.assertTrue(any("default" in v for v in violations))

    def test_capability_flag_rejects_two_readers(self) -> None:
        """A shipped capability is branched in one place so retiring it stays one edit."""
        spec = _feature_flag(
            kind="capability", default=True, reason="Load-bearing.", reader=["a.sh", "b.sh"]
        )
        violations = validate_flag("SSO_ENABLED", spec, _FakeRepo())
        self.assertTrue(any("exactly one reader" in v for v in violations))


class ValidateRegistryDocumentTests(unittest.TestCase):
    """Rules over the whole document: version, shape, and duplicate readers."""

    def _doc(self, **overrides: JsonValue) -> dict[str, JsonValue]:
        """Return a valid one-flag registry document with overrides applied."""
        doc: dict[str, JsonValue] = {
            "version": 1,
            "flags": {"FEATURE_A": _feature_flag()},
        }
        doc.update(overrides)
        return doc

    def test_valid_document_has_no_violations(self) -> None:
        """The happy path document reports no violations at all."""
        self.assertEqual(validate_registry_document(self._doc(), _FakeRepo()), [])

    def test_version_must_be_one(self) -> None:
        """A registry written against another schema version is refused."""
        self.assertTrue(
            any(
                "version" in v
                for v in validate_registry_document(self._doc(version=2), _FakeRepo())
            )
        )

    def test_flags_must_be_a_non_empty_mapping(self) -> None:
        """An empty, list-shaped, or string ``flags`` value all fail the gate."""
        bad_cases: list[JsonValue] = [{}, [], "nope"]
        for bad in bad_cases:
            violations = validate_registry_document(self._doc(flags=bad), _FakeRepo())
            self.assertTrue(any("flags" in v for v in violations), f"{bad!r} should fail")

    def test_flag_name_must_look_like_an_env_var(self) -> None:
        """A lowercase name would slip past the grep that audits a flag's sites."""
        violations = validate_registry_document(
            self._doc(flags={"lowercase_flag": _feature_flag()}), _FakeRepo()
        )
        self.assertTrue(any("UPPER_SNAKE" in v for v in violations))

    def test_two_flags_sharing_one_reader_is_a_violation(self) -> None:
        """Two feature flags entangled at one seam cannot be retired independently."""
        doc = self._doc(
            flags={
                "FEATURE_A": _feature_flag(),
                "FEATURE_B": _feature_flag(),
            }
        )
        violations = validate_registry_document(doc, _FakeRepo())
        self.assertTrue(any("shares its reader" in v for v in violations))

    def test_environments_must_map_to_booleans(self) -> None:
        """A per-environment override that is not a boolean is refused."""
        doc = self._doc(flags={"FEATURE_A": _feature_flag(environments={"dev": "yes"})})
        violations = validate_registry_document(doc, _FakeRepo())
        self.assertTrue(any("environments" in v for v in violations))

    def test_two_non_harness_flags_may_not_share_a_seam(self) -> None:
        """The sharing exemption is for harness flags only."""
        doc = self._doc(
            flags={
                "FEATURE_A": _feature_flag(kind="capability", reason="Shipped."),
                "FEATURE_B": _feature_flag(kind="capability", reason="Shipped."),
            }
        )
        violations = validate_registry_document(doc, _FakeRepo())
        self.assertTrue(any("shares its reader" in v for v in violations))

    def test_two_harness_flags_may_share_one_guard_expression(self) -> None:
        """AUTH_BYPASS and USE_MOCKS are tested in the same guard expression."""
        readers = ["dashboard/lib/require-session.ts", "dashboard/middleware.ts"]
        harness = _feature_flag(
            kind="harness",
            reader=list(readers),
            guard="dashboard/lib/env-guards.ts",
        )
        repo = _FakeRepo(
            existing=(
                "dashboard/lib/require-session.ts",
                "dashboard/middleware.ts",
                "dashboard/lib/env-guards.ts",
            ),
            contents="AUTH_BYPASS USE_MOCKS",
        )
        doc = self._doc(flags={"AUTH_BYPASS": dict(harness), "USE_MOCKS": dict(harness)})
        self.assertEqual(validate_registry_document(doc, repo), [])


class CheckFlagsFileTests(unittest.TestCase):
    """End-to-end behaviour of the gate against a real file on disk."""

    def test_missing_file_is_a_violation_not_a_crash(self) -> None:
        """A repository with no registry fails the gate instead of passing vacuously."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            violations = check_flags_file(root)
            self.assertTrue(any("config/flags.yaml" in v for v in violations))

    def test_valid_file_passes_and_empty_registry_reports(self) -> None:
        """A real file on disk is read, and an empty registry is still a failure."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            config = root / "config"
            config.mkdir()
            (config / "flags.yaml").write_text(
                "version: 1\n"
                "flags:\n"
                "  FEATURE_DEMO:\n"
                "    default: false\n"
                "    owner: lab-team\n"
                "    description: Demo flag.\n"
                "    expires: 2027-03-31\n"
                "    kind: feature\n"
                "    reader: scripts/lib/demo.sh\n",
                encoding="utf-8",
            )
            reader = root / "scripts" / "lib"
            reader.mkdir(parents=True)
            (reader / "demo.sh").write_text('[[ ${FEATURE_DEMO:-0} == "1" ]]\n', encoding="utf-8")
            self.assertEqual(check_flags_file(root), [])

            (config / "flags.yaml").write_text("version: 1\nflags: {}\n", encoding="utf-8")
            self.assertTrue(any("flags" in v for v in check_flags_file(root)))

    def test_load_registry_rejects_non_mapping_root(self) -> None:
        """A document whose root is a list raises instead of being silently skipped."""
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "flags.yaml"
            path.write_text("- one\n- two\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_registry(path)


class _FakeRepo:
    """Stand-in for the repository root used by the reader-existence checks."""

    def __init__(
        self,
        existing: tuple[str, ...] = ("scripts/lib/example.sh",),
        contents: str = (
            "FEATURE_EXPERIMENTAL_INDEXER SSO_ENABLED CONTEXT7_ENABLED "
            "AUTH_BYPASS USE_MOCKS FEATURE_A FEATURE_B FEATURE_X"
        ),
    ) -> None:
        """Remember which paths exist and what every one of them contains."""
        self.existing = frozenset(existing)
        self.contents = contents

    def is_file(self, relpath: str) -> bool:
        """Report whether ``relpath`` was declared to exist."""
        return relpath in self.existing

    def read_text(self, relpath: str) -> str:
        """Return the shared fixture text for any existing path."""
        return self.contents


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
