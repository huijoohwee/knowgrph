// Minimal CORS header builder for the AWS Agent-API tier.
//
// The product path is a browser-hosted frontend calling the Agent-API directly,
// so every Lambda response must include browser-readable CORS headers. Keep the
// contract small and environment-driven: operators can narrow the allowed origin
// at deploy time, while the local/default posture stays permissive enough for
// preview environments.

const DEFAULT_ALLOW_ORIGIN = "*";
const DEFAULT_ALLOW_HEADERS = "authorization,content-type";
const DEFAULT_ALLOW_METHODS = "GET,POST,OPTIONS";

function readText(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function buildCorsHeaders(env = process.env) {
  return Object.freeze({
    "access-control-allow-origin": readText(env?.CORS_ALLOW_ORIGIN, DEFAULT_ALLOW_ORIGIN),
    "access-control-allow-headers": readText(env?.CORS_ALLOW_HEADERS, DEFAULT_ALLOW_HEADERS),
    "access-control-allow-methods": readText(env?.CORS_ALLOW_METHODS, DEFAULT_ALLOW_METHODS),
  });
}
