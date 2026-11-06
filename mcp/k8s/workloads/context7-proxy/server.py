"""Redis-cached Context7 MCP HTTP proxy with Qdrant fallback when disabled.

Proxies JSON-RPC MCP requests to the upstream Context7 service when enabled,
caching responses in Redis. When Context7 is disabled, falls back to semantic
search against locally ingested documentation stored in Qdrant.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import TypeAlias, TypedDict, cast

import httpx
import redis
import yaml
from fastapi import FastAPI, Request, Response

CONFIG_PATH = Path(os.environ.get("CONFIG_PATH", "/app/config.yaml"))


_JsonRpcId: TypeAlias = str | int | None


class _CacheCfg(TypedDict, total=False):
    """Redis cache block of the proxy ``config.yaml``."""

    url: str
    ttl_seconds: int


class _UpstreamCfg(TypedDict, total=False):
    """Upstream Context7 block of the proxy ``config.yaml``."""

    mcp_url: str


class _FallbackCfg(TypedDict, total=False):
    """Qdrant fallback block of the proxy ``config.yaml``."""

    embed_url: str
    qdrant_url: str
    collection: str
    embed_model: str


class _Config(TypedDict, total=False):
    """Subset of ``config.yaml`` this proxy reads."""

    enabled: bool
    cache: _CacheCfg
    upstream: _UpstreamCfg
    fallback: _FallbackCfg


class _JsonRpcParams(TypedDict, total=False):
    """Request parameters the Qdrant fallback reads out of an MCP call."""

    query: str
    libraryName: str


class _JsonRpcRequest(TypedDict, total=False):
    """JSON-RPC request body received on ``/mcp``."""

    id: _JsonRpcId
    params: _JsonRpcParams


class _JsonRpcError(TypedDict):
    """JSON-RPC error object."""

    code: int
    message: str


class _JsonRpcErrorReply(TypedDict):
    """JSON-RPC error reply for a fallback request without a query."""

    jsonrpc: str
    id: _JsonRpcId
    error: _JsonRpcError


class _TextContent(TypedDict):
    """MCP text content block returned to the caller."""

    type: str
    text: str


class _FallbackMeta(TypedDict):
    """Provenance attached to a Qdrant-sourced reply."""

    source: str
    hits: int


class _JsonRpcResult(TypedDict):
    """MCP tool result with the matched documentation text."""

    content: list[_TextContent]
    isError: bool
    _meta: _FallbackMeta


class _JsonRpcResultReply(TypedDict):
    """JSON-RPC reply carrying Qdrant documentation snippets."""

    jsonrpc: str
    id: _JsonRpcId
    result: _JsonRpcResult


class _HitPayload(TypedDict, total=False):
    """Document fields stored on a Qdrant point."""

    text: str
    content: str


class _QdrantHit(TypedDict, total=False):
    """One point returned by a Qdrant search."""

    payload: _HitPayload


def load_config() -> _Config:
    """Load proxy configuration from YAML and environment overrides.

    Returns:
        Parsed configuration dictionary with optional ``enabled`` override from
        the ``CONTEXT7_ENABLED`` environment variable.
    """
    data = cast(_Config, yaml.safe_load(CONFIG_PATH.read_text()) or {})
    if os.environ.get("CONTEXT7_ENABLED", "").lower() in {"0", "false", "no"}:
        data["enabled"] = False
    elif os.environ.get("CONTEXT7_ENABLED", "").lower() in {"1", "true", "yes"}:
        data["enabled"] = True
    return data


cfg = load_config()
app = FastAPI(title="context7-cache-proxy", version="0.1.0")

cache_client = redis.Redis.from_url(
    cfg.get("cache", {}).get("url", "redis://localhost:6379/1"),
    decode_responses=True,
)


def cache_key(body: bytes) -> str:
    """Derive a stable Redis cache key for an MCP request body.

    Args:
        body: Raw JSON-RPC request bytes.

    Returns:
        Redis key prefixed with ``ctx7:`` and a SHA-256 digest of the body.
    """
    return "ctx7:" + hashlib.sha256(body).hexdigest()


async def qdrant_fallback(payload: _JsonRpcRequest) -> _JsonRpcErrorReply | _JsonRpcResultReply:
    """Answer an MCP request using Qdrant-backed local documentation.

    Args:
        payload: Parsed JSON-RPC request payload.

    Returns:
        JSON-RPC response dictionary, either with a ``result`` containing matched
        documentation snippets or an ``error`` when no query is available.
    """
    fb = cfg.get("fallback", {})
    params = payload.get("params", {}) or {}
    query = params.get("query") or params.get("libraryName") or ""
    if not query:
        return {
            "jsonrpc": "2.0",
            "id": payload.get("id"),
            "error": {
                "code": -32000,
                "message": "Context7 disabled and no query for Qdrant fallback",
            },
        }

    embed_url = fb.get("embed_url", "")
    qdrant_url = fb.get("qdrant_url", "http://qdrant:6333")
    collection = fb.get("collection", "library-docs")
    embed_model = fb.get("embed_model", "nvidia/llama-nemotron-embed-v1")

    vector: list[float] = []
    if embed_url:
        async with httpx.AsyncClient(timeout=60.0) as client:
            emb = await client.post(
                embed_url,
                json={"input": query, "model": embed_model},
            )
            emb.raise_for_status()
            vector = emb.json()["data"][0]["embedding"]

    search_body: dict[str, object] = {
        "limit": 5,
        "with_payload": True,
    }
    if vector:
        search_body["vector"] = vector
    else:
        search_body["filter"] = {
            "must": [{"key": "text", "match": {"text": query}}],
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{qdrant_url}/collections/{collection}/points/search",
            json=search_body,
        )
        if res.status_code == 404:
            hits: list[_QdrantHit] = []
        else:
            res.raise_for_status()
            hits = res.json().get("result", [])

    snippets = []
    for hit in hits:
        payload_data = hit.get("payload") or {}
        snippets.append(payload_data.get("text") or payload_data.get("content") or "")

    text = "\n\n---\n\n".join(s for s in snippets if s) or (
        "No cached documentation found. Enable Context7 or run doc-ingest CronJob."
    )
    return {
        "jsonrpc": "2.0",
        "id": payload.get("id"),
        "result": {
            "content": [{"type": "text", "text": text}],
            "isError": False,
            "_meta": {"source": "qdrant-fallback", "hits": len(hits)},
        },
    }


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Return proxy health and whether Context7 upstream is enabled.

    Returns:
        JSON object with ``status`` and ``context7_enabled`` fields.
    """
    return {"status": "ok", "context7_enabled": str(cfg.get("enabled", True)).lower()}


@app.post("/mcp")
async def mcp_proxy(request: Request) -> Response:
    """Proxy MCP JSON-RPC requests with Redis caching and Qdrant fallback.

    Args:
        request: Incoming FastAPI request containing the JSON-RPC body.

    Returns:
        JSON response from cache, upstream Context7, or Qdrant fallback.
    """
    body = await request.body()
    ttl = int(cfg.get("cache", {}).get("ttl_seconds", 604800))

    key = cache_key(body)
    cached = cache_client.get(key)
    if cached:
        return Response(
            content=cached,
            media_type="application/json",
            headers={"X-Cache": "HIT"},
        )

    try:
        payload = cast(_JsonRpcRequest, json.loads(body.decode("utf-8")))
    except json.JSONDecodeError:
        return Response(
            content=json.dumps({"error": "invalid json"}),
            status_code=400,
            media_type="application/json",
        )

    if not cfg.get("enabled", True):
        result = await qdrant_fallback(payload)
        content = json.dumps(result)
        cache_client.setex(key, ttl, content)
        return Response(
            content=content, media_type="application/json", headers={"X-Cache": "MISS-FALLBACK"}
        )

    upstream = cfg.get("upstream", {}).get("mcp_url", "https://mcp.context7.com/mcp")
    api_key = os.environ.get("CONTEXT7_API_KEY", "")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["CONTEXT7_API_KEY"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        upstream_res = await client.post(upstream, content=body, headers=headers)

    content = upstream_res.content.decode("utf-8")
    if upstream_res.is_success:
        cache_client.setex(key, ttl, content)

    return Response(
        content=content,
        status_code=upstream_res.status_code,
        media_type=upstream_res.headers.get("content-type", "application/json"),
        headers={"X-Cache": "MISS"},
    )
