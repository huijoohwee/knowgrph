# Knowgrph XR Invocation Runtime API

## Surface contract

FloatingPanel **Skills & Commands** hydrates the exact-revision Agentic Canvas OS `/`, `@`, and `#` dictionary as authoring metadata. A row inserts its token byte-for-byte into the active card editor; it does not execute an incomplete bare command.

FloatingPanel **Media** owns complete dynamic XR invocations. Every visible invocation chip sends the identical displayed string, as the sole `invocation` input field, to `knowgrph.control_local_xr_scene`.

- Placement labels are URI-encoded in `/xr.place` and decoded before bounded scene mutation.
- `/xr.transform` retains the selected asset, position, yaw, scale, and color.
- Static placements retain `transition=hold`.
- Camera WebMCP framing preserves an already-open Media or Skills & Commands panel; Camera opens only when no operator panel is open.

## WebMCP readiness markers

The app and published HTML fallback expose two independent diagnostics:

| Marker | Meaning |
|---|---|
| `data-kg-webmcp-context` | Usable tools: `fallback-readable`, `awaiting-model-context`, or `installed`. |
| `data-kg-webmcp-host-context` | Native host binding: `installing`, `awaiting-model-context`, `retry-exhausted`, or `installed`. |

A bounded native-host retry cannot overwrite a functional `fallback-readable` context as an apparent runtime failure. Assigning a native model context after retry exhaustion still installs the complete tool set.

If a native host detaches, its AbortSignal-backed registrations are released, the owned fallback becomes readable again, and a fresh bounded binding cycle begins. Test reset detaches the owned `navigator.modelContext` and `document.modelContext` descriptors before clearing fallback identity, so reinstalling in the same document cannot misclassify the old fallback as native.

## Ownership and boundary

- Runtime owner: `canvas/src/features/three/xrSceneMcpRuntime.ts`.
- Invocation grammar owner: `canvas/src/features/three/xrSceneMcpContract.mjs`.
- Exact-revision dictionary metadata owner: Agentic Canvas OS `DICTIONARY-COMMAND.md`, `DICTIONARY-SEMANTIC.md`, and `DICTIONARY-BINDING.md`.
- Browser registration owner: `canvas/src/features/agent-ready/webMcpRuntime.ts`.
- Published fallback owner: `cloudflare/pages/knowgrph-agent-ready.mjs`.

External image-to-3D repositories remain reference-only dependencies. This runtime copies no external implementation, schema, prose, or example and introduces no external renderer, model, storage, deployment, or mutation owner.
