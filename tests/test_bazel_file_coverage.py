#!/usr/bin/env python3
"""Unit tests for the Bazel file-coverage gate helpers."""

from __future__ import annotations

import pathlib
import tempfile
import unittest

from bazel_file_coverage import (
    SANCTIONED_GLOBS,
    build_files,
    collect_declared_outputs,
    collect_exact_glob_names,
    collect_globbed_files,
    collect_referenced_files,
    glob_violations,
    is_exempt,
    matches_glob,
    parse_build_references,
    unowned_files,
)


def _write_file(root: pathlib.Path, rel: str) -> None:
    """Create an empty file under ``root``, making its parent directories.

    Args:
        root: Temporary repository root.
        rel: Repository-relative POSIX path to create.
    """
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("", encoding="utf-8")


class TestBuildFiles(unittest.TestCase):
    """build_files discovers BUILD files and honours the declared workspace exclusions."""

    def test_skips_output_base_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = pathlib.Path(raw)
            _write_file(root, "dashboard/BUILD.bazel")
            _write_file(root, "bazel-out/BUILD.bazel")

            found = [p.relative_to(root).as_posix() for p in build_files(root)]

            self.assertEqual(found, ["dashboard/BUILD.bazel"])

    def test_skips_directories_declared_in_bazelignore(self) -> None:
        # `next build` copies the app's own BUILD.bazel into <app>/.next/standalone/. That tree
        # is a build output, declared out of the workspace by .bazelignore, so the gate must not
        # read it as a package -- otherwise every local `//dashboard:visual` run fails the gate
        # with globs and dangling references nobody wrote.
        with tempfile.TemporaryDirectory() as raw:
            root = pathlib.Path(raw)
            _write_file(root, "dashboard/BUILD.bazel")
            _write_file(root, "dashboard/.next/standalone/BUILD.bazel")
            _write_file(root, "docs-site/.next/standalone/BUILD.bazel")
            _write_file(root, "node_modules/pkg/BUILD.bazel")
            (root / ".bazelignore").write_text(
                "# generated output\nnode_modules/\ndashboard/.next/\ndocs-site/.next/\n",
                encoding="utf-8",
            )

            found = [p.relative_to(root).as_posix() for p in build_files(root)]

            self.assertEqual(found, ["dashboard/BUILD.bazel"])

    def test_treats_a_leading_double_star_as_any_directory(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = pathlib.Path(raw)
            _write_file(root, "scripts/BUILD.bazel")
            _write_file(root, "scripts/lib/__pycache__/BUILD.bazel")
            (root / ".bazelignore").write_text("**/__pycache__/\n", encoding="utf-8")

            found = [p.relative_to(root).as_posix() for p in build_files(root)]

            self.assertEqual(found, ["scripts/BUILD.bazel"])


class TestParseBuildReferences(unittest.TestCase):
    """parse_build_references resolves file-consuming string literals."""

    def test_srcs_and_data_resolve_against_the_package(self) -> None:
        """Relative paths in srcs/data belong to the BUILD file's package."""
        text = """
filegroup(
    name = "things",
    srcs = ["a.yaml", "nested/b.yaml"],
    data = ["prometheus.yml"],
)
"""
        self.assertEqual(
            parse_build_references(text, "k8s/base"),
            {"k8s/base/a.yaml", "k8s/base/nested/b.yaml", "k8s/base/prometheus.yml"},
        )

    def test_labels_and_loads_are_not_files(self) -> None:
        """Bazel labels, load paths, tags, and visibilities never count as files."""
        text = """
load("@rules_shell//shell:sh_test.bzl", "sh_test")

package(default_visibility = ["//visibility:public"])

sh_test(
    name = "t",
    srcs = ["t.sh"],
    data = ["//config:resource_policy", "@bats_core//:bin/bats"],
    tags = ["manual", "local"],
    size = "small",
)
"""
        self.assertEqual(parse_build_references(text, "tests"), {"tests/t.sh"})

    def test_module_variables_count(self) -> None:
        """Paths staged in module-level lists are still explicit references."""
        text = """
_MIN = ["README.md", "bats/test_helper.bash"]

sh_test(name = "t", data = _MIN + ["extra.sh"])
"""
        self.assertEqual(
            parse_build_references(text, "tests"),
            {"tests/README.md", "tests/bats/test_helper.bash", "tests/extra.sh"},
        )

    def test_extension_less_names_count_in_file_positions(self) -> None:
        """``Dockerfile`` and ``LICENSE`` are files even with no dot or slash."""
        text = 'filegroup(name = "d", srcs = ["Dockerfile", "LICENSE"])\n'
        self.assertEqual(
            parse_build_references(text, "dashboard"),
            {"dashboard/Dockerfile", "dashboard/LICENSE"},
        )

    def test_tag_and_size_strings_never_count_as_files(self) -> None:
        """Only file-consuming attributes can declare ownership."""
        text = 'sh_test(name = "t", srcs = ["t.sh"], tags = ["manual"], size = "small")\n'
        self.assertEqual(parse_build_references(text, "tests"), {"tests/t.sh"})

    def test_module_docstring_is_not_a_reference(self) -> None:
        """Docstrings describe the package; they do not own files."""
        text = '"""Package purpose: covers notes.md and Makefile."""\n\nfilegroup(name = "x", srcs = ["real.sh"])\n'
        self.assertEqual(parse_build_references(text, "docs"), {"docs/real.sh"})

    def test_exported_files_count(self) -> None:
        """exports_files() is an explicit ownership declaration."""
        text = 'exports_files(["manage.sh", "yaml_format.sh"])\n'
        self.assertEqual(
            parse_build_references(text, "scripts"),
            {"scripts/manage.sh", "scripts/yaml_format.sh"},
        )

    def test_glob_patterns_are_not_explicit_ownership(self) -> None:
        """Globs are accounted for separately, never as a hand-written claim."""
        text = (
            'filegroup(name = "config", srcs = glob(["config/**"], '
            'exclude = ["config/secrets.env"]))\n'
        )
        self.assertEqual(parse_build_references(text, "mcp"), set())


class TestCollectReferencedFiles(unittest.TestCase):
    """collect_referenced_files merges every BUILD file in the repo."""

    def test_merges_packages(self) -> None:
        """References from every package are unioned."""
        builds = {
            "BUILD.bazel": 'filegroup(name = "a", srcs = ["README.md"])\n',
            "k8s/base/BUILD.bazel": 'filegroup(name = "b", srcs = ["kustomization.yaml"])\n',
        }
        self.assertEqual(
            collect_referenced_files(builds),
            {"README.md", "k8s/base/kustomization.yaml"},
        )

    def test_declared_outputs_are_tracked_separately(self) -> None:
        """Outs are Bazel-owned but must not be checked for existence."""
        builds = {
            "dashboard/BUILD.bazel": (
                'genrule(name = "stamp", outs = ["imported.stamp"], cmd = "touch $@")\n'
            )
        }
        self.assertEqual(collect_referenced_files(builds), set())
        self.assertEqual(collect_declared_outputs(builds), {"dashboard/imported.stamp"})


class TestMatchesGlob(unittest.TestCase):
    """matches_glob mirrors Bazel's glob() path semantics."""

    def test_single_star_stops_at_separators(self) -> None:
        """``*.yaml`` matches only files directly in the package."""
        self.assertTrue(matches_glob("a.yaml", ["*.yaml"], []))
        self.assertFalse(matches_glob("nested/a.yaml", ["*.yaml"], []))

    def test_double_star_crosses_separators(self) -> None:
        """``**/*.yaml`` reaches any depth, including the package root."""
        patterns = ["**/*.yaml"]
        self.assertTrue(matches_glob("a.yaml", patterns, []))
        self.assertTrue(matches_glob("a/b/c.yaml", patterns, []))
        self.assertFalse(matches_glob("a/b/c.json", patterns, []))

    def test_trailing_double_star_matches_a_whole_tree(self) -> None:
        """``roles/**`` matches everything below the directory."""
        self.assertTrue(matches_glob("roles/r/tasks/main.yml", ["roles/**"], []))
        self.assertFalse(matches_glob("playbooks/x.yml", ["roles/**"], []))

    def test_exclude_wins_over_include(self) -> None:
        """An excluded path is dropped even when the pattern includes it."""
        self.assertFalse(matches_glob("config/secrets.env", ["config/**"], ["config/secrets.env"]))

    def test_dot_is_literal_not_a_regex_wildcard(self) -> None:
        """Dots in patterns match only themselves."""
        self.assertFalse(matches_glob("ayaml", ["*.yaml"], []))


class TestCollectGlobbedFiles(unittest.TestCase):
    """collect_globbed_files expands globs the way Bazel would."""

    def test_matches_package_tree(self) -> None:
        """Files under the package are claimed by a recursive glob."""
        builds = {"helm/BUILD.bazel": 'filegroup(name = "c", srcs = glob(["**/*"]))\n'}
        tracked = ["helm/Chart.yaml", "helm/templates/deploy.yaml", "docs/x.md"]
        self.assertEqual(
            collect_globbed_files(builds, tracked, {"helm", "docs"}),
            {"helm/Chart.yaml", "helm/templates/deploy.yaml"},
        )

    def test_never_reaches_into_a_child_package(self) -> None:
        """A nested package's files belong to that package, not the globbing one."""
        builds = {
            "k8s/overlays/single-node/BUILD.bazel": (
                'filegroup(name = "o", srcs = glob(["**/*.yaml"]))\n'
            )
        }
        tracked = [
            "k8s/overlays/single-node/kustomization.yaml",
            "k8s/overlays/single-node/qwen36-dual/kustomization.yaml",
        ]
        self.assertEqual(
            collect_globbed_files(builds, tracked, {"k8s/overlays/single-node/qwen36-dual"}),
            {"k8s/overlays/single-node/kustomization.yaml"},
        )

    def test_extension_is_literal_so_yml_needs_its_own_pattern(self) -> None:
        """``*.yaml`` does not claim ``.yml`` siblings (the configuration.yml bug)."""
        builds = {
            "k8s/auth/generated/BUILD.bazel": ('filegroup(name = "g", srcs = glob(["*.yaml"]))\n')
        }
        tracked = [
            "k8s/auth/generated/authelia-configmap.yaml",
            "k8s/auth/generated/configuration.yml",
        ]
        self.assertEqual(
            collect_globbed_files(builds, tracked, {"k8s/auth/generated"}),
            {"k8s/auth/generated/authelia-configmap.yaml"},
        )


class TestGlobViolations(unittest.TestCase):
    """glob_violations() keeps wildcards deliberate without banning them."""

    def test_unsanctioned_pattern_is_reported(self) -> None:
        """A new wildcard with no written reason fails the gate."""
        builds = {"helm/BUILD.bazel": 'filegroup(name = "c", srcs = glob(["*.json"]))\n'}
        problems = glob_violations(builds)
        self.assertEqual(len(problems), 1)
        self.assertIn("not sanctioned", problems[0])
        self.assertIn("*.json", problems[0])

    def test_sanctioned_pattern_is_allowed(self) -> None:
        """A wildcard listed in SANCTIONED_GLOBS passes."""
        allowed = SANCTIONED_GLOBS["config/BUILD.bazel"]
        builds = {
            "config/BUILD.bazel": (f'filegroup(name = "d", srcs = glob({sorted(allowed)}))\n')
        }
        self.assertEqual(glob_violations(builds), [])

    def test_stale_sanction_is_reported(self) -> None:
        """A sanction whose pattern is gone is dead policy and fails."""
        self.assertEqual(len(SANCTIONED_GLOBS["config/BUILD.bazel"]), 1)
        builds = {"config/BUILD.bazel": 'filegroup(name = "c", srcs = ["a.json"])\n'}
        problems = glob_violations(builds)
        self.assertEqual(len(problems), 1)
        self.assertIn("no longer uses", problems[0])

    def test_explicit_lists_need_no_sanction(self) -> None:
        """Listing files by name is always allowed."""
        builds = {"helm/BUILD.bazel": 'filegroup(name = "c", srcs = ["Chart.yaml"])\n'}
        self.assertEqual(glob_violations(builds), [])

    def test_glob_of_one_literal_path_is_not_a_wildcard(self) -> None:
        """``glob(["Chart.yaml"])`` names a file, so it needs no sanction."""
        builds = {"helm/BUILD.bazel": 'filegroup(name = "c", srcs = glob(["Chart.yaml"]))\n'}
        self.assertEqual(glob_violations(builds), [])
        self.assertEqual(collect_exact_glob_names(builds), {"helm/Chart.yaml"})


class TestIsExempt(unittest.TestCase):
    """is_exempt() hides only the documented non-build inputs."""

    def test_bazel_control_files_are_exempt(self) -> None:
        """Bazel reads its own control files implicitly."""
        for path in (
            ".bazelrc",
            ".bazelversion",
            ".bazelignore",
            "MODULE.bazel",
            "MODULE.bazel.lock",
            "BUILD.bazel",
            "k8s/base/BUILD.bazel",
        ):
            self.assertTrue(is_exempt(path), path)

    def test_operator_secret_tree_is_exempt(self) -> None:
        """Operator identity material stays out of the build graph."""
        self.assertTrue(is_exempt("secrets/identities/README.md"))
        self.assertTrue(is_exempt("secrets/identities/.gitkeep"))
        self.assertTrue(is_exempt("secrets/README.md"))

    def test_dotenv_files_are_exempt(self) -> None:
        """Live dotenv files are runtime secrets; .env.example is a template."""
        self.assertTrue(is_exempt("dashboard/.env"))
        self.assertTrue(is_exempt("mcp/config/.env.production"))
        self.assertFalse(is_exempt("dashboard/.env.example"))

    def test_ordinary_docs_and_templates_are_not_exempt(self) -> None:
        """READMEs, examples, goldens, and editor config need an owner."""
        for path in (
            "k8s/workloads/kimi/README.md",
            "Makefile",
            ".vscode/tasks.json",
            "dashboard/.env.example",
            "docs/tests/visual/goldens/index.png",
        ):
            self.assertFalse(is_exempt(path), path)


class TestUnownedFiles(unittest.TestCase):
    """unowned_files() reports tracked paths with no explicit owner."""

    def test_reports_only_unowned_and_non_exempt(self) -> None:
        """Owned and exempt paths are dropped; the rest are reported sorted."""
        tracked = [
            "Makefile",
            "README.md",
            "k8s/base/kustomization.yaml",
            "secrets/identities/id.json",
            "docs/notes.md",
        ]
        referenced = {"README.md", "docs/notes.md"}
        self.assertEqual(
            unowned_files(tracked, referenced),
            ["Makefile", "k8s/base/kustomization.yaml"],
        )


if __name__ == "__main__":
    unittest.main()
