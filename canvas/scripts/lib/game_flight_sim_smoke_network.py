from __future__ import annotations

from typing import Any
from urllib.parse import urlparse


PROOF_LOCAL_BLOCKED_PATH_PREFIXES = (
    "/api",
    "/__",
    "/.well-known",
    "/control-plane",
    "/knowgrph/control-plane",
    "/mcp",
)
PROOF_LOCAL_WORKSPACE_LIST_PATH = "/__kg_fs_list"
PROOF_LOCAL_STATIC_EXACT_PATHS = {
    "/",
    "/index.html",
    "/@react-refresh",
    "/@vite/client",
}
PROOF_LOCAL_STATIC_PATH_PREFIXES = (
    "/@fs/",
    "/@id/",
    "/@vite/",
    "/assets/",
    "/fonts/",
    "/icons/",
    "/images/",
    "/models/",
    "/node_modules/",
    "/public/",
    "/src/",
    "/textures/",
)
PROOF_LOCAL_STATIC_SUFFIXES = (
    ".avif",
    ".bin",
    ".css",
    ".gif",
    ".glb",
    ".gltf",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".map",
    ".mjs",
    ".mp3",
    ".mp4",
    ".ogg",
    ".png",
    ".svg",
    ".ts",
    ".tsx",
    ".wasm",
    ".webm",
    ".webmanifest",
    ".webp",
    ".woff",
    ".woff2",
)


def request_is_proof_local_read(request: Any, local_origin: str) -> bool:
    parsed = urlparse(str(request.url))
    method = str(request.method).upper()
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.netloc != local_origin
    ):
        return False
    if (
        method == "POST"
        and parsed.path == PROOF_LOCAL_WORKSPACE_LIST_PATH
    ):
        return True
    if method not in {"GET", "HEAD"}:
        return False
    if (
        "%" in parsed.path
        or "\\" in parsed.path
        or any(segment in {".", ".."} for segment in parsed.path.split("/"))
    ):
        return False
    normalized_path = parsed.path.lower()
    blocked = any(
        (
            normalized_path.startswith(prefix)
            if prefix == "/__"
            else (
                normalized_path == prefix
                or normalized_path.startswith(f"{prefix}/")
            )
        )
        for prefix in PROOF_LOCAL_BLOCKED_PATH_PREFIXES
    )
    if blocked:
        return False
    if parsed.path in PROOF_LOCAL_STATIC_EXACT_PATHS:
        return True
    if parsed.path.startswith(PROOF_LOCAL_STATIC_PATH_PREFIXES):
        return True
    root_asset = (
        parsed.path.startswith("/")
        and parsed.path.count("/") == 1
        and parsed.path.lower().endswith(PROOF_LOCAL_STATIC_SUFFIXES)
    )
    return root_asset


def summarize_websocket_attempts(
    expected_probe_url: str,
    websocket_events: list[str],
    websocket_route_hits: list[str],
) -> dict[str, list[str]]:
    return {
        "probeEvents": [
            url for url in websocket_events if url == expected_probe_url
        ],
        "probeRouteHits": [
            url for url in websocket_route_hits if url == expected_probe_url
        ],
        "unexpectedEvents": [
            url for url in websocket_events if url != expected_probe_url
        ],
        "unexpectedRouteHits": [
            url for url in websocket_route_hits if url != expected_probe_url
        ],
    }


def assert_zero_network(
    *,
    non_local_requests: list[str],
    blocked_requests: list[dict[str, str]],
    websocket_events: list[str],
    websocket_route_hits: list[str],
) -> None:
    if not (
        non_local_requests
        or blocked_requests
        or websocket_events
        or websocket_route_hits
    ):
        return
    raise AssertionError(
        "Flight runtime attempted non-read-only or non-local requests: "
        f"nonLocal={non_local_requests}, blocked={blocked_requests}, "
        f"webSocketEvents={websocket_events}, "
        f"webSocketRouteHits={websocket_route_hits}"
    )
