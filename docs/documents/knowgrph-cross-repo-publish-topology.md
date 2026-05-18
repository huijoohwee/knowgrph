# Knowgrph Cross-Repo Publish Topology

Canonical companion for the clean end-state topology shared with `singabldr`.

## Scope

- Dev SSOT repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Shared publish repo: `/Users/huijoohwee/Documents/GitHub/huijoohwee`
- Prod artifact mirror: `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- Public route: `airvio.co/knowgrph`
- Sibling app route: `airvio.co/singabldr`

## Directives

| Surface | Directive | SSOT | Publish Target | Public Route |
| --- | --- | --- | --- | --- |
| App source | Keep all Knowgrph source, build config, and release logic in `knowgrph`; forbid source copies inside `huijoohwee`. | `knowgrph` | `huijoohwee/content/knowgrph`, `huijoohwee/knowgrph` | `airvio.co/knowgrph` |
| Publish boundary | Treat `huijoohwee` as artifact-only for Knowgrph; allow deploy config, headers, redirects, and shared Functions there. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Route ownership | Keep `/knowgrph` assets, redirects, manifests, and shell logic isolated from Singabldr route assumptions. | `knowgrph` | `huijoohwee/_redirects`, `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |
| Release flow | Build and validate in `knowgrph`, sync only Knowgrph surfaces into `huijoohwee`, then push the publish repo for Cloudflare Pages. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Drift control | Fix stale paths, route leakage, and runtime drift at the Knowgrph source or shared publish config root; never patch generated outputs downstream. | `knowgrph` | `huijoohwee` | `airvio.co/knowgrph` |
| Goal hygiene | Keep goal-driven refactors lean, source-owned, sub-600-line, sub-500-KiB, and free of downstream alias/remap shims before publishing. | `knowgrph/goal` | `huijoohwee/content/knowgrph` | `airvio.co/knowgrph` |

## Companion

- Canonical storage & sync index: `knowgrph-storage-sync-document.md`
- Storage schema appendix: `knowgrph-storage-schemas-document.md`
- Shared sibling doc: `singabldr/docs/documents/singabldr-cross-repo-publish-topology.md`
- Shared schema note: `huijoohwee.github.io/schema/AgenticRAG/README.md`
