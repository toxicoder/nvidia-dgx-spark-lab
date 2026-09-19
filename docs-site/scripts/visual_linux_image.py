#!/usr/bin/env python3
"""Print the container image that renders the documentation-site screenshot baselines.

The visual gate compares screenshots, so the browser that produces a baseline has to be the
same build that later compares against it.  Both halves of that pin come from files already in
the checkout rather than from a second hand-maintained version:

* the registry prefix is read from ``dashboard/Dockerfile.test``, which already names the
  Playwright image the dashboard's hermetic tests use;
* the release is the version ``docs-site`` actually resolves for ``@playwright/test`` (the
  lockfile entry, falling back to the range in the manifest).

``scripts/visual_linux.sh`` calls this, and ``test_visual_tooling.py`` asserts the result, so
the two cannot drift.

Run: python3 docs-site/scripts/visual_linux_image.py
"""

from __future__ import annotations

import json
import subprocess
import re
import sys
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_DIR.parent
DOCKERFILE = REPO_ROOT / "dashboard" / "Dockerfile.test"

# The docs CI job runs on ubuntu-latest; the codename has to match that image family so font
# packages resolve identically between a refresh and the pipeline.
UBUNTU_CODENAME = "jammy"
PLATFORM = "linux/amd64"


def registry_prefix() -> str:
    """Return the registry path that hosts the Playwright image, e.g. ``mcr.microsoft.com``.

    Raises:
        LookupError: If the dashboard test image no longer names a Playwright base image.
    """
    text = DOCKERFILE.read_text(encoding="utf-8")
    match = re.search(r"^FROM\s+(\S*playwright\S*):\S+", text, re.M)
    if match is None:
        raise LookupError(
            f"{DOCKERFILE} does not name a Playwright base image; update registry_prefix() "
            "together with it"
        )
    return match.group(1).split("/")[0]


def playwright_version() -> str:
    """Return the exact Playwright release the visual suite runs against.

    The lockfile wins because that is the build ``npm ci`` installs in CI; the manifest range is
    only a fallback for a checkout without a lockfile.

    Raises:
        LookupError: If neither source yields a three-part version.
    """
    lock_path = PACKAGE_DIR / "package-lock.json"
    if lock_path.is_file():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        entry = (lock.get("packages") or {}).get("node_modules/@playwright/test") or {}
        pinned = entry.get("version")
        if pinned:
            return pinned

    manifest = json.loads((PACKAGE_DIR / "package.json").read_text(encoding="utf-8"))
    spec = (manifest.get("devDependencies") or {}).get("@playwright/test", "")
    match = re.search(r"\d+\.\d+\.\d+", spec)
    if match is None:
        raise LookupError(
            "cannot resolve a Playwright version: no lockfile entry and no explicit version in "
            "package.json devDependencies"
        )
    return match.group(0)


def mcr_tag(version: str) -> str:
    """Render a release as the tag MCR publishes it under (versioned tags carry a ``v``).

    ``playwright:1.63.0-jammy`` does not exist in the registry; only ``v1.63.0-jammy`` does.
    """
    return version if version.startswith("v") else f"v{version}"


def image_reference() -> str:
    """Return the fully-qualified image reference used to capture baselines."""
    return f"{registry_prefix()}/playwright:{mcr_tag(playwright_version())}-{UBUNTU_CODENAME}"


def platform_digest(image: str, want: str) -> str:
    """Return the manifest digest of ``image`` for ``linux/<want>``, or ``""`` if unreadable.

    A digest removes the tag ambiguity that a multi-architecture store can resolve to
    whichever variant it happens to hold, so the launcher prefers it.  The registry manifest is
    not always reachable, and a failure here is deliberately not fatal: the caller keeps the
    tag as a fallback and the container asserts its own architecture before drawing anything.

    Raises:
        LookupError: If the manifest reads fine but publishes no variant for that architecture.
    """
    result = subprocess.run(
        ["docker", "manifest", "inspect", image],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return ""
    for entry in json.loads(result.stdout).get("manifests", []):
        platform = entry.get("platform", {})
        if platform.get("os") == "linux" and platform.get("architecture") == want:
            return entry["digest"]
    raise LookupError(f"{image} publishes no linux/{want} variant")


def resident_image_ids(repository: str) -> list[str]:
    """Return image IDs already present locally for ``repository``, newest first.

    A store whose tag mapping is damaged can still hold the right variant untagged, and the
    launcher verifies every candidate by starting it, so offering these costs nothing and keeps
    a refresh working off-line once the image has been fetched once.
    """
    result = subprocess.run(
        ["docker", "images", "--format", "{{.Repository}} {{.ID}}", repository],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    identifiers = []
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[0] == repository and fields[1] != "<none>":
            identifiers.append(fields[1])
    return identifiers


def candidate_references(want: str = PLATFORM.split("/")[-1]) -> list[str]:
    """Return image references to try, best guarantee first.

    ``want`` is a bare architecture (``amd64``), matching what a manifest line carries and
    what the launcher verifies; the default is the architecture of :data:`PLATFORM`.  The
    digest-pinned reference names one architecture outright, so it leads.  The plain tag and
    then any locally-resident image ID follow for when the manifest cannot be read or the tag
    mapping is unusable; all of them are safe to attempt because the launcher only accepts a
    candidate whose container reports the expected machine.
    """
    image = image_reference()
    references = [image]
    digest = platform_digest(image, want)
    if digest:
        references.insert(0, f"{image.split(':')[0]}@{digest}")
    references.extend(resident_image_ids(image.split(":")[0]))
    return list(dict.fromkeys(references))


# ``uname -m`` inside the container is the only trustworthy statement of what actually ran: a
# tag can resolve to whichever variant a local store happens to hold, and the stored config
# then disagrees with what ``--platform`` selected.  The mapping lives here, in one place and
# covered by a unit test, rather than spelled out in shell.
UNAME_MACHINE = {
    "amd64": "x86_64",
    "arm64": "aarch64",
}


def uname_machine_for(platform: str) -> str:
    """Return what ``uname -m`` reports inside a container started for ``platform``.

    Raises:
        LookupError: If the architecture is not one the launcher supports.
    """
    arch = platform.split("/", 1)[-1]
    try:
        return UNAME_MACHINE[arch]
    except KeyError:
        raise LookupError(
            f"unsupported platform {platform!r}; known architectures: {sorted(UNAME_MACHINE)}"
        ) from None


def main(argv: list[str]) -> int:
    """Print the image reference, the platform, or the ``uname`` machine for that platform."""
    if "--print-platform" in argv:
        print(PLATFORM)
    elif "--print-codename" in argv:
        print(UBUNTU_CODENAME)
    elif "--print-candidates" in argv:
        print("\n".join(candidate_references()))
    elif "--print-uname-machine" in argv:
        print(uname_machine_for(PLATFORM))
    else:
        print(image_reference())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
