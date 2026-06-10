// Public, build-time Frontend configuration for the agentic-canvas-os Vercel
// tier. Spec: knowgrph-acos-mcp-connector, task 11.3 (R1.1, R11.3).
//
// IMPORTANT: this file is the DEV fallback. The build step (`scripts/build.mjs`)
// REGENERATES this module in the output bundle from a PUBLIC build-time env var
// (NEXT_PUBLIC_AGENT_API_URL / VITE_AGENT_API_URL / PUBLIC_AGENT_API_URL /
// AGENT_API_URL). The Agent_Api base URL is therefore NEVER hard-coded into the
// shipped bundle — it is injected at build time and defaults to a relative
// origin when unset.
//
// STACK BOUNDARY (R11/R15.7): these are PUBLIC deployment values only — never a
// model provider key and never an auth signing secret. The empty-string default
// means "same origin as the Frontend", so relative `/run` etc. resolve against
// the deployed site.

/** Agent_Api origin (e.g. https://api.example.com). Empty = same origin. */
export const AGENT_API_BASE_URL = "";

/** Optional Cloudflare AI Gateway base (public). Empty when not configured. */
export const AI_GATEWAY_BASE_URL = "";
