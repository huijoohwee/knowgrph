# Knowgrph Cross-Repo Publish Topology

Canonical companion for the clean end-state topology shared with `singabldr`.

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
    -> npm run pages:build
    -> npm run pages:sync
Prod publish mirror
  /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
    -> commit and push /Users/huijoohwee/Documents/GitHub/huijoohwee
Cloudflare Pages
  airvio.co/knowgrph
```

`npm run pages:build-sync` owns the static SPA build and mirror sync. `npm run pages:build-sync-cloudflare` extends that path with `npm run storage:deploy`, which applies remote D1 migrations and deploys the `knowgrph-storage` Worker from `cloudflare/workers/knowgrph-storage/wrangler.toml`. Publish sync must preserve the canonical hashed asset URL emitted by Vite for `index.html`; query-versioning the entry script URL is forbidden because it can split browser module identity across the same chunk. The generated `knowgrph` HTML app-shell cache headers must also include `no-transform` so Cloudflare JavaScript Detections do not inject `cdn-cgi/challenge-platform` scripts into the SPA shell.

Public route ownership remains `airvio.co/api/storage/*`, but server-side reads from Cloudflare Pages should target `https://knowgrph-storage.huijoohwee.workers.dev` so shared-doc Markdown negotiation does not self-fetch through the custom-domain route. Production `airvio.co/knowgrph` chat proxy behavior is owned by the shared publish-repo Pages Functions layer, primarily `huijoohwee/functions/__chat_proxy/[[path]].js` plus `huijoohwee/functions/api/_integrationHub.js`; provider rollouts such as Agnes and MiroMind must land there in addition to the Knowgrph Dev proxy/runtime.

`huijoohwee/content/knowgrph` is the primary Prod artifact mirror. `huijoohwee/knowgrph` is a generated public-route compatibility surface for managed root files such as `index.html`, `llms.txt`, `manifest.webmanifest`, `settings-flow.json`, `sw.js`, and `assets/**`; it is not the source owner. Cloudflare Pages control files remain authoritative only at the publish repo root: `huijoohwee/_headers` and `huijoohwee/_redirects`. Mirrored nested `_headers` or `_redirects` under `content/knowgrph` are not deploy authority and should not be synced.

## Directives

| Surface | Directive | SSOT | Publish Target | Public Route |
| --- | --- | --- | --- | --- |
| App source | Keep all Knowgrph source, build config, and release logic in `knowgrph`; forbid source copies inside `huijoohwee`. | `knowgrph` | `huijoohwee/content/knowgrph`, `huijoohwee/knowgrph` | `airvio.co/knowgrph` |
| Publish boundary | Treat `huijoohwee` as artifact-only for Knowgrph; allow deploy config, headers, redirects, and shared Functions there. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Route ownership | Keep `/knowgrph` assets, redirects, manifests, and shell logic isolated from Singabldr route assumptions. | `knowgrph` | `huijoohwee/_redirects`, `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Shared Pages Functions | Keep production chat-proxy and integration host policy in publish-repo shared Functions; validate provider onboarding there so Cloudflare Pages behavior matches Dev. | `huijoohwee/functions/{__chat_proxy,api/_integrationHub.js}` | `huijoohwee/functions/**` | `airvio.co/__chat_proxy/*`, `airvio.co/knowgrph` |
| Release flow | Build and validate in `knowgrph`, sync only Knowgrph surfaces into `huijoohwee`, deploy storage only through `storage:deploy`, then push the publish repo for Cloudflare Pages. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Drift control | Fix stale paths, route leakage, and runtime drift at the Knowgrph source or shared publish config root; never patch generated outputs downstream. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Goal hygiene | Keep goal-driven refactors lean, source-owned, sub-600-line, sub-500-KiB, and free of downstream alias/remap shims before publishing. | `knowgrph/goal` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Responsive parity | Own mobile-first responsive behavior in Dev source and generated workspace metadata; publish only synced artifacts after mobile/tablet/desktop/wide proof passes. | `knowgrph/goal`, `knowgrph/docs/**`, `knowgrph/canvas/**` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Storage Worker | Keep D1 schema, Worker routes, and route contracts in Dev; deploy with `storage:deploy`; verify `airvio.co/api/storage/*` separately from the static Pages route while keeping Pages server-side reads pinned to the Worker `workers.dev` origin. | `knowgrph/cloudflare/**`, `knowgrph/canvas/src/lib/storage/**` | Cloudflare Worker `knowgrph-storage` | `airvio.co/api/storage/*` |

## Validation Commands

| Check | Command | Purpose |
| --- | --- | --- |
| Static mirror drift | `npm run pages:check-sync` | Confirms `canvas/dist`, `huijoohwee/content/knowgrph`, managed `huijoohwee/knowgrph` files, and generated root `_headers` / `_redirects` agree while excluding mirrored nested control files. |
| Agnes readiness gate | `npm run agnes:readiness:check` | Chains focused Agnes canvas checks, publish sync drift validation, and the production Pages `__chat_proxy` smoke into one reusable readiness command. |
| Static build + sync | `npm run pages:build-sync` | Rebuilds with `VITE_BASE_PATH=/knowgrph/` and syncs the Prod mirror. |
| Static + Worker deploy | `npm run pages:build-sync-cloudflare` | Runs static build/sync and then `storage:deploy` for remote D1 migrations plus Worker deploy. |
| Conflict gate | `npm run conflict:check` | Runs changed-file hygiene, static build, chunk budgets, conflict compliance, and publish sync drift checks. |
| Shared Pages proxy smoke | `node huijoohwee/scripts/smoke-test-integrations.mjs` | Confirms the publish-repo `__chat_proxy` owner still recognizes shared providers such as OpenAI, BytePlus, MiroMind, and Agnes with the expected upstream and missing-key behavior. |
| Live route proof | `curl -I https://airvio.co/knowgrph/` and a served asset URL | Confirms Cloudflare Pages is serving the pushed Prod mirror. |
| Live storage proof | `curl -i https://airvio.co/api/storage/export/kgws%3Acanonical-docs` | Confirms the storage Worker and D1 route are live. |
| Direct storage-worker proof | `curl -i https://knowgrph-storage.huijoohwee.workers.dev/api/storage/doc/kgws%3Acanonical-docs/huijoohwee%2Fdocs%2Fknowgrph-design-demo.md` | Confirms the server-side storage fetch origin is live for Pages/MCP reads. |

## Companion

- Canonical storage & sync index: `knowgrph-storage-sync-document.md`
- Storage schema appendix: `knowgrph-storage-schemas-document.md`
- Shared sibling doc: `singabldr/docs/documents/singabldr-cross-repo-publish-topology.md`
- Shared schema note: `huijoohwee.github.io/schema/AgenticRAG/README.md`
