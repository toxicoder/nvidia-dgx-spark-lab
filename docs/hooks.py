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

The injection happens in on_post_page so the <script> literally precedes
the Material bundle.*.js <script> tag in the emitted HTML (including during
`mkdocs serve` live reload). This guarantees execution order.
"""

from __future__ import annotations

import re
from typing import Any

# Keep in sync with any manual patches. Must be self-contained (no deps).
_GITHUB_API_PATCH = (
    '<script>'
    '(function(){'
    'try{var orig=window.fetch;'
    'if(typeof orig==="function"){window.fetch=function(i,init){'
    'var u=(typeof i==="string")?i:(i&&typeof i.url==="string"?i.url:"");'
    'if(u.indexOf("api.github.com/repos/toxicoder/nvidia-dgx-spark-lab")!==-1){'
    'return Promise.resolve(new Response("{}", {status:200,headers:{"Content-Type":"application/json"}}));}'
    'return orig.apply(this,arguments);'
    '};}}catch(e){}'
    'try{var XHR=window.XMLHttpRequest;'
    'if(XHR&&XHR.prototype){var p=XHR.prototype,open=p.open;'
    'p.open=function(m,u){'
    'if(typeof u==="string"&&u.indexOf("api.github.com/repos/toxicoder/nvidia-dgx-spark-lab")!==-1){'
    'var self=this;'
    'Object.defineProperty(self,"responseText",{get:function(){return"{}"},configurable:!0});'
    'Object.defineProperty(self,"status",{get:function(){return 200},configurable:!0});'
    'Object.defineProperty(self,"readyState",{get:function(){return 4},configurable:!0});'
    'self.send=function(){setTimeout(function(){'
    'try{if(typeof self.onreadystatechange==="function")self.onreadystatechange.call(self);}catch(_){}'
    'try{if(typeof self.onload==="function")self.onload.call(self);}catch(_){}'
    '},0);};'
    'return;'
    '}'
    'return open.apply(this,arguments);'
    '};}}catch(e){}'
    '})();'
    '</script>'
)


def on_post_page(output: str, **kwargs: Any) -> str:
    """Insert the GitHub patch script immediately after the opening <head> tag.

    Args:
        output: Rendered HTML page content from MkDocs.
        **kwargs: Unused MkDocs hook metadata accepted for API compatibility.

    Returns:
        HTML with the inline GitHub API patch script injected once after
        the first ``<head>`` opening tag.
    """
    def _inject(m: re.Match[str]) -> str:
        """Append the patch script to the matched ``<head>`` opening tag.

        Args:
            m: Regex match for the opening ``<head>`` tag.

        Returns:
            Original ``<head>`` tag followed by the inline patch script.
        """
        return m.group(1) + _GITHUB_API_PATCH

    return re.sub(r"(<head\b[^>]*>)", _inject, output, count=1, flags=re.IGNORECASE)