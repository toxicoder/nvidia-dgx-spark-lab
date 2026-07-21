"""MkDocs build/serve hooks for nvidia-dgx-spark-lab docs.

Injects a tiny inline <script> at the very start of <head> that patches
window.fetch and XMLHttpRequest for GitHub API calls to the repo.

This suppresses the "Failed to load resource: 404" console errors that the
Material for MkDocs bundle triggers (it calls api.github.com for repo stats
and /releases/latest to render star counts etc in the header).

We do this for private repos (GitHub returns 404 for /repos/* on private
instead of 403). We intentionally keep repo_url + edit_uri in mkdocs.yml
because they enable "Edit this page on GitHub" links and the repository
icon navigation. The patch only prevents the stats fetch spam.

When ``MIKE_DOCS_VERSION`` or ``DGX_DOCS_VERSION`` is ``development``, also
inject a small banner so readers know they are on the development docs alias.

Branch-aware site artifacts (mike aliases ``latest`` / ``development``):

- ``on_config`` sets ``edit_uri`` to the long-lived git ref for the alias
  (``edit/main/docs/`` or ``edit/development/docs/``).
- ``on_page_markdown`` rewrites this-repo GitHub ``blob``/``tree`` links so
  source links match the same ref. Optional override: ``DGX_DOCS_GIT_REF``.
"""

from __future__ import annotations

import os
import re
from typing import Any

# Keep in sync with any manual patches. Must be self-contained (no deps).
_GITHUB_API_PATCH = (
    "<script>"
    "(function(){"
    "try{var orig=window.fetch;"
    'if(typeof orig==="function"){window.fetch=function(i,init){'
    'var u=(typeof i==="string")?i:(i&&typeof i.url==="string"?i.url:"");'
    'if(u.indexOf("api.github.com/repos/toxicoder/nvidia-dgx-spark-lab")!==-1){'
    'return Promise.resolve(new Response("{}", {status:200,headers:{"Content-Type":"application/json"}}));}'
    "return orig.apply(this,arguments);"
    "};}}catch(e){}"
    "try{var XHR=window.XMLHttpRequest;"
    "if(XHR&&XHR.prototype){var p=XHR.prototype,open=p.open;"
    "p.open=function(m,u){"
    'if(typeof u==="string"&&u.indexOf("api.github.com/repos/toxicoder/nvidia-dgx-spark-lab")!==-1){'
    "var self=this;"
    'Object.defineProperty(self,"responseText",{get:function(){return"{}"},configurable:!0});'
    'Object.defineProperty(self,"status",{get:function(){return 200},configurable:!0});'
    'Object.defineProperty(self,"readyState",{get:function(){return 4},configurable:!0});'
    "self.send=function(){setTimeout(function(){"
    'try{if(typeof self.onreadystatechange==="function")self.onreadystatechange.call(self);}catch(_){}'
    'try{if(typeof self.onload==="function")self.onload.call(self);}catch(_){}'
    "},0);};"
    "return;"
    "}"
    "return open.apply(this,arguments);"
    "};}}catch(e){}"
    "})();"
    "</script>"
)

_DEV_BANNER = (
    '<div class="dgx-docs-dev-banner" role="status">'
    "<strong>Development docs</strong> — this site version tracks the "
    "<code>development</code> branch and may change without a release tag. "
    'Prefer <a href="../latest/">latest</a> for production-ready guidance.'
    "</div>"
)

# This-repo GitHub blob/tree links whose long-lived branch segment we stamp.
_REPO_GITHUB_REF_RE = re.compile(
    r"(https://github\.com/toxicoder/nvidia-dgx-spark-lab/"
    r"(?:blob|tree)/)"
    r"(main|master|development)"
    r"(/)",
)


def docs_version() -> str:
    """Return the active docs version alias from the environment.

    Prefers ``MIKE_DOCS_VERSION``, then ``DGX_DOCS_VERSION``. Values are
    stripped and lowercased. Empty string when unset.

    Returns:
        Docs version alias (e.g. ``development``, ``latest``) or ``""``.
    """
    return (
        os.environ.get("MIKE_DOCS_VERSION") or os.environ.get("DGX_DOCS_VERSION") or ""
    ).strip().lower()


def docs_git_ref() -> str:
    """Return the long-lived git ref for Edit links and source URLs.

    Mapping:

    - ``DGX_DOCS_GIT_REF`` override (if set) wins.
    - Docs version ``development`` → branch ``development``.
    - Otherwise (including empty/latest) → branch ``main``.

    Short-lived feature branch names are intentionally not inferred so
    unpublished edit/source links do not 404.

    Returns:
        ``main`` or ``development`` (or an explicit override value).
    """
    override = (os.environ.get("DGX_DOCS_GIT_REF") or "").strip()
    if override:
        return override
    if docs_version() == "development":
        return "development"
    return "main"


def on_config(config: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Stamp ``edit_uri`` for the active docs git ref.

    Args:
        config: MkDocs config mapping (mutated in place).
        **kwargs: Unused MkDocs hook metadata accepted for API compatibility.

    Returns:
        The same config mapping with ``edit_uri`` set to
        ``edit/<ref>/docs/``.
    """
    del kwargs  # MkDocs may pass extra kwargs; ignore for API stability.
    config["edit_uri"] = f"edit/{docs_git_ref()}/docs/"
    return config


def on_page_markdown(markdown: str, **kwargs: Any) -> str:
    """Rewrite this-repo GitHub blob/tree branch segments to ``docs_git_ref()``.

    Source markdown may hardcode ``main``, ``master``, or ``development``;
    the published alias decides the final ref. Third-party GitHub URLs are
    left unchanged. Fragments and query strings are preserved because only
    the branch path segment is replaced.

    Args:
        markdown: Raw page markdown before rendering.
        **kwargs: Unused MkDocs hook metadata accepted for API compatibility.

    Returns:
        Markdown with branch-stamped GitHub source links for this repository.
    """
    del kwargs
    ref = docs_git_ref()

    def _replace(m: re.Match[str]) -> str:
        """Swap the long-lived branch segment for the active docs git ref.

        Args:
            m: Match with prefix (blob|tree URL), old ref, and trailing slash.

        Returns:
            Same URL with the active ref.
        """
        return f"{m.group(1)}{ref}{m.group(3)}"

    return _REPO_GITHUB_REF_RE.sub(_replace, markdown)


def on_post_page(output: str, **kwargs: Any) -> str:
    """Insert the GitHub patch script and optional development banner.

    Args:
        output: Rendered HTML page content from MkDocs.
        **kwargs: Unused MkDocs hook metadata accepted for API compatibility.

    Returns:
        HTML with the inline GitHub API patch script injected once after
        the first ``<head>`` opening tag, plus a development banner when
        the docs version env vars indicate the development alias.
    """
    del kwargs

    def _inject(m: re.Match[str]) -> str:
        """Append the patch script to the matched ``<head>`` opening tag.

        Args:
            m: Regex match for the opening ``<head>`` tag.

        Returns:
            Original ``<head>`` tag followed by the inline patch script.
        """
        return m.group(1) + _GITHUB_API_PATCH

    html = re.sub(r"(<head\b[^>]*>)", _inject, output, count=1, flags=re.IGNORECASE)

    if docs_version() == "development":
        html2, n = re.subn(
            r'(<article\b[^>]*class="[^"]*md-content__inner[^"]*"[^>]*>)',
            r"\1" + _DEV_BANNER,
            html,
            count=1,
            flags=re.IGNORECASE,
        )
        if n:
            return html2
        html2, n = re.subn(
            r"(<h1\b[^>]*>)",
            _DEV_BANNER + r"\1",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
        if n:
            return html2

    return html
