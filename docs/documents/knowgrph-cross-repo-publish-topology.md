# Knowgrph Cross-Repo Publish Topology

Canonical companion for the clean end-state topology shared with `singabldr`.

For current remote MCP onboarding, start with
`docs/documents/knowgrph-mcp-onboarding-index.md`, then use
`docs/documents/knowgrph-mcp-install-contract.md` for the canonical
public-discovery vs control-plane endpoint boundary.
Map intent on `https://airvio.co/knowgrph/mcp`, orchestrate agents on
`https://airvio.co/knowgrph/control-plane/mcp` only for session-capable hosts,
and prove outcomes first with the source-side `README.md` or
`docs/documents/knowgrph-superagent-harness.md` offline path.

## Scope

- Dev SSOT repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Shared publish repo: `/Users/huijoohwee/Documents/GitHub/huijoohwee`
- Prod artifact mirror: `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- Public route managed files: `/Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph`
- Public route: `airvio.co/knowgrph`
- Storage Worker routes: `airvio.co/api/storage/*`
- Storage Worker server-side fetch origin: `https://knowgrph-storage.huijoohwee.workers.dev`
- Payment Worker routes: `airvio.co/api/payments/*`
- Sibling app route: `airvio.co/singabldr`

## Current Release Context

The current deployment chain is:

```text
Dev source + docs
  /Users/huijoohwee/Documents/GitHub/knowgrph
    -> npm run pages:build-sync
    -> npm run pages:functions:build
Prod publish mirror
  /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
  /Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph
  /Users/huijoohwee/Documents/GitHub/huijoohwee/_worker.js
    -> commit and push /Users/huijoohwee/Documents/GitHub/huijoohwee
Cloudflare Pages
  airvio.co (Knowgrph root launch alias)
    -> airvio.co/knowgrph
```

`npm run pages:build-sync` owns the static SPA build and mirror sync. `npm run pages:build-sync-cloudflare` extends that path with `npm run workers:deploy`, which reuses `npm run storage:deploy` to apply remote D1 migrations, deploy the `knowgrph-storage` Worker from `cloudflare/workers/knowgrph-storage/wrangler.toml`, and re-seed D1 from `huijoohwee/docs`. Publish sync must preserve the canonical hashed asset URL emitted by Vite for `index.html`; query-versioning the entry script URL is forbidden because it can split browser module identity across the same chunk. The generated `knowgrph` HTML app-shell cache headers must also include `no-transform` so Cloudflare JavaScript Detections do not inject `cdn-cgi/challenge-platform` scripts into the SPA shell.

For the detailed source-backed Markdown discovery contract behind the Live Canvas Hero route, use `docs/documents/markdown-convertible-agent-discovery-document.md`.

Public route ownership remains `airvio.co/api/storage/*`, but server-side reads from Cloudflare Pages should target `https://knowgrph-storage.huijoohwee.workers.dev` so shared-doc Markdown negotiation does not self-fetch through the custom-domain route. Production `airvio.co/knowgrph` chat proxy behavior is owned by the shared publish-repo Pages Functions layer, primarily `huijoohwee/functions/__chat_proxy/[[path]].js` plus `huijoohwee/functions/api/_integrationHub.js`; provider rollouts such as Agnes and MiroMind must land there in addition to the Knowgrph Dev proxy/runtime. The same rule now applies to the Cloudflare AI Gateway draft lane: the Dev proxy and the publish-repo Pages proxy must both understand the internal `x-kg-ai-gateway-*` contract and the `KNOWGRPH_CHAT_PROXY_AI_GATEWAY_{BASE_URL,TOKEN,GATEWAY_ID}` env set, or the draft route will drift between localhost and `airvio.co`.

`huijoohwee/content/knowgrph` is the primary Prod artifact mirror. `huijoohwee/knowgrph` is a generated public-route compatibility surface for managed root files such as `index.html`, `llms.txt`, `manifest.webmanifest`, `settings-flow.json`, `sw.js`, and `assets/**`; it is not the source owner. Cloudflare Pages control files remain authoritative only at the publish repo root: `huijoohwee/_headers` and `huijoohwee/_redirects`. Mirrored nested `_headers` or `_redirects` under `content/knowgrph` are not deploy authority and should not be synced.

### 2026-07-11 Root Live Canvas Hero Release Record

- Source repo `knowgrph` shipped `a86bdbc9` (`restore source-backed apex FlowCanvas hero`) and `ada81a16` (`isolate apex hero from unloaded persisted source text`).
- Publish repo `huijoohwee` shipped `88aa31070` (`deploy persisted-state resilient apex FlowCanvas hero`).
- Cloudflare Pages deployed the exact publish commit to `https://1b9d700b.joohwee.pages.dev`; the custom domain served the release at `https://airvio.co/` and `https://airvio.co/knowgrph/`.
- The root route uses the published React app shell with `x-knowgrph-root-alias=/knowgrph/`; it is not a separately maintained launch page. The normal root path renders the interactive `workspace-readme.md` FlowCanvas and the same React Live Canvas Hero as Dev.
- Dev/Prod browser proof matched: the canvas region, hero headline, `/`, `#`, and `@` invocation controls, one `Enter Knowgrph` link to `/knowgrph/`, and no static launch-overlay marker. Route checks returned `200` for both root and app paths.

### 2026-06-29 Release Record

- Source repo `knowgrph` shipped commit `530462d6` (`Stabilize storyboard runtime and sync docs`).
- Publish repo `huijoohwee` finalized the deployed state at commit `ec4dfa47` (`release: rebuild pages worker`) after publish sync and generated Pages metadata commits.
- Cloudflare Pages deploy ran through `npm run pages:deploy-cloudflare` from `knowgrph` and completed with preview URL `https://0d3c18ba.joohwee.pages.dev`.
- Post-deploy route proof passed with `https://airvio.co/` -> `200`, `https://airvio.co/knowgrph/` -> `200`, and `https://0d3c18ba.joohwee.pages.dev/knowgrph/` -> `200`.
- The deploy also completed `storage:d1:seed:docs` with `applied=41`, `conflict=0`, and `rejected=0`.

### 2026-06-26 Release Record

- Source repo `knowgrph` shipped commits `66926a74` (`feat: improve timeline preview animation runtime`) and `e97df37c` (`chore: refresh settings flow metadata`).
- Publish repo `huijoohwee` shipped commit `0e4ab538` (`chore: sync knowgrph release surface`).
- Cloudflare Pages deploy ran through `npm run pages:deploy-cloudflare` from `knowgrph` and completed with preview URL `https://bdc25ab1.joohwee.pages.dev`.
- Post-deploy route proof passed with `https://bdc25ab1.joohwee.pages.dev/knowgrph/` -> `200` and `https://airvio.co/knowgrph/` -> `200`.
- The deploy also completed `storage:d1:seed:docs` with `applied=39`, `conflict=0`, and `rejected=0`.

### 2026-06-15 Release Record

- Source repo `knowgrph` shipped commit `fcd0ea5f` (`feat: modularize chat skill prompt handling`).
- Publish repo `huijoohwee` shipped commit `f0422135` (`chore: sync knowgrph production publish`).
- Cloudflare Pages deploy ran through `npm run pages:deploy-cloudflare` from `knowgrph` and completed with preview URL `https://84f45986.joohwee.pages.dev`.
- Post-deploy route proof passed with `https://airvio.co/knowgrph` -> `308` and `https://airvio.co/knowgrph/` -> `200`.
- The deploy also completed `storage:d1:seed:docs` with `applied=37`, `conflict=0`, and `rejected=0`.

## Directives

| Surface | Directive | SSOT | Publish Target | Public Route |
| --- | --- | --- | --- | --- |
| App source | Keep all Knowgrph source, build config, and release logic in `knowgrph`; forbid source copies inside `huijoohwee`. | `knowgrph` | `huijoohwee/content/knowgrph`, `huijoohwee/knowgrph` | `airvio.co/knowgrph` |
| Publish boundary | Treat `huijoohwee` as artifact-only for Knowgrph; allow deploy config, headers, redirects, and shared Functions there. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Route ownership | Keep `/knowgrph` assets, redirects, manifests, and shell logic isolated from Singabldr route assumptions. | `knowgrph` | `huijoohwee/_redirects`, `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Root launch alias | Keep `airvio.co/` on the published Knowgrph React app shell. The generated root handler injects `x-knowgrph-root-alias=/knowgrph/`; `CanvasPage` and `useKnowgrphLiveCanvasHero` consume that marker synchronously so Home owns first paint and resolves the canonical workspace README's isolated **Share canvas embed** runtime before Source Files hydration. The full `/knowgrph/` workspace canvas must never flash or mount underneath Home. Explorer → Source Files → **Share canvas embed** selects and session-persists another source's same-origin `kgDoc` interactive runtime, replacing the canonical background. The later published URL replaces it only when same-origin, so localhost never embeds a Cloudflare frame that production security headers reject. | `knowgrph/cloudflare/pages/root-agent-ready-index.mjs`, `knowgrph/canvas/src/{pages/Canvas.tsx,features/canvas/{useKnowgrphLiveCanvasHero,liveCanvasHeroSourceSelection,canvasDocDeepLink}.ts}` | `huijoohwee/_worker.js`, `huijoohwee/knowgrph/**` | `airvio.co` → `airvio.co/knowgrph/` |
| Shared Pages Functions | Keep production chat-proxy and integration host policy in publish-repo shared Functions; validate provider onboarding there so Cloudflare Pages behavior matches Dev, including the optional Cloudflare AI Gateway draft route. | `huijoohwee/functions/{__chat_proxy,api/_integrationHub.js}` | `huijoohwee/functions/**` | `airvio.co/__chat_proxy/*`, `airvio.co/knowgrph` |
| Release flow | Build and validate in `knowgrph`, sync only Knowgrph surfaces into `huijoohwee`, deploy storage only through `storage:deploy`, then push the publish repo for Cloudflare Pages. `pages:deploy-cloudflare` also seeds D1 after the Pages upload so Source Files storage stays aligned with `huijoohwee/docs`. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Generated artifact storage | Keep FloatingPanel Chat KGC sessions under `/chat-log/{session}/`; write Markdown/text artifacts to the configured GitHub repository path `chat-log/{session}/{file}` first, then mirror searchable Markdown/manifests to D1 and generated image/video/binary bytes to R2 when runtime storage is enabled. A generated artifact is Cloudflare-persisted only when both the D1 manifest route and R2 blob route are readable. | `knowgrph/canvas/src/features/{chat,source-files}`, `knowgrph/cloudflare/pages/knowgrph-agent-ready.mjs`, `knowgrph/cloudflare/workers/knowgrph-storage` | GitHub repository `chat-log/**` files; secondary Cloudflare Worker D1 rows + R2 `knowgrph-storage-blobs` | `airvio.co/knowgrph/api/workspace/github/write`, root alias `airvio.co/api/workspace/github/write`, `airvio.co/api/storage/{doc,blob}/*` |
| Drift control | Fix stale paths, route leakage, and runtime drift at the Knowgrph source or shared publish config root; never patch generated outputs downstream. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Goal hygiene | Keep goal-driven refactors lean, source-owned, sub-600-line, sub-500-KiB, and free of downstream alias/remap shims before publishing. | `knowgrph/goal` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Responsive parity | Own mobile-first responsive behavior in Dev source and generated workspace metadata; treat responsive proof as a release blocker and publish only synced artifacts after mobile/tablet/desktop/wide proof passes. | `knowgrph/goal`, `knowgrph/docs/**`, `knowgrph/canvas/**` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Mobile workflow evidence | Keep the route-and-action matrix source-owned in Dev and treat its immediate/deferred/fallback-safe decisions as the publish contract for heavy phone workflows. | `knowgrph/docs/documents/knowgrph-feature-map.md` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Storage Worker | Keep D1 schema, Worker routes, and route contracts in Dev; deploy with `storage:deploy`; verify `airvio.co/api/storage/*` separately from the static Pages route while keeping Pages server-side reads pinned to the Worker `workers.dev` origin. | `knowgrph/cloudflare/**`, `knowgrph/canvas/src/lib/storage/**` | Cloudflare Worker `knowgrph-storage` | `airvio.co/api/storage/*` |

## Validation Commands

| Check | Command | Purpose |
| --- | --- | --- |
| Static mirror drift | `npm run pages:check-sync` | Confirms `canvas/dist`, `huijoohwee/content/knowgrph`, managed `huijoohwee/knowgrph` files, and generated root `_headers` / `_redirects` agree while excluding mirrored nested control files. |
| Agnes readiness gate | `npm run agnes:readiness:check` | Chains `npm --prefix canvas run test:smoke:agnes:source`, publish sync drift validation, and the production Pages `__chat_proxy` smoke into one reusable readiness command. |
| AI Gateway draft-route readiness gate | `npm run ai-gateway:readiness:check` | Runs the focused OpenAI draft-route source proofs, publish sync drift validation, publish-repo `__chat_proxy` smoke, Cloudflare Pages project-config verification for `KNOWGRPH_CHAT_PROXY_AI_GATEWAY_BASE_URL`, Pages secret-list verification, and a bounded live Cloudflare-hosted transport smoke so the draft lane can be activated without guesswork. `-- --skip-live` skips only the live transport smoke; the Pages config and secret gates still fail closed until the `joohwee` project exposes the AI Gateway base URL plus an accepted AI Gateway secret. |
| MiroMind Pages readiness gate | `npm run miromind:readiness:check` | Runs `npm --prefix canvas run test:smoke:miromind:source`, confirms `MIROMIND_API_KEY` exists on the `joohwee` Pages project, and verifies the live Pages proxy sees the runtime binding without BYOK. |
| GitHub write readiness | `npm run pages:github-write:configure -- --json`; add `--write-smoke` only for a real commit | Checks production Pages GitHub-write bindings and live route status without printing or applying token values; the write smoke created `chat-log/codex-prod-write-smoke-20260606T004928Z/kgc_codex-prod-write-smoke-20260606T004928Z.md` on `main`. |
| GitHub canonical storage E2E | `npm run e2e:github-canonical-storage:dev`; `npm run e2e:github-canonical-storage:prod -- --json` | Confirms generated-chat promotion writes GitHub first, skips Cloudflare cache on GitHub failure, reads canonical content back through GitHub Contents, and uses Cloudflare only for doc/pull/share cache reads. |
| Storyboard readiness gate | `npm run storyboard:readiness:check` | Required before `pages:deploy-cloudflare` when storyboard drag, rich-media drop, overlay/layout placement, or mobile quick-bar behavior changes land; runs `npm --prefix canvas run test:smoke:storyboard-rich-media-drop:source`, the real `2D Renderer: Storyboard` browser smoke for drop/no-shift behavior, the mobile viewport-shrink quick-bar smoke, and `pages:check-sync` together so authored placement, mobile keyboard reachability, smoke seam drift, and publish drift stay blocked upstream. When debugging live-route SSOT restoration after Rich Media panel creation, also run `npm --prefix canvas run test:live:storyboard-media-panel-retention:browser` to prove transient image/video panels and created edges disappear on markdown reapply, and keep the verifier selectors exact-or-suffix for workspace-prefixed node ids. |
| Collaboration release gate | `npm run collaboration:release:check` | Required before `pages:deploy-cloudflare` when a change affects authenticated canvas-room transport, collaboration room auth/relay, collaboration docs/runtime contracts, or guest-to-owner document propagation. Runs the canonical collaboration readiness gate and then `pages:check-sync` so collaboration proof and publish drift fail upstream together. Use `npm run collaboration:release:check -- --skip-sync` only for local iteration while the publish mirror is intentionally dirty; release approval still requires the full gate. |
| Responsive parity release gate | `npm --prefix canvas run test:smoke:mobile-keyboard:browser`; `npm run pages:check-sync`; review `docs/documents/knowgrph-feature-map.md` | Required before `pages:deploy-cloudflare` when a change affects mobile grammar reachability, heavy-runtime intent policy, or touch-first responsive behavior. Blocks release until the mobile keyboard proof, the route-and-action matrix, and the publish mirror all agree. |
| Mobile route-and-action evidence audit | Review `docs/documents/knowgrph-feature-map.md` together with the focused mobile browser smoke before publish when a change alters phone workflow activation, fallback behavior, or heavy-runtime intent gates. | Confirms the documented immediate/deferred/fallback-safe matrix still matches the shipped mobile topology and proof path. |
| Static build + sync | `npm run pages:build-sync` | Rebuilds with `VITE_BASE_PATH=/knowgrph/` and syncs the Prod mirror. |
| Pages Functions build | `npm run pages:functions:build` | Generates the publish-repo `_worker.js`, including the root Knowgrph app-shell alias handler. |
| Static + Worker deploy | `npm run pages:build-sync-cloudflare` | Runs static build/sync and then `workers:deploy`; storage deploy applies D1 migrations, deploys the storage Worker, and re-seeds D1 docs. |
| Conflict gate | `npm run conflict:check` | Runs changed-file hygiene, static build, chunk budgets, conflict compliance, and publish sync drift checks. |
| Shared Pages proxy smoke | `node huijoohwee/scripts/smoke-test-integrations.mjs` | Confirms the publish-repo `__chat_proxy` owner still recognizes shared providers such as OpenAI, BytePlus, MiroMind, Agnes, and the Cloudflare AI Gateway draft route with the expected missing-key behavior. |
| Root + app route proof | `curl -I https://airvio.co/`; `curl -I https://airvio.co/knowgrph/`; inspect the served root module asset | Confirms Cloudflare Pages is serving the pushed Prod mirror and root requests resolve through the published Knowgrph app shell. |
| Live Canvas Hero parity | Open Dev and `https://airvio.co/` in parallel; verify the `Knowgrph Live Canvas Hero` and interactive canvas regions, confirm the hero's visible **Share canvas embed** action copies a `kgPreview=1&kgLiveHero=1` URL, then open that URL and verify `data-kg-live-canvas-hero-embed-preview=true`, `data-kg-canvas-interactive=1`, and the source-derived Flow node/edge counts. In Explorer → Source Files, invoke **Share canvas embed** for a non-README source; confirm `data-kg-live-canvas-hero-source` changes immediately, `data-kg-live-canvas-hero-selected-embed=true` mounts, and the iframe URL is same-origin with interactive controls/canvas surfaces. On both the apex and selected embed, assert zero visible Canvas toolbars, editor shells, Mermaid SVGs, timelines, and minimaps. Verify six visible `/ # @` controls and one `Enter Knowgrph` link to `/knowgrph/`, and confirm there is no `data-kg-live-canvas-launch` shell. | Confirms the public root is rendering the actual React canvas hero, the Explorer action swaps the underlying interactive source rather than only copying a URL, and no persisted workspace renderer or shell surface can seep into the hero owner. |
| Live storage proof | `curl -i https://airvio.co/api/storage/export/kgws%3Acanonical-docs` | Confirms the storage Worker and D1 route are live. |
| Generated chat storage proof | Run `npm run pages:github-write:configure -- --json --write-smoke`, submit one FloatingPanel Chat -> New Chat turn, verify the GitHub repository contains `chat-log/{session}/kgc_{session}.md`, then `curl -i https://airvio.co/api/storage/doc/{workspaceId}/chat-log%2F{session}%2Fkgc_{session}.md` when runtime storage mirroring is enabled. | Confirms promoted New Chat KGC Markdown writes to GitHub first and is publicly readable from D1 only as a secondary mirror. |
| Generated image/video storage proof | Run the local harness `npm -C canvas run test:ci:unit -- chat.responseContract.storage.kgcBinaryOutputPublishesR2Manifest sourceFiles.storageSync.r2BlobRoute.storesBinaryObject`; for live Cloudflare proof, check `GET /api/storage/doc/{workspaceId}/{manifestPath}` and `GET|HEAD /api/storage/blob/{workspaceId}/{artifactPath}` for the same generated artifact. | Confirms generated media bytes use R2 and the readable manifest uses D1; local paths, provider URLs, object URLs, and embedded previews alone are not Cloudflare persistence proof. |
| Direct storage-worker proof | `curl -i https://knowgrph-storage.huijoohwee.workers.dev/api/storage/doc/kgws%3Acanonical-docs/huijoohwee%2Fdocs%2Fknowgrph-design-demo.md` | Confirms the server-side storage fetch origin is live for Pages/MCP reads. |

## Companion

- Canonical storage & sync index: `knowgrph-storage-sync-document.md`
- Storage schema appendix: `knowgrph-storage-schemas-document.md`
- Markdown discovery companion: `markdown-convertible-agent-discovery-document.md`
- Shared sibling doc: `singabldr/docs/documents/singabldr-cross-repo-publish-topology.md`
- Shared schema note: `huijoohwee.github.io/schema/AgenticRAG/README.md`
