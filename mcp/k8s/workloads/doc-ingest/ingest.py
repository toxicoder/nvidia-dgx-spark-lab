#!/usr/bin/env python3
"""Crawl configured doc URLs and upsert chunks into Qdrant via Nemotron embed.

Reads source URLs from ``DOC_SOURCES_JSON``, fetches page content, chunks it,
embeds each chunk with the Nemotron retriever service, and upserts vectors into
the configured Qdrant collection for local documentation fallback.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

EMBED_URL = os.environ.get(
    "EMBED_URL",
    "http://nemotron-retriever-embed.ai-inference.svc.cluster.local:8000/v1/embeddings",
)
QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant.agent-tools.svc.cluster.local:6333")
COLLECTION = os.environ.get("COLLECTION", "library-docs")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nvidia/llama-nemotron-embed-v1")
SOURCES = os.environ.get("DOC_SOURCES_JSON", "[]")
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1200"))


def http_json(method: str, url: str, body: dict[str, Any] | None = None) -> Any:
    """Perform an HTTP request and parse the JSON response body.

    Args:
        method: HTTP method (for example ``GET`` or ``PUT``).
        url: Request URL.
        body: Optional JSON-serializable request body.

    Returns:
        Parsed JSON response.

    Raises:
        urllib.error.URLError: If the HTTP request fails.
        json.JSONDecodeError: If the response body is not valid JSON.
    """
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode("utf-8"))


def fetch_url(url: str) -> str:
    """Fetch raw text content from a documentation URL.

    Args:
        url: HTTP or HTTPS URL to retrieve.

    Returns:
        Decoded response body with replacement for invalid UTF-8 sequences.

    Raises:
        urllib.error.URLError: If the HTTP request fails.
    """
    with urllib.request.urlopen(url, timeout=60) as res:
        return str(res.read().decode("utf-8", errors="replace"))


def chunk_text(text: str, size: int) -> list[str]:
    """Split HTML/text into fixed-size chunks for embedding.

    Args:
        text: Raw page content, potentially containing HTML tags.
        size: Maximum chunk length in characters.

    Returns:
        Non-empty text chunks of up to ``size`` characters each.
    """
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return [text[i : i + size] for i in range(0, len(text), size) if text[i : i + size]]


def ensure_collection(vector_size: int) -> None:
    """Create the Qdrant collection when it does not already exist.

    Args:
        vector_size: Embedding dimension used for the collection vectors.

    Raises:
        urllib.error.URLError: If collection creation fails after a missing check.
    """
    try:
        http_json("GET", f"{QDRANT_URL}/collections/{COLLECTION}")
    except Exception:
        http_json(
            "PUT",
            f"{QDRANT_URL}/collections/{COLLECTION}",
            {
                "vectors": {"size": vector_size, "distance": "Cosine"},
            },
        )


def main() -> int:
    """Ingest configured documentation sources into Qdrant.

    Returns:
        ``0`` on success or when no sources are configured.
    """
    sources = json.loads(SOURCES)
    if not sources:
        print("No DOC_SOURCES_JSON configured; nothing to ingest.", file=sys.stderr)
        return 0

    points: list[dict[str, Any]] = []
    vector_size = 0

    for source in sources:
        url = source["url"]
        name = source.get("name", url)
        print(f"Ingesting {name} from {url}")
        raw = fetch_url(url)
        for idx, chunk in enumerate(chunk_text(raw, CHUNK_SIZE)):
            emb = http_json(
                "POST",
                EMBED_URL,
                {"input": chunk, "model": EMBED_MODEL},
            )
            vector = emb["data"][0]["embedding"]
            vector_size = len(vector)
            point_id = hashlib.sha256(f"{url}:{idx}".encode()).hexdigest()[:32]
            points.append(
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "text": chunk,
                        "source": url,
                        "name": name,
                        "chunk": idx,
                    },
                }
            )

    if not points:
        return 0

    ensure_collection(vector_size)
    http_json(
        "PUT",
        f"{QDRANT_URL}/collections/{COLLECTION}/points?wait=true",
        {"points": points},
    )
    print(f"Upserted {len(points)} chunks into {COLLECTION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
