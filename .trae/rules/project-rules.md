# Knowgrph Project Rules

## Overview

- **Repository scope**: `knowgrph` maintains application source, canonical docs, generated previews, and cross-repo publish mirrors that must stay synchronized without drift.
- **Conflict posture**: resolve multiple updates at the highest upstream owner, regenerate downstream artifacts, and remove stale parallel paths instead of preserving them.
- **Delivery standard**: keep diffs Lean, SSOT-driven, MECE, and single-responsibility; validate only the affected surface and confirm no regressions.

---

## Context-Intent-Directive (CID) Framework

### Definition

- **Context**: focus domain of concern
- **Intent**: desired principle or guiding goal
- **Directive**: explicit prohibition or required safeguard

### Sorting

Each line and table row stays alphabetized for fast lookup and consistent governance.

---

## Three-Beat Mantra Form

- Artifacts; preserve generated integrity; forbid manual edits in synced publish mirrors
- Authority; maintain one upstream owner; forbid competing sources of truth
- Branches; isolate one directive per branch; forbid mixed unrelated updates
- Contracts; update canonical contracts first; forbid downstream schema patching
- Docs; keep canonical documentation upstream; forbid mirror-first edits
- Generated; regenerate from source; forbid hand-merged output files
- Merges; resolve conflicts at the root; forbid alias remaps and downstream hotfixes
- Ownership; assign one path per concern; forbid overlapping edit authority
- Redirects; manage routes through sync logic; forbid copied-route hotfixes
- Scope; keep changes MECE; forbid catch-all conflict commits
- Sync; run source-to-mirror workflows; forbid partial cross-repo drift
- Validation; verify focused diffs; forbid unverified conflict resolutions
- Worktrees; inspect existing changes before editing; forbid overwriting unrelated user work

---

## Context-Intent-Directive Table

| Context | Intent | Directive |
|---|---|---|
| Artifacts | Preserve generated integrity | - [ ] Protect synced artifacts; preserve generated integrity; forbid manual edits in `huijoohwee/content/knowgrph/**` and `huijoohwee/knowgrph/**` |
| Authority | Maintain one upstream owner | - [ ] Resolve at the authoritative source; maintain one upstream owner; forbid competing definitions across source, docs, and mirrors |
| Branches | Isolate one directive per branch | - [ ] Split work by directive row or concern; isolate branch scope; forbid mixed unrelated updates in one merge |
| Contracts | Update canonical contracts first | - [ ] Edit canonical contracts before mirrors; preserve contract authority; forbid downstream schema patching before upstream alignment |
| Docs | Keep canonical documentation upstream | - [ ] Treat `knowgrph/docs/**` as canonical unless a row explicitly assigns another owner; keep docs upstream; forbid mirror-first edits |
| Generated | Regenerate from source | - [ ] Rebuild generated outputs from merged source state; maintain SSOT; forbid hand-merged output files |
| Merges | Resolve conflicts at the root | - [ ] Neutralize conflicts from root or generator entry points; remove duplicate paths; forbid alias remaps and downstream-only fixes |
| Ownership | Assign one path per concern | - [ ] Declare one owning path per runtime, doc, schema, or publish concern; maintain accountability; forbid overlapping edit authority |
| Redirects | Manage routes through sync logic | - [ ] Update redirects through `scripts/sync-pages-knowgrph.mjs`; preserve route determinism; forbid copied-route hotfixes |
| Scope | Keep changes MECE | - [ ] Keep diffs Lean and single-responsibility; maintain MECE scope; forbid catch-all conflict commits |
| Sync | Run source-to-mirror workflows | - [ ] Execute the appropriate sync command after upstream merges; preserve mirror parity; forbid partial cross-repo drift |
| Validation | Verify focused diffs | - [ ] Run focused validation for the edited surface; confirm no regressions; forbid unverified conflict resolutions |
| Worktrees | Protect in-flight user changes | - [ ] Read local state before editing touched files; preserve user work; forbid overwriting unrelated worktree changes |

---

## Core Directives

### Authoritative Paths

- **Application source**: treat `knowgrph/canvas/src/**` as the upstream owner for runtime behavior.
- **Canonical docs**: treat `knowgrph/docs/**` and `knowgrph/todo-log.md` as the upstream owner for documented contracts unless a directive row states otherwise.
- **Schema mirrors**: update `huijoohwee.github.io/schema/AgenticRAG/**` only after the canonical owner is merged and aligned.
- **Publish mirrors**: treat `huijoohwee/content/knowgrph/**` and `huijoohwee/knowgrph/**` as synced deploy surfaces, not hand-authored sources.

### Conflict Resolution

- **Developers classify files** as `source`, `canonical-doc`, `schema-mirror`, `generator`, or `publish-artifact` before resolving a conflict.
- **Developers merge upstream intent first** in source modules, canonical docs, or generators before touching any downstream mirror.
- **Developers regenerate downstream outputs** after the upstream merge instead of line-editing generated files.
- **Developers delete stale branches and duplicate paths** when two updates preserve competing behavior, copy, or routes.
- **Developers avoid backward-compatibility shims** unless a directive explicitly requires them.

### Sync Workflow

- **Conflict compliance flow**: run `npm run conflict:check` to automate merge-marker scanning, publish sync drift checks, and sibling schema-map validation when available.
- **Local push gate**: install `.githooks/pre-push` through `npm run hooks:install` so `git push` runs `npm run conflict:check` before remote updates.
- **Pages publish flow**: run `npm run pages:build-sync` after source or public-route changes that affect published `knowgrph` assets.
- **Docs and schema flow**: run `npm run docs:update` or `npm run docs:qa` after canonical doc or contract changes that emit downstream docs.
- **App verification flow**: run `npm run lint`, `npm run check`, and focused tests after runtime source changes.

### Scope Guards

- **One directive, one branch**: prefer one `todo-log.md` row or one tightly related concern per branch and PR.
- **One owner, one fix path**: fix the generator or canonical source once, then propagate outputs from that source.
- **One release story**: separate upstream logic changes from regenerated artifact churn when the combined diff becomes hard to review.

---

## Validation Checklist

- [ ] Confirm the authoritative owner for every conflicting file before editing
- [ ] Confirm no manual edits remain in generated or synced publish surfaces
- [ ] Confirm stale duplicate paths, aliases, or remaps were removed
- [ ] Run the focused build, sync, lint, type, or test commands for the affected surface
- [ ] Review cross-repo mirrors for parity after regeneration
- [ ] Confirm no unrelated worktree changes were overwritten

---

## Role-Action-Outcome

- **Role: Maintainer**  
-> Action: classifies conflicting paths by ownership and merge surface  
-> Outcome: keeps conflict resolution anchored to one authoritative source

- **Role: Developer**  
-> Action: merges upstream logic, removes stale paths, and regenerates downstream outputs  
-> Outcome: delivers one coherent implementation without parallel branches

- **Role: Documentation Owner**  
-> Action: updates canonical docs before schema mirrors and publish copies  
-> Outcome: preserves one contract source across repos

- **Role: Validator**  
-> Action: runs focused verification and parity checks after merges and syncs  
-> Outcome: confirms the resolved state is correct and drift-free

---

## Mantra Application

**"CID frames knowgrph conflict rules, SRP isolates ownership, RAO aligns merge actions, SVO clarifies validation."**

- **CID frames**: defines where conflicts happen, why upstream authority matters, and which safeguards are mandatory.
- **SRP isolates**: assigns one owner per concern so fixes happen once at the correct root.
- **RAO aligns**: maps maintainers, developers, documentation owners, and validators to explicit merge responsibilities.
- **SVO clarifies**: turns conflict handling into direct, verifiable actions instead of ad hoc merge judgment.
