---
title: "Knowgrph Conflict Resolution"
doc_type: "Process Guide"
status: "active"
lang: "en-US"
frontmatter_contract: "required"
---

# Knowgrph Conflict Resolution

## Authoring Contract

- The opening YAML frontmatter block remains the first-block machine SSOT for this process guide's metadata, status, and scope.
- This document is a canonical authored operational guide, not a generated registry surface or typed validation fixture.
- Frontmatter stays in plain YAML so the file demonstrates the default authoring path for governance, merge rules, and process contracts.
- If typed `{key, type, value}` envelopes are needed for ingest -> parse -> render validation, that coverage should live in a dedicated fixture doc rather than replacing canonical process prose.
- Conflict-resolution guidance and ownership rules must be derived from parsed frontmatter and document content only, never from file path assumptions or downstream mirrors.

## Overview

- This guide defines how to resolve multiple concurrent updates in `knowgrph` without creating source-of-truth drift.
- The repository contains four conflict-prone surfaces: runtime source, canonical docs, generated outputs, and cross-repo publish mirrors.
- The default rule is simple: merge at the highest upstream owner, regenerate downstream artifacts, and delete stale parallel paths.
- `docs/collaboration-runtime-contract.md` is the machine SSOT for `/`, `#`, `@` task declarations, affected-scope CI commands, and the manual-only deployment boundary.

---

## Context-Intent-Directive (CID) Framework

### Definition

- **Context**: focus domain of concern
- **Intent**: desired principle or guiding goal
- **Directive**: explicit prohibition or required safeguard

### Sorting

Each mantra and table row stays alphabetized so merge decisions remain easy to scan and reuse.

---

## Three-Beat Mantra Form

- Artifacts; preserve sync fidelity; forbid manual edits in generated publish surfaces
- Authority; resolve from the root; forbid downstream-first conflict fixes
- Contracts; keep one canonical contract; forbid duplicate authority across repos
- Docs; update canonical files first; forbid mirror-first changes
- Generators; fix emission logic once; forbid repeated patching of emitted outputs
- Ownership; assign one path per concern; forbid overlapping edit authority
- Publish; sync from source; forbid hand-maintained deploy mirrors
- Redirects; derive routes from sync logic; forbid direct copied-route edits
- Scope; merge one concern at a time; forbid mixed conflict batches
- Validation; verify focused diffs; forbid untested merge resolutions

---

## Context-Intent-Directive Table

| Context | Intent | Directive |
|---|---|---|
| Artifacts | Preserve sync fidelity | - [ ] Rebuild synced artifacts after upstream merges; preserve sync fidelity; forbid manual edits in generated publish surfaces |
| Authority | Resolve from the root | - [ ] Merge conflicts in the highest upstream owner; resolve from the root; forbid downstream-first conflict fixes |
| Contracts | Keep one canonical contract | - [ ] Update the canonical contract before mirrors; preserve one authority; forbid duplicate contract ownership across repos |
| Docs | Update canonical files first | - [ ] Edit `knowgrph/docs/**` before schema mirrors unless a directive states otherwise; keep docs canonical; forbid mirror-first changes |
| Generators | Fix emission logic once | - [ ] Patch generators or source inputs once and rerun them; remove duplicate edits; forbid repeated patching of emitted outputs |
| Ownership | Assign one path per concern | - [ ] Declare one owner for runtime, docs, schema, and publish surfaces; maintain accountability; forbid overlapping edit authority |
| Publish | Sync from source | - [ ] Treat publish mirrors as outputs from source workflows; preserve deploy integrity; forbid hand-maintained deploy mirrors |
| Redirects | Derive routes from sync logic | - [ ] Update redirects through sync code and rerun the sync workflow; preserve determinism; forbid direct copied-route edits |
| Scope | Merge one concern at a time | - [ ] Keep one directive or tightly related concern per merge; maintain MECE scope; forbid mixed conflict batches |
| Validation | Verify focused diffs | - [ ] Run focused build, sync, lint, or test commands after conflict resolution; confirm correctness; forbid untested merge resolutions |

---

## Ownership Matrix

| Surface | Owner | Typical Files | Conflict Rule |
|---|---|---|---|
| Runtime source | Upstream application code | `knowgrph/canvas/src/**` | Merge source logic first, then validate runtime behavior |
| Canonical docs | Upstream documentation | `agentic-canvas-os/docs/TODO.md`, `agentic-canvas-os/todo/**`, `knowgrph/docs/**`, `knowgrph/README.md` | Merge canonical wording first, append the planning row, then update any mirrors or generated derivatives |
| Generators and sync logic | Upstream automation | `knowgrph/scripts/**`, `knowgrph/canvas/src/cli/**`, generator inputs | Fix the generator or its input, then rerun the workflow |
| Schema mirrors | Downstream documentation mirror | `huijoohwee.github.io/schema/AgenticRAG/**` | Update only after the canonical owner is aligned |
| Publish mirrors | Downstream deploy surface | `huijoohwee/content/knowgrph/**`, managed route files in `huijoohwee/knowgrph/**` | Never hand-merge; rebuild and resync from `knowgrph` |

---

## Merge Order

1. Fetch `origin`, verify the repository has exactly one registered worktree on this device, and create `agent/<device>/<semantic-scope>` from `origin/main` in that checkout; switch branches in place and forbid `git worktree add`.
2. Declare one action, semantic scope, actor, and exact `origin/main` base SHA in pull-request frontmatter.
3. Classify each conflicting file as `runtime-source`, `canonical-doc`, `generator`, `schema-mirror`, or `publish-mirror`.
4. Stop parallel implementation when another active change owns the same semantic scope; serialize or explicitly hand over ownership.
5. Merge the upstream owner first and decide the intended behavior there.
6. Remove stale duplicate paths, legacy routes, or parallel copy instead of preserving both sides.
7. Regenerate emitted docs, redirects, or publish assets from the merged upstream state.
8. Run the affected checks selected from the collaboration runtime contract.
9. Review downstream mirrors for parity and confirm no manual hotfixes remain.

---

## Path Rules

### Runtime Source

- Resolve runtime behavior conflicts in `knowgrph/canvas/src/**`.
- Keep one implementation path for each concern.
- Remove stale helpers, remaps, aliases, and duplicate UI branches introduced by parallel work.

### Canonical Docs

- Resolve planning conflicts in `agentic-canvas-os/docs/TODO.md` and the active `agentic-canvas-os/todo/YYYY-MM.md` shard; resolve Knowgrph documentation conflicts in `knowgrph/docs/**` or other explicitly named canonical files.
- Treat downstream schema and publish copies as mirrors unless a directive row explicitly assigns ownership elsewhere.
- Preserve one canonical statement of a contract, then propagate it.

### Generators And Sync Logic

- Resolve conflicts in generator inputs or scripts before touching their outputs.
- For published `knowgrph` assets, use `scripts/sync-pages-knowgrph.mjs` as the route and artifact authority.
- Do not repair generated routes or copied assets directly if the sync workflow can reproduce them.

### Schema Mirrors

- Update `huijoohwee.github.io/schema/AgenticRAG/**` only after the canonical source is merged.
- Keep mirror wording aligned with the canonical contract.
- Remove duplicate schema wording if the same rule is defined upstream.

### Publish Mirrors

- Treat `huijoohwee/content/knowgrph/**` as the primary Prod artifact mirror and managed `huijoohwee/knowgrph/**` route files as generated deploy artifacts.
- Rebuild and resync them from `knowgrph` after upstream changes.
- Reject manual conflict resolutions inside copied assets unless the sync workflow itself is broken.

---

## Command Checklist

### End-To-End Compliance

```bash
npm run conflict:check
npm run conflict:source
```

GitHub Actions runs `npm run ci:integration` through the single `Integration Gate` status on pull requests and pushes to `main`.
Local Git enforcement also runs it on `git push` through the repo-managed `.githooks/pre-push` hook. The hook installs automatically during `npm install` via `npm run hooks:install`.
For server-side merge gating, see `docs/branch-protection.md`.

### Collaboration Runtime

```bash
npm run worktree:check
npm run collaboration:contract:check
npm run ci:affected
npm run ci:integration
```

- `worktree:check` validates the contract's canonical source registry without fetching or starting Dev; `ci:integration` runs it first and the pre-push hook inherits the same fast failure.
- `collaboration:contract:check` parses canonical frontmatter, validates branch/base/scope ownership in CI, rejects deployment commands outside the manual release workflow, and auto-discovers Agentic Canvas OS workflow consumers to enforce contract-derived checkout inputs.
- `npm run --silent collaboration:contract:check -- --json` validates against the canonical v1 JSON Schema before emitting the report; Integration uploads, downloads, and revalidates `collaboration-contract-report` with `npm run collaboration:report:check` for machine consumers.
- `ci:affected` derives focused commands from the canonical `ci_scopes` map rather than duplicating path rules in workflow YAML.
- `ci:integration` composes contract, source/build conflict, and affected-scope validation behind one stable merge status without mutating or requiring Prod.
- `conflict:check` remains the end-to-end source-plus-mirror parity check used after release sync.

### Pages And Publish

```bash
npm run pages:check-sync
```

To rebuild and then sync:

```bash
npm run pages:build-sync
```

Building and syncing is not deployment authorization. Remote migration and deployment commands must run only through an explicitly authorized release operation.

### Docs And Schema

```bash
npm run docs:update
```

Or, when broader validation is needed:

```bash
npm run docs:qa
```

### Runtime Validation

```bash
npm run lint
npm run check
npm test
```

Use focused tests when only one subsystem changed.

`npm run conflict:check` bundles changed-file hygiene budgets, semantic-key helper enforcement, Pages chunk budgets, the publish sync drift check, merge-marker scan, and the sibling `AgenticRAG` schema map check when that repo is available.

Use `npm run hygiene:audit` before broad refactors to list all current source-budget debt. New source files must stay under 600 lines and 500 KiB; existing over-budget files must not grow while they are being split. Generated archives, dependency output, and published preview data stay outside the day-to-day gate.

---

## Conflict Patterns

### Pattern: Source vs Generated Output

- Keep the source-side change.
- Regenerate the output.
- Remove hand edits from generated files.

### Pattern: Canonical Doc vs Schema Mirror

- Keep the canonical doc as the first merge point.
- Update the schema mirror after the canonical language settles.
- Delete duplicate or contradictory wording in the mirror.

### Pattern: Parallel Runtime Refactors

- Keep the path that preserves SSOT, simpler ownership, and fewer branches.
- Inline or remove duplicate logic rather than maintaining both implementations.
- Reject alias remaps that only hide unresolved duplication.

### Pattern: Publish Mirror Drift

- Keep the upstream `knowgrph` source.
- Rerun the publish sync workflow.
- Treat any remaining diff in the publish repo as a signal that sync logic or inputs still need correction.

---

## Validation Checklist

- [ ] Every conflicting file has an identified owner surface
- [ ] Pull-request frontmatter declares one `/` action, `#` semantic scope, `@` actor, and exact base SHA
- [ ] The task branch identifies one device and matches the declared semantic scope
- [ ] Each source repository has exactly one registered worktree on this device
- [ ] No other active change owns the same semantic scope
- [ ] A cross-device handoff stopped the sender before the receiver resumed the exact pushed commit
- [ ] No generated or publish mirror file was hand-merged without fixing the upstream source
- [ ] No stale duplicate path, alias, or compatibility branch remains
- [ ] The correct sync or validation command was run for the affected surface
- [ ] Downstream mirrors match the regenerated upstream state
- [ ] Unrelated local worktree changes were preserved
- [ ] No deployment, remote migration, or Prod mutation occurred during CI or conflict resolution

---

## Role-Action-Outcome

- **Role: Maintainer**  
-> Action: classifies conflicts by ownership and merge surface  
-> Outcome: keeps every resolution anchored to one authoritative path

- **Role: Developer**  
-> Action: merges upstream behavior, removes stale paths, and reruns generators or sync workflows  
-> Outcome: delivers one coherent implementation without downstream drift

- **Role: Documentation Owner**  
-> Action: resolves canonical doc conflicts before schema mirror updates  
-> Outcome: preserves one contract source across repos

- **Role: Validator**  
-> Action: runs focused checks and confirms publish or schema parity after regeneration  
-> Outcome: verifies that the merged state is correct, reproducible, and drift-free

---

## Mantra Application

**"CID frames knowgrph merge rules, SRP isolates path ownership, RAO aligns resolution steps, SVO clarifies validation."**

- **CID frames**: identifies the merge surface, the intended governance rule, and the forbidden shortcut.
- **SRP isolates**: keeps one owner per concern so fixes happen once in the correct upstream path.
- **RAO aligns**: maps maintainers, developers, documentation owners, and validators to explicit actions.
- **SVO clarifies**: makes every resolution step direct, testable, and reviewable.
