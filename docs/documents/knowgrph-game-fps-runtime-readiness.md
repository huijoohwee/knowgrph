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
candidate_commit: "fbb615be92ea58e6e4cfc981feb2122ea81e79b2"
verified_at: "2026-07-21T07:50:51Z"
protected_pull_request: "https://github.com/huijoohwee/knowgrph/pull/263"
agentic_runtime_docs_commit: "41cd9855dbcec074b2182a9eaea455c54c117fe4"
deployment: "not authorized"
---

# Knowgrph Game FPS Runtime Readiness

This file is the evidence ledger for the local/Dev Game Mode increment. Source, build, core-browser, external-source, XR/Motion, invocation, persistence, and no-hardcode gates passed again at protected main commit `fbb615be92ea58e6e4cfc981feb2122ea81e79b2` after PR #263 merged. This is a local runtime-readiness claim only; production remains unauthorized.

## Canonical commands

```bash
npm run game-fps:runtime-ready
npm run game-fps:browser-smoke
npm run demo:game-fps
KG_GAME_MODE_VALIDATION_SHARE_URL='<operator-supplied share URL>' npm -C canvas run test:smoke:game-mode-xr-share:browser
```

The runtime-ready and core-browser commands cover game unit/integration tests, deterministic replay, Agentic ECS proof, Canvas type checking, a production-format local build, workspace-seed validation, and local interaction/persistence. They require no non-local request. The opt-in share command accepts its source only through the environment, performs one allowlisted verifier preflight read to establish exact bytes plus exactly one product/browser document fetch, and runs those bytes against localhost candidate code. The supplied URL, opaque token, decoded path, and content checksum must never be written into repository bytes or proof artifacts. None of these commands deploys or performs a public mutation.

## Evidence ledger

| Gate | Required evidence | State |
|---|---|---|
| Source scope | One procedural map, four NPCs, one hitscan weapon, no new runtime dependency | passed |
| Determinism | Two identical seeds/input traces produce byte-identical canonical results | passed |
| Collision/weapon | Stable AABB movement plus normalized slab hitscan ordered by `(distance, entityRef)` | passed |
| NPC policy | Closed scored actions on a 12-tick interval with stable tie-breaking and no reasoning request | passed |
| Cost | Exactly one canonical zero Cost_Log per successful no-reasoning tick | passed |
| Game Mode lifecycle | FloatingPanel open/start/stop/restart/fire/reload/save/exit uses one central runtime | passed |
| Controls | Desktop release/re-entry, pointer aim/fire, mobile touch, and Motion Control input composition | passed |
| Invocation | Exactly `/game.mode @canvas #gameplay`; duplicate/mixed/unknown input fails closed | passed |
| Browser WebMCP | Strict `knowgrph-game-mode-mcp/v1` inspect/control registration and duplicate-binding rejection | passed |
| Persistence | Explicit Decisions-only WorkspaceFs Save, idempotent resume, retry retention, and read-back rollback; no terminal autosave | passed |
| Malformed save | Hydration blocks Start/Restart, bytes remain intact, HUD names the path, only explicit Reset replaces | passed |
| WebGL | Synchronous capability gate keeps an unsupported mission stopped and renders a local error | passed |
| Canvas/XR | One existing R3F Canvas; XR pauses for Game Mode, restores exactly, and continues afterward | passed |
| Stop/Start | Stop preserves current tick/player state; Start resumes that same in-memory mission | passed |
| Source identity | Known source-authored `run_ready_demo.id` activates after import/rename and conflicts fail closed | passed |
| Core browser | Visible movement, fire, four score rows, completion, explicit save, reload, malformed-save reset | passed |
| External source | Exact supplied Markdown bytes, strict WebMCP, Motion/XR round trip, stable Canvas, allowlisted network | passed |
| Hardcode guard | Supplied URL/token and its decoded canonical path are absent from repository bytes | passed |
| Network | Core gameplay made no non-local request; external acceptance made one verifier preflight read plus one exact product/browser source fetch | passed |
| Focused integration | Exact-candidate source, ECS, Canvas typecheck, build, and browser gates pass | passed |
| Protected integration | PR #263 Integration Gate and protected squash merge | passed |
| Release boundary | No Pages/Worker/Cloudflare deployment performed | passed |

## Core browser smoke record

| Field | Recorded evidence |
|---|---|
| Candidate | `fbb615be92ea58e6e4cfc981feb2122ea81e79b2` |
| Local target | `http://localhost:4185/`, Google Chrome headless |
| Viewport | Mobile acceptance `390x844`; desktop keyboard/fire inputs exercised in the same trace |
| First frame | Playable frame visible; four NPCs and touch controls visible |
| Movement | Player moved from `[0, 2]` to `[0, 0.46]`; key release neutralized input and a second `W` cycle reached Z `-0.17` |
| Browser WebMCP | Registered and active with schema `knowgrph-game-mode-mcp/v1`; duplicate semantic binding rejected |
| Fire | Ammo changed from `8` to `7`; HUD reported a hit |
| Fixed runtime | Tick advanced from `14` to `102` |
| Completion | Phase `won`, enemies alive `0`, pending Decision count `24`, reload observed |
| Save/resume | Explicit Save wrote `24` Decisions to `/game-fps/mission-1-decisions.md`; reload restored phase `won` |
| Malformed save | HUD named `/game-fps/mission-1-decisions.md`; original bytes remained intact; retry stayed hidden; explicit reset returned phase `playing` and save status `saved` |
| Runtime requests | Non-local requests `[]`; local runtime-bridge request paths `[]` |
| Errors | Console errors `[]`; page errors `[]`; failed responses `[]` |
| Local artifacts | `data/outputs/game-fps-browser-smoke.json` and `.png` are ignored proof outputs, not release artifacts |

The core browser smoke exercised the runtime and local persistence directly; the screenshot supplements, but does not replace, the structured record. It made no public request and performed no deployment.

## External XR share smoke record

| Field | Recorded evidence |
|---|---|
| Candidate | `fbb615be92ea58e6e4cfc981feb2122ea81e79b2` |
| Source boundary | Environment-only operator input; exact public Markdown bytes at execution time imported into localhost |
| Product fetch | Product deep-link owner derived the document URL; exactly one matching fetch observed |
| Renderer | WebGL supported; exactly one Canvas with stable DOM identity across Game Mode/Motion/XR transitions |
| Game Mode | Shared `xr` surface, phase `playing`, four NPC rows, actions `hold`, `alert`, `engage`, `flee` |
| WebMCP | Strict browser inspect/control path passed; Stop→Start preserved mission state |
| Motion Control | Companion round trip stopped and preserved the mission; XR resumed and progressed while Motion owned the surface |
| XR restore | XR paused during Game Mode; rocket mode, objective, 12 bodies, and frame restored exactly; progress continued after exit |
| Network | Only localhost and the supplied origin were allowed; exact product-document fetch count `1` |
| Errors | Console errors `0`; page errors `0`; failed responses `0` |
| Local artifacts | `data/outputs/game-mode-xr-share-browser-smoke.json` and screenshots are ignored proof outputs |

This acceptance proves compatibility between the exact supplied public source bytes and localhost candidate code. It does not prove the public document contains the new Game Mode block, that candidate code is deployed, or that any public state was mutated.

## Verified command results

At the exact protected main commit:

- `npm run game-fps:runtime-ready` passed the 14-module source contract, 59 Agentic ECS tests, 20 focused Game Mode tests, subset source contracts, Canvas TypeScript, and an 8,519-module production Vite build namespaced under the full candidate SHA.
- `npm run game-fps:browser-smoke` passed desktop/mobile interaction, browser WebMCP, explicit persistence, reload, malformed hydration, explicit Reset, request, and error assertions.
- The opt-in external-source browser smoke passed exact-byte import, one exact product fetch, stable Canvas identity, strict WebMCP, Stop→Start preservation, Motion/XR handoff, exact XR restore, and zero-error assertions.
- Focused XR/Motion contracts, five runtime-doc dependency contracts, the external-input no-hardcode guard, focused ESLint, and `git diff --check` passed.
- Runtime docs resolve Agentic Canvas OS protected commit `41cd9855dbcec074b2182a9eaea455c54c117fe4`; no copied or mutable ref is accepted.

## Promotion rule

Local runtime readiness is achieved when every local evidence row passes at one exact commit. Protected integration passed separately through PR #263 and does not change this ledger's local-only status. Neither result authorizes production, Cloudflare, or public-surface claims.
