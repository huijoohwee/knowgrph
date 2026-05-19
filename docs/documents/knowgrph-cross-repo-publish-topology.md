# Knowgrph Cross-Repo Publish Topology

Canonical companion for the clean end-state topology shared with `singabldr`.

## Scope

- Dev SSOT repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Shared publish repo: `/Users/huijoohwee/Documents/GitHub/huijoohwee`
- Prod artifact mirror: `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- Public route managed files: `/Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph`
- Public route: `airvio.co/knowgrph`
- Storage Worker routes: `airvio.co/api/storage/*`, `airvio.co/api/payments/*`
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

`npm run pages:build-sync` owns the static SPA build and mirror sync. `npm run pages:build-sync-cloudflare` extends that path with `npm run storage:deploy`, which applies remote D1 migrations and deploys the `knowgrph-storage` Worker from `cloudflare/workers/knowgrph-storage/wrangler.toml`.

`huijoohwee/content/knowgrph` is the primary Prod artifact mirror. `huijoohwee/knowgrph` is a generated public-route compatibility surface for managed root files such as `index.html`, `llms.txt`, `manifest.webmanifest`, `settings-flow.json`, `sw.js`, and `assets/**`; it is not the source owner.

## Directives

| Surface | Directive | SSOT | Publish Target | Public Route |
| --- | --- | --- | --- | --- |
| App source | Keep all Knowgrph source, build config, and release logic in `knowgrph`; forbid source copies inside `huijoohwee`. | `knowgrph` | `huijoohwee/content/knowgrph`, `huijoohwee/knowgrph` | `airvio.co/knowgrph` |
| Publish boundary | Treat `huijoohwee` as artifact-only for Knowgrph; allow deploy config, headers, redirects, and shared Functions there. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Route ownership | Keep `/knowgrph` assets, redirects, manifests, and shell logic isolated from Singabldr route assumptions. | `knowgrph` | `huijoohwee/_redirects`, `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Release flow | Build and validate in `knowgrph`, sync only Knowgrph surfaces into `huijoohwee`, deploy storage only through `storage:deploy`, then push the publish repo for Cloudflare Pages. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Drift control | Fix stale paths, route leakage, and runtime drift at the Knowgrph source or shared publish config root; never patch generated outputs downstream. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Goal hygiene | Keep goal-driven refactors lean, source-owned, sub-600-line, sub-500-KiB, and free of downstream alias/remap shims before publishing. | `knowgrph/goal` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Responsive parity | Own mobile-first responsive behavior in Dev source and generated workspace metadata; publish only synced artifacts after mobile/tablet/desktop/wide proof passes. | `knowgrph/goal`, `knowgrph/docs/**`, `knowgrph/canvas/**` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Storage Worker | Keep D1 schema, Worker routes, and route contracts in Dev; deploy with `storage:deploy`; verify `airvio.co/api/storage/*` separately from the static Pages route. | `knowgrph/cloudflare/**`, `knowgrph/canvas/src/lib/storage/**` | Cloudflare Worker `knowgrph-storage` | `airvio.co/api/storage/*` |

## Validation Commands

| Check | Command | Purpose |
| --- | --- | --- |
| Static mirror drift | `npm run pages:check-sync` | Confirms `canvas/dist`, `huijoohwee/content/knowgrph`, managed `huijoohwee/knowgrph` files, and generated `_redirects` agree. |
| Static build + sync | `npm run pages:build-sync` | Rebuilds with `VITE_BASE_PATH=/knowgrph/` and syncs the Prod mirror. |
| Static + Worker deploy | `npm run pages:build-sync-cloudflare` | Runs static build/sync and then `storage:deploy` for remote D1 migrations plus Worker deploy. |
| Conflict gate | `npm run conflict:check` | Runs changed-file hygiene, static build, chunk budgets, conflict compliance, and publish sync drift checks. |
| Live route proof | `curl -I https://airvio.co/knowgrph/` and a served asset URL | Confirms Cloudflare Pages is serving the pushed Prod mirror. |
| Live storage proof | `curl -i https://airvio.co/api/storage/export/kgws%3Acanonical-docs` | Confirms the storage Worker and D1 route are live. |

## Companion

- Canonical storage & sync index: `knowgrph-storage-sync-document.md`
- Storage schema appendix: `knowgrph-storage-schemas-document.md`
- Shared sibling doc: `singabldr/docs/documents/singabldr-cross-repo-publish-topology.md`
- Shared schema note: `huijoohwee.github.io/schema/AgenticRAG/README.md`
