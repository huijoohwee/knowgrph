---
title: "Knowgrph Game FPS Runtime Readiness"
doc_type: "Runtime Proof Checklist"
status: "runtime-ready"
date: "2026-07-21"
updated: "2026-07-21"
frontmatter_contract: "required"
execution_boundary: "dev-only"
publish_scope: "local-only"
source_contract: "docs/documents/knowgrph-game-fps-prd-tad.md"
workspace_seed: "docs/workspace-seeds/knowgrph-game-fps-demo.md"
candidate_commit: "649e3dd1a89a9ae78d5af17930829bf9869c00fc"
verified_at: "2026-07-21T04:30:22Z"
deployment: "not authorized"
---

# Knowgrph Game FPS Runtime Readiness

This file is the evidence ledger for the local/Dev game increment. The focused runtime gate and browser smoke passed at exact candidate commit `649e3dd1a89a9ae78d5af17930829bf9869c00fc`. This is a local runtime-readiness claim only; protected integration remains pending and production is not authorized.

## Canonical commands

```bash
npm run game-fps:runtime-ready
npm run game-fps:browser-smoke
npm run demo:game-fps
```

The focused command must cover game unit/integration tests, deterministic replay, Agentic ECS proof, Canvas type checking, a production-format local build, and workspace-seed validation. The demo command supports the separate local browser smoke. Neither command may deploy or require network access.

## Evidence ledger

| Gate | Required evidence | State |
|---|---|---|
| Source scope | One procedural map, four NPCs, one hitscan weapon, no new runtime dependency | passed |
| Determinism | Two identical seeds/input traces produce byte-identical canonical results | passed |
| Collision/weapon | Stable AABB movement plus normalized slab hitscan ordered by `(distance, entityRef)` | passed |
| NPC policy | Closed scored actions on a 12-tick interval with stable tie-breaking and no reasoning request | passed |
| Cost | Exactly one canonical zero Cost_Log per successful no-reasoning tick | passed |
| Persistence | Decisions-only WorkspaceFs save, idempotent resume, retry retention, read-back rollback | passed |
| Malformed save | Hydration blocks, bytes remain intact, HUD names the path, only explicit reset replaces | passed |
| Canvas | One existing R3F Canvas, coherent HUD, visible WebGL error, game camera ownership released on exit | passed |
| Browser | Visible movement, fire, reaction, completion, save, reload, and reset behavior | passed |
| Network | No non-local request, local runtime-bridge request, remote asset fetch, model call, or Cloudflare call | passed |
| Focused integration | Exact-candidate source, ECS, Canvas typecheck, build, and browser gates pass | passed |
| Protected integration | Draft PR checks and protected merge | pending |
| Release boundary | No Pages/Worker/Cloudflare deployment performed | passed |

## Browser smoke record

| Field | Recorded evidence |
|---|---|
| Candidate | `649e3dd1a89a9ae78d5af17930829bf9869c00fc` |
| Local target | `http://localhost:4185/`, Google Chrome headless |
| Viewport | Mobile acceptance `390x844`; desktop keyboard/fire inputs exercised in the same trace |
| First frame | Playable frame visible; four NPCs and touch controls visible |
| Movement | Player moved from `[0, 2]` to `[0, -1.64]` using desktop forward input |
| Fire | Ammo changed from `8` to `7`; HUD reported a hit |
| Fixed runtime | Tick advanced from `11` to `82` |
| Completion | Phase `won`, enemies alive `0`, pending Decision count `26` |
| Save/resume | Saved `26` Decisions to `/game-fps/mission-1-decisions.md`; reload restored phase `won` |
| Malformed save | HUD named `/game-fps/mission-1-decisions.md`; original bytes remained intact; retry stayed hidden; explicit reset returned phase `playing` and save status `saved` |
| Runtime requests | Non-local requests `[]`; local runtime-bridge request paths `[]` |
| Errors | Console errors `[]`; page errors `[]`; failed responses `[]` |
| Local artifacts | `data/outputs/game-fps-browser-smoke.json` and `.png` are ignored proof outputs, not release artifacts |

The browser smoke exercised the runtime and local persistence directly; the screenshot supplements, but does not replace, the structured evidence record. No deployment or public-surface request occurred.

## Verified command results

At the candidate commit:

- `npm run game-fps:runtime-ready` passed the 9-module source contract, 59 Agentic ECS tests, 11 focused Game FPS tests, subset source contracts, Canvas TypeScript check, and production-format local Vite build.
- `npm run game-fps:browser-smoke` passed the interaction, persistence, reload, malformed-save, explicit-reset, request, and error assertions listed above.
- `npm run hygiene:check`, focused ESLint, and `git diff --check` passed.

## Promotion rule

Local runtime readiness is achieved when every local evidence row passes at one exact candidate commit. Protected integration remains a separate repository gate and does not change this ledger's local-only status. Neither result authorizes production, Cloudflare, or public-surface claims.
