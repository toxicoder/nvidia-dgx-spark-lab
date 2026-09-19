#!/usr/bin/env python3
"""Guards for the visual-golden pipeline.

Committed screenshot baselines are only meaningful when they come from the same rendering
stack CI uses.  This repo has been bitten by baselines captured on a laptop: font metrics
differ per platform, so a Linux run then reports every page as changed.  These tests keep
the three facts that make that mistake impossible to repeat in sync:

1. the container image pins the same Playwright version the suite depends on, so the
   browser that produces a golden is the browser that compares against it;
2. the container runs the same OS/architecture as the CI job that enforces the gate;
3. the suite never invents a baseline while running in CI, where a silent self-bootstrap
   would commit an unreviewed image.

Run: bazelisk test //docs-site:visual_tooling_test
     (or: python3 -m unittest -v test_visual_tooling.py)
"""

from __future__ import annotations

import contextlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

PACKAGE_DIR = pathlib.Path(__file__).resolve().parent
SCRIPT = PACKAGE_DIR / "scripts" / "visual_linux.sh"
CONTAINER_SCRIPT = PACKAGE_DIR / "scripts" / "visual_linux_in_container.sh"
SPEC = PACKAGE_DIR / "tests" / "visual" / "site.spec.mjs"

sys.path.insert(0, str(PACKAGE_DIR / "scripts"))

import visual_linux_image  # noqa: E402

# Ubuntu runners serve the docs job; the container has to match it, not this workstation.
CI_PLATFORM = "linux/amd64"


def read(path: pathlib.Path) -> str:
    """Return a file's UTF-8 text, failing loudly when the file is absent."""
    assert path.is_file(), f"missing {path}"
    return path.read_text(encoding="utf-8")


@contextlib.contextmanager
def _package_dir(root: pathlib.Path):
    """Point the helper at a throwaway package root so its fallback paths can be exercised."""
    original = visual_linux_image.PACKAGE_DIR
    visual_linux_image.PACKAGE_DIR = root
    try:
        yield
    finally:
        visual_linux_image.PACKAGE_DIR = original


@contextlib.contextmanager
def _capture_stdout():
    """Collect what the command-line entry point prints."""
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        yield buffer


@contextlib.contextmanager
def _captured_args(argv: list[str]):
    """Pin ``sys.argv`` so a module run as ``__main__`` sees a known command line."""
    original = sys.argv
    sys.argv = ["visual_linux_image.py", *argv]
    try:
        yield
    finally:
        sys.argv = original


class VisualToolingTests(unittest.TestCase):
    """The Linux golden pipeline has to agree with CI's rendering environment."""

    def test_launcher_script_exists_and_is_executable(self) -> None:
        """The documented entry point is present and runnable by Bazel."""
        self.assertTrue(SCRIPT.is_file(), f"{SCRIPT} does not exist")
        self.assertTrue(SCRIPT.stat().st_mode & 0o111, f"{SCRIPT} is not executable")

    def test_pinned_playwright_image_matches_the_suite_version(self) -> None:
        """The container browser and the Playwright library driving it are one version.

        A mismatch means the golden is rendered by a different engine than the one that
        compares against it, which is the same class of bug as a cross-platform capture.
        """
        manifest = json.loads(read(PACKAGE_DIR / "package.json"))
        spec = manifest["devDependencies"]["@playwright/test"]

        # The launcher must not carry a second, hand-maintained version pin.
        script = read(SCRIPT)
        self.assertIn(
            "visual_linux_image.py",
            script,
            "the launcher should resolve the image through scripts/visual_linux_image.py",
        )

        image = visual_linux_image.image_reference()
        self.assertRegex(image, r"^[^/]+/playwright:v[0-9.]+-[a-z0-9]+$")
        tag = image.split(":")[-1]
        version, _, codename = tag.partition("-")
        self.assertEqual(
            visual_linux_image.mcr_tag(visual_linux_image.playwright_version()),
            version,
            "the container tag is not the MCR spelling of the resolved Playwright release",
        )
        self.assertEqual(codename, visual_linux_image.UBUNTU_CODENAME)
        # The resolved release has to satisfy the range the suite depends on.
        locked = re.findall(r"\d+", visual_linux_image.playwright_version())
        wanted = re.findall(r"\d+", spec)
        self.assertEqual(
            (int(locked[0]),),
            (int(wanted[0]),),
            f"Playwright {visual_linux_image.playwright_version()} is outside the {spec!r} range",
        )

    def test_launcher_runs_the_ci_platform(self) -> None:
        """The container is pinned to the architecture the docs CI job runs on."""
        self.assertEqual(visual_linux_image.PLATFORM, CI_PLATFORM)
        self.assertIn("docker run", read(SCRIPT))

    def test_launcher_builds_the_export_it_screenshots(self) -> None:
        """Goldens are captured from a build made inside the container, not a host leftover.

        The Next production bundle contains platform-specific native code, so reusing the
        laptop's export directory would compare a Linux browser against artefacts another
        machine produced.
        """
        container = read(CONTAINER_SCRIPT)
        self.assertIn("npm run build", container)
        self.assertRegex(container, r"npm ci\b", "the container does not install its own deps")
        # The host install must not leak in: node_modules is shadowed by a Linux-only volume.
        self.assertIn("node_modules", read(SCRIPT))

    def test_container_verifies_its_own_architecture_before_rendering(self) -> None:
        """The container refuses to draw baselines unless it is the CI architecture.

        A multi-architecture image store can resolve a tag to whichever variant it happens to
        hold, and the stored image config can then disagree with what the platform flag asked
        for.  Screenshots from the wrong renderer fail the docs CI job for every page, so the
        check has to run inside the container that does the work, before the build.
        """
        container = read(CONTAINER_SCRIPT)
        self.assertIn("EXPECTED_MACHINE", container)
        self.assertIn("uname", container)

        build_at = container.index("npm run build")
        check_at = container.index("EXPECTED_MACHINE")
        self.assertLess(check_at, build_at, "the architecture check must run before the build")

    def test_architecture_mapping_is_explicit_and_strict(self) -> None:
        """The platform-to-``uname`` mapping is one tested table, not shell string literals."""
        self.assertEqual(visual_linux_image.uname_machine_for(visual_linux_image.PLATFORM),
                         visual_linux_image.UNAME_MACHINE[visual_linux_image.PLATFORM.split("/", 1)[-1]])
        with self.assertRaises(LookupError):
            visual_linux_image.uname_machine_for("linux/riscv64")

    def test_suite_does_not_bootstrap_baselines_in_ci(self) -> None:
        """A missing baseline fails in CI instead of quietly creating one.

        Self-bootstrapping is what makes the first local run painless; in CI it would
        commit a screenshot nobody looked at, so the gate has to be strict there.
        """
        spec = read(SPEC)
        self.assertRegex(spec, r"\bCI\b", "the spec does not consult the CI environment")
        # The write branch has to be guarded, otherwise CI still invents baselines.
        guarded = re.search(r"(?:if\s*\(\s*!?CI\s*\)|CI\s*\?|&&\s*!CI|if\s*\(\s*CI\s*\))", spec)
        self.assertIsNotNone(guarded, "baseline self-bootstrap is not disabled under CI")

    def test_goldens_are_committed_for_every_captured_page(self) -> None:
        """Every page the spec captures has a baseline in both projects.

        With bootstrapping gone in CI, an absent file would otherwise surface as a failure
        only after the change is already merged.
        """
        spec = read(SPEC)
        slugs = re.findall(r"^\s*\[\s*[\"']([\w-]+)[\"']\s*,\s*[\"']/", spec, re.M)
        self.assertGreater(len(slugs), 0, "cannot read the captured page list")
        goldens = PACKAGE_DIR / "tests" / "visual" / "goldens"
        for project in ("desktop", "mobile"):
            for slug in slugs:
                self.assertTrue(
                    (goldens / project / f"{slug}.png").is_file(),
                    f"{project}: no committed baseline for {slug}",
                )


class ImageResolutionTests(unittest.TestCase):
    """The helper that names the capture image resolves it from the checkout, not from Docker."""

    @staticmethod
    def _completed(returncode: int = 0, stdout: str = "", stderr: str = ""):
        return subprocess.CompletedProcess(
            args=[], returncode=returncode, stdout=stdout, stderr=stderr
        )

    def setUp(self) -> None:
        self._real_run = visual_linux_image.subprocess.run

    def tearDown(self) -> None:
        visual_linux_image.subprocess.run = self._real_run

    def _fake_docker(self, responses: dict[str, tuple[int, str]]) -> list[list[str]]:
        """Route ``subprocess.run`` to canned answers keyed by the docker subcommand."""
        calls: list[list[str]] = []

        def run(command, *args, **kwargs):
            calls.append(list(command))
            key = command[1] if len(command) > 1 else ""
            code, out = responses.get(key, (0, ""))
            return self._completed(returncode=code, stdout=out)

        visual_linux_image.subprocess.run = run
        return calls

    def test_registry_prefix_comes_from_the_dashboard_test_image(self) -> None:
        """The registry is read out of the file that already names the image."""
        prefix = visual_linux_image.registry_prefix()
        self.assertRegex(prefix, r"^[^/]+(\.[^/]+)+$")
        self.assertIn("playwright", visual_linux_image.image_reference())

    def test_registry_prefix_reports_a_missing_base_image(self) -> None:
        """A Dockerfile without a Playwright base is an error, not a silent wrong registry."""
        original = visual_linux_image.DOCKERFILE
        try:
            visual_linux_image.DOCKERFILE = PACKAGE_DIR / "package.json"
            with self.assertRaises(LookupError):
                visual_linux_image.registry_prefix()
        finally:
            visual_linux_image.DOCKERFILE = original

    def test_playwright_version_prefers_the_lockfile(self) -> None:
        """CI installs from the lockfile, so that is the release the container must match."""
        locked = visual_linux_image.playwright_version()
        self.assertRegex(locked, r"^\d+\.\d+\.\d+$")
        manifest = json.loads(read(PACKAGE_DIR / "package.json"))
        spec = manifest["devDependencies"]["@playwright/test"]
        self.assertEqual(spec.lstrip("^~>= ").split(".")[0], locked.split(".")[0])

    def test_playwright_version_falls_back_to_the_manifest_range(self) -> None:
        """With no lockfile entry the declared range still yields a concrete release."""
        with tempfile.TemporaryDirectory() as workdir:
            root = pathlib.Path(workdir)
            (root / "package.json").write_text(
                json.dumps({"devDependencies": {"@playwright/test": "^1.63.0"}}), encoding="utf-8"
            )
            with _package_dir(root):
                self.assertEqual(visual_linux_image.playwright_version(), "1.63.0")

    def test_image_tag_uses_the_mcr_version_prefix(self) -> None:
        """MCR publishes versioned Playwright tags with a ``v`` prefix.

        A bare ``1.63.0-jammy`` tag does not exist in the registry, so a fresh runner (no
        resident image to rescue the probe) cannot pull it and the visual gate dies before
        comparing a single baseline.
        """
        with tempfile.TemporaryDirectory() as workdir:
            root = pathlib.Path(workdir)
            (root / "package.json").write_text(
                json.dumps({"devDependencies": {"@playwright/test": "^1.63.0"}}), encoding="utf-8"
            )
            (root / "package-lock.json").write_text(
                json.dumps(
                    {"packages": {"node_modules/@playwright/test": {"version": "1.63.0"}}}
                ),
                encoding="utf-8",
            )
            with _package_dir(root):
                reference = visual_linux_image.image_reference()
                self.assertTrue(
                    reference.endswith(f"playwright:v1.63.0-{visual_linux_image.UBUNTU_CODENAME}"),
                    f"tag must carry the MCR version prefix, got {reference}",
                )

    def test_mcr_tag_is_idempotent_for_prefixed_versions(self) -> None:
        """A version that already carries the prefix must not gain a second one."""
        self.assertEqual(visual_linux_image.mcr_tag("v1.63.0"), "v1.63.0")
        self.assertEqual(visual_linux_image.mcr_tag("1.63.0"), "v1.63.0")

    def test_playwright_version_without_any_source_is_an_error(self) -> None:
        """Guessing a browser build is what lets a wrong renderer slip in, so it is refused."""
        with tempfile.TemporaryDirectory() as workdir:
            root = pathlib.Path(workdir)
            (root / "package.json").write_text(
                json.dumps({"devDependencies": {"@playwright/test": "latest"}}), encoding="utf-8"
            )
            with _package_dir(root):
                with self.assertRaises(LookupError):
                    visual_linux_image.playwright_version()

    def test_digest_pins_the_requested_architecture(self) -> None:
        """The digest for the CI architecture is chosen out of the published manifest."""
        manifest = json.dumps(
            {"manifests": [
                {"digest": "sha256:arm", "platform": {"os": "linux", "architecture": "arm64"}},
                {"digest": "sha256:amd", "platform": {"os": "linux", "architecture": "amd64"}},
            ]}
        )
        calls = self._fake_docker({"manifest": (0, manifest)})
        image = visual_linux_image.image_reference()
        self.assertEqual(visual_linux_image.platform_digest(image, "amd64"), "sha256:amd")
        self.assertEqual(calls[0][:2], ["docker", "manifest"])

    def test_unreadable_manifest_is_not_fatal(self) -> None:
        """A registry that cannot be queried falls back to the tag rather than failing."""
        self._fake_docker({"manifest": (1, "no such manifest")})
        self.assertEqual(visual_linux_image.platform_digest("registry/img:tag", "amd64"), "")

    def test_manifest_without_the_architecture_is_an_error(self) -> None:
        """A manifest that reads fine but lacks the architecture must not pass silently."""
        manifest = json.dumps(
            {"manifests": [{"digest": "sha256:arm", "platform": {"os": "linux", "architecture": "arm64"}}]}
        )
        self._fake_docker({"manifest": (0, manifest)})
        with self.assertRaises(LookupError):
            visual_linux_image.platform_digest("registry/img:tag", "amd64")

    def test_resident_ids_are_filtered_to_the_repository(self) -> None:
        """Untagged rows and other repositories are not offered as candidates."""
        listing = "registry/img  sha256:aaa\nregistry/img  <none>\nother/img  sha256:bbb\n"
        calls = self._fake_docker({"images": (0, listing)})
        self.assertEqual(visual_linux_image.resident_image_ids("registry/img"), ["sha256:aaa"])
        self.assertEqual(calls[0][:3], ["docker", "images", "--format"])

    def test_unusable_docker_listing_yields_no_candidates(self) -> None:
        """A failing listing is empty rather than an exception during a refresh."""
        self._fake_docker({"images": (1, "daemon offline")})
        self.assertEqual(visual_linux_image.resident_image_ids("registry/img"), [])

    def test_candidates_are_ordered_strongest_first_and_deduplicated(self) -> None:
        """The digest leads; the tag and resident IDs follow, each listed once."""
        manifest = json.dumps(
            {"manifests": [{"digest": "sha256:amd", "platform": {"os": "linux", "architecture": "amd64"}}]}
        )
        image = visual_linux_image.image_reference()
        repository = image.split(":")[0]
        self._fake_docker({"manifest": (0, manifest), "images": (0, f"{repository}  sha256:aaa\n")})
        found = visual_linux_image.candidate_references("amd64")
        self.assertEqual(found[0], f"{repository}@sha256:amd")
        self.assertEqual(found.count(image), 1)
        self.assertIn("sha256:aaa", found)

    def test_default_candidates_resolve_the_manifest_for_the_default_platform(self) -> None:
        """The CLI path (``--print-candidates``) passes no argument at all.

        With a readable registry manifest — which the MCR version prefix now guarantees —
        the digest must still be found for the default platform.  The default used to be
        the full ``linux/amd64`` string, which no manifest line carries as its
        architecture, so the candidate list raised a ``LookupError`` on a fresh runner.
        """
        manifest = json.dumps(
            {"manifests": [
                {"digest": "sha256:arm", "platform": {"os": "linux", "architecture": "arm64"}},
                {"digest": "sha256:amd", "platform": {"os": "linux", "architecture": "amd64"}},
            ]}
        )
        image = visual_linux_image.image_reference()
        repository = image.split(":")[0]
        self._fake_docker({"manifest": (0, manifest), "images": (0, "")})
        found = visual_linux_image.candidate_references()
        self.assertEqual(found[0], f"{repository}@sha256:amd")

    def test_unsupported_platform_is_rejected(self) -> None:
        """An architecture with no ``uname`` mapping cannot be verified, so it is refused."""
        with self.assertRaises(LookupError):
            visual_linux_image.uname_machine_for("linux/riscv64")

    def test_main_module_guard(self) -> None:
        """The helper runs as a script, which is how the launcher calls it.

        ``sys.argv`` is pinned so the guard prints the image reference regardless of the flags
        the surrounding test runner was handed.
        """
        import runpy

        with _captured_args([]):
            with self.assertRaises(SystemExit) as raised:
                runpy.run_path(
                    str(PACKAGE_DIR / "scripts" / "visual_linux_image.py"),
                    run_name="__main__",
                )
        self.assertEqual(raised.exception.code, 0, "the CLI must exit successfully")

    def test_command_line_reports_each_value(self) -> None:
        """The launcher reads these flags, so their output is part of the contract."""
        self._fake_docker({"manifest": (1, ""), "images": (0, "")})
        for flag, expected in (
            ("--print-platform", visual_linux_image.PLATFORM),
            ("--print-codename", visual_linux_image.UBUNTU_CODENAME),
            ("--print-uname-machine", visual_linux_image.UNAME_MACHINE["amd64"]),
        ):
            with _capture_stdout() as captured:
                self.assertEqual(visual_linux_image.main([flag]), 0)
            self.assertEqual(captured.getvalue().strip(), expected)

        with _capture_stdout() as captured:
            self.assertEqual(visual_linux_image.main([]), 0)
        self.assertEqual(captured.getvalue().strip(), visual_linux_image.image_reference())

        with _capture_stdout() as captured:
            self.assertEqual(visual_linux_image.main(["--print-candidates"]), 0)
        self.assertIn(visual_linux_image.image_reference(), captured.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
