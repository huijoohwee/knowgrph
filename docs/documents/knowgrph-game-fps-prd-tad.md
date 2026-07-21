---
title: "Knowgrph Game FPS PRD/TAD"
id: "md:knowgrph-game-fps-prd-tad"
author: "airvio / joohwee"
date: "2026-07-21"
updated: "2026-07-21"
version: "2.0.0"
status: "runtime-ready"
doc_type: "Combined PRD/TAD"
lang: "en-US"
frontmatter_contract: "required"
domain: "knowgrph"
execution_boundary: "dev-only"
publish_scope: "local-only"
readiness:
  source_contract: "passed"
  focused_runtime: "passed"
  browser_smoke: "passed"
  protected_integration: "pending"
  production: "not authorized"
constraints:
  - "one procedural offline single-player mission"
  - "no sign-in, camera permission, passkey, model, network, or Cloudflare requirement"
  - "native Knowgrph ECS with ephemeral runtime state"
  - "only validated Decisions persist through browser-local WorkspaceFs"
  - "deterministic in-repo AABB collision and hitscan"
  - "no Rapier, Yuka, behavior-tree, navmesh, or edge-ML dependency"
  - "no automatic Git operation or production deployment"
source_references:
  agentic_ecs: "docs/documents/knowgrph-agentic-entity-component-system-prd-tad.md"
  runtime_contract: "docs/runtime-readiness-contract.md"
  game_runtime: "canvas/src/features/game-fps/"
  renderer_owner: "canvas/src/features/three/ThreeGraph.impl.tsx"
  workspace_fs: "canvas/src/features/workspace-fs/workspaceFs.ts"
  workspace_upsert: "canvas/src/features/workspace-fs/upsertWorkspaceTextDocument.ts"
  cost_log_contract: "contracts/cost-log.schema.js"
  workspace_seed: "docs/workspace-seeds/knowgrph-game-fps-demo.md"
  runtime_proof: "docs/documents/knowgrph-game-fps-runtime-readiness.md"
---

# Knowgrph Game FPS PRD/TAD

## Outcome

Knowgrph gains one small, source-backed first-person mission inside its existing Three.js Canvas. A player can open the local Dev demo, move, aim, fire one hitscan weapon, face four deterministic NPCs, complete the objective, and persist validated mission Decisions without an account, permission prompt, model call, remote asset fetch, or Cloudflare request.

This document is the implementation contract. The focused gate and local browser smoke passed at candidate commit `98cb837652806cf786c22db786ddba5c7833f4df`; the exact evidence is recorded in `knowgrph-game-fps-runtime-readiness.md`. Protected integration remains pending, and no production or Cloudflare deployment is authorized by this work.

## Product Requirements

### Problem

Knowgrph has a native Three.js renderer, a deterministic Agentic ECS, and browser-local Source Files persistence, but no bounded playable game loop proving those owners can compose. A first increment must be useful without importing a second engine, speculative AI stack, network service, or authentication flow.

### Primary user

Mei is a mobile-first player who wants to open a browser link and play a short FPS mission immediately. Her completion signal is a playable first frame with no sign-in, camera request, or blocking network request, followed by a locally resumable mission-completion Decision.

### Primary journey

| Stage | Player action | Runtime owner | Durable effect |
|---|---|---|---|
| Open | Apply the source-backed game document or run the local demo command | Existing run-ready demo registry | None |
| Play | Move, look, aim, and fire | `canvas/src/features/game-fps/` plus the existing Three renderer | None |
| React | Observe NPCs choose hold, alert, engage, or flee | Deterministic ECS systems | Pending Decisions only |
| Complete | Resolve the mission objective | Mission runtime | Validated pending Decisions |
| Save | Confirm mission completion | Browser-local WorkspaceFs adapter | KGC `EcsDecision` nodes only |
| Return | Reopen the same browser workspace | Hydration/resume adapter | Reconstructed mission progress |

### Must scope

- One procedural map built from in-repo primitives; no manifest, GLB, texture, R2, CDN, or runtime asset download.
- One local single-player mission, one weapon, four NPCs, one completion objective, and one retry/reset path.
- Keyboard and pointer controls plus touch controls where supported by the existing browser input owner.
- One fixed-step deterministic simulation using the native Agentic ECS.
- In-repo axis-aligned bounding-box collision and ray-versus-AABB hitscan.
- Deterministic NPC utility scoring with a closed action set: `hold`, `alert`, `engage`, `flee`.
- A HUD that reports health, ammo, NPC count, mission state, save state, and explicit errors.
- Browser-local, Decisions-only KGC persistence through WorkspaceFs on completion.
- Source tests, focused runtime proof, and local browser smoke.

### Deferred scope

- WebAuthn/passkeys, identity, accounts, cloud sync, and cross-device saves.
- Camera access, QR pairing, multiplayer, server-authoritative hit checks, leaderboards, and matchmaking.
- Hosted or local LLMs, agent reasoning, narrative generation, model escalation, edge ML, LiteRT policy models, ONNX Runtime, and token budgets.
- Rapier, Yuka, `behaviortree.js`, recastnavigation, bitECS, or another game/ECS engine.
- Remote assets, service workers added specifically for this demo, D1, R2, KV, Durable Objects, Workers, Pages, or production routes.
- Automatic Git commits, pushes, pull requests, or deployments from the browser runtime.

### User stories

1. As Mei, I can start the mission with no account, camera prompt, or network dependency.
2. As Mei, movement, aim, fire, and HUD feedback remain one coherent local loop.
3. As Mei, four NPCs react consistently to the same input sequence.
4. As Mei, a malformed save is never silently replaced; I can inspect the error and explicitly reset it.
5. As Mei, completing the mission writes only validated Decisions to my browser-local workspace.
6. As a maintainer, I can prove the runtime is model-free, dependency-free, deterministic, and Dev-only.

### Acceptance criteria

#### AC-1: open and play

Given a clean browser-local workspace, when the game seed is applied, then the procedural mission reaches a playable frame without sign-in, camera permission, passkey API access, remote asset fetch, or Cloudflare request.

#### AC-2: deterministic mission

Given the same mission seed and normalized input frames, when two fresh runtimes advance the same fixed number of ticks, then player, NPC, projectile-free hitscan, mission, Decisions, and HUD projection are byte-equivalent after canonical serialization.

#### AC-3: local collision and weapon result

Given a player or NPC intersects authored world bounds, when the tick advances, then the in-repo AABB resolver returns a bounded non-penetrating position. Given a fire input, the nearest ray/AABB intersection resolves once in that tick and the HUD exposes the hit or miss without a second renderer or physics owner.

#### AC-4: deterministic NPC decisions

Given an NPC state and player observation, when its decision interval fires, then exactly one action from `hold | alert | engage | flee` is selected by deterministic scoring and stable tie-breaking. The system makes no reasoning request and cannot fall through to a model or network path.

#### AC-5: canonical zero cost

Given a successful game `World_Tick`, when no reasoning request exists, then it returns exactly one canonical zero Cost_Log:

```json
{
  "model": "none",
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "cache_hits": 0,
  "estimated_cost_usd": 0,
  "incomplete": false
}
```

No token ceiling, escalation, retry, fallback model, or synthetic non-zero cost record exists in this increment.

#### AC-6: decision-only local save

Given mission completion, when persistence succeeds, then browser-local WorkspaceFs contains only canonical `EcsDecision` additions using the supported `dialogue_outcome`, `quest_flag`, or `world_tick_result` types. Component arrays, world snapshots, cost logs, credentials, and raw input history are not written.

In repo-local Dev mode, the existing Source Files bridge may attempt its normal best-effort mirror. A mirror failure does not convert a local success into a Git claim, and the game never launches a Git process or creates a commit automatically.

#### AC-7: fail-closed hydration and retry

Given no save document, the runtime may create a fresh mission. Given an existing malformed KGC save, hydration blocks before a World is created, names the unreadable local path, preserves the original bytes, and exposes an explicit **Reset local save** action. Only that user action may replace the malformed document with the canonical empty mission save.

Given a write failure, pending Decisions remain in memory, the previous document bytes remain unchanged, and the HUD exposes **Retry save**. No silent drop, fabricated success, or automatic reset is allowed.

#### AC-8: Dev-only readiness

Given the candidate source, when `npm run game-fps:runtime-ready` passes, then its evidence covers focused game tests, Agentic ECS tests, Canvas type checking, a production-format local build, and the source-backed seed contract. A separate local browser smoke proves visible play and save/reset behavior. Neither command deploys or performs a remote mutation.

### Success metrics

| Metric | Must target |
|---|---|
| First value | Playable first frame and first shot from the source-backed demo |
| NPC count | Exactly four reactive NPCs |
| Deterministic replay | Two identical input traces yield identical canonical results |
| Runtime model calls | 0 |
| Runtime network calls | 0 required; 0 Cloudflare calls |
| Token and inference cost | 0 tokens; USD 0 |
| Persistent data | Validated Decisions only |
| New runtime dependencies | 0 |
| Production mutation | 0 |

## Technical Architecture

### Ownership

| Concern | Canonical owner | Rule |
|---|---|---|
| Game domain | `canvas/src/features/game-fps/` | Mission config, systems, input normalization, HUD projection, local save adapter |
| Entity simulation | `ecs/` | Reuse the five-function native ECS API and its transactional `worldTick` |
| Rendering | `canvas/src/features/three/ThreeGraph.impl.tsx` | Reuse the single React Three Fiber Canvas; do not mount a second WebGL renderer |
| Camera/input arbitration | Existing Three controls plus the game stage | Game mode owns first-person framing while active and releases it on exit |
| Browser persistence | `canvas/src/features/workspace-fs/` | Use WorkspaceFs and its existing source-file bridge; do not add storage or Git owners |
| Cost truth | `contracts/cost-log.schema.js` | Accept only the canonical model-free zero record for the no-reasoning tick |
| Activation | `docs/workspace-seeds/knowgrph-game-fps-demo.md` | Source-backed `game-fps` run-ready demo |
| Proof | `docs/documents/knowgrph-game-fps-runtime-readiness.md` | Exact commands and evidence state |

### Runtime topology

```mermaid
flowchart LR
  SEED["Source-backed game seed"] --> ACTIVATE["Run-ready activation"]
  ACTIVATE --> RUNTIME["Game FPS runtime"]
  INPUT["Keyboard, pointer, or touch"] --> NORMALIZE["Normalized input frame"]
  NORMALIZE --> TICK["Fixed Agentic ECS World_Tick"]
  RUNTIME --> TICK
  TICK --> AI["Deterministic NPC scoring"]
  TICK --> COLLISION["In-repo AABB and hitscan"]
  TICK --> VIEW["Immutable scene and HUD projection"]
  VIEW --> THREE["Existing R3F Canvas"]
  TICK --> PENDING["Validated pending Decisions"]
  PENDING --> COMPLETE{"Mission complete?"}
  COMPLETE -->|no| TICK
  COMPLETE -->|yes| SAVE["Browser-local WorkspaceFs save"]
  SAVE -. "best-effort in repo-local Dev" .-> MIRROR["Existing Source Files mirror"]
```

No node in this topology is a model, remote service, Cloudflare resource, Git operation, or deployment step.

### Mission model

The mission configuration is constant and source-controlled. It defines world bounds, collision boxes, player spawn, four NPC spawns, weapon range/damage/cooldown/ammo, fixed tick duration, and objective thresholds. Runtime component storage remains ephemeral.

The simulation advances from normalized input frames rather than DOM events. A bounded accumulator may run more than one fixed tick per render frame, but it must cap catch-up work and never make the simulation result depend on display refresh rate. Rendering reads an immutable projection after a committed tick.

### Collision and hitscan

World obstacles and actors use source-authored AABBs. Movement resolves one axis at a time in a stable order and clamps to the world boundary. Hitscan uses a normalized camera ray, slab intersection, positive distance, weapon range, and stable `(distance, entityRef)` ordering to choose at most one target. There are no projectile entities, mesh-collider generation, navmesh, or floating dependency fallbacks.

### NPC system

NPC utility scores derive only from canonical numeric observations such as health, player distance, line-of-sight, alert state, and deterministic tick counters. Stable action priority resolves equal scores. Pathing is bounded steering around the procedural AABBs; it does not claim general navigation.

Only meaningful transitions emit a Decision. Per-frame transforms, aim vectors, and intermediate utility scores remain ephemeral. The game systems never call `requestReasoning`.

### Persistence and resume

The local save path is owned by the game adapter under WorkspaceFs. At mission completion it merges canonical Decisions idempotently by `decisionId`; existing authored bytes remain untouched except for the supported KGC Decision insertion. Resume derives mission progress from the validated Decision index before the first tick.

Malformed existing KGC is not equivalent to an absent save. The runtime reports the precise local path and error, does not create a partial World, and waits for explicit reset. Reset and retry are user actions, not recovery side effects.

### Error model

| Failure | Required result |
|---|---|
| Invalid mission config | Block activation with typed local error |
| Invalid input value | Reject or normalize to a bounded neutral value before tick |
| Tick/system failure | Keep prior committed systems, expose failure, do not claim a successful frame |
| Malformed existing save | Preserve bytes, block hydration, expose explicit reset |
| Local write failure | Preserve prior bytes and pending Decisions, expose retry |
| Repo-local mirror failure | Keep truthful browser-local save status and report mirror as best-effort failure |
| WebGL unavailable | Show a local unsupported-state message; do not fall back to a remote renderer |

## Architecture Decisions

### ADR-1: Reuse the existing renderer and native ECS

**Status:** Accepted for this increment.

The game mounts a dedicated stage inside the existing `ThreeGraph` React Three Fiber Canvas and uses the native Agentic ECS for runtime state. A second renderer, a second camera owner, bitECS, Babylon.js, or another ECS is rejected because it duplicates an existing repository owner.

### ADR-2: Own minimal physics and weapon math in-repo

**Status:** Accepted for this increment.

The procedural mission needs only bounded movement collision and one hitscan weapon, so deterministic AABB and ray/AABB functions remain in the game feature cluster. Rapier and mesh physics are not installed or claimed. General rigid-body physics is outside this increment.

### ADR-3: Use deterministic authored NPC scoring

**Status:** Accepted for this increment.

Reactive combat uses a small closed action set and stable utility rules. Yuka, behavior-tree packages, recastnavigation, local/hosted LLMs, and edge-ML policies are rejected for the Must scope because they add weight without improving the bounded mission acceptance criteria.

### ADR-4: Persist Decisions through browser-local WorkspaceFs

**Status:** Accepted for this increment.

The runtime writes canonical KGC Decisions through the existing browser-local filesystem owner. The existing repo-local Source Files bridge may mirror the document best-effort during Dev, but no automatic Git commit is performed or implied. Component state and raw World snapshots remain ephemeral.

### ADR-5: Defer identity and multiplayer

**Status:** Accepted for this increment.

Open-and-play is the only onboarding path. Passkeys, QR/camera flows, accounts, multiplayer, and cloud profiles are explicitly deferred. The runtime must not touch `navigator.credentials` or `getUserMedia`.

### ADR-6: Keep readiness local and Dev-only

**Status:** Accepted for this increment.

Runtime readiness means focused source proof plus a local browser smoke bound to the candidate commit. It does not mean merged, deployed, publicly reachable, or production-ready. Production and Cloudflare lanes require a separate operator-authorized release workflow.

## Runtime Readiness Gate

The single source of truth for evidence is `docs/documents/knowgrph-game-fps-runtime-readiness.md`. Its local runtime-readiness checklist passed at candidate commit `98cb837652806cf786c22db786ddba5c7833f4df`, so this PRD and the workspace seed are `runtime-ready`. Protected integration and release remain separate gates.

The expected focused command is:

```bash
npm run game-fps:runtime-ready
```

It must be finite, local, and read-only apart from ordinary build/test artifacts. It must not access a paid model, make a required network call, write repository content, deploy, or mutate Cloudflare.

## Agent-Platform Readiness

| Dimension | Scope |
|---|---|
| Agentic OS-ready | Not added. The game consumes the existing ECS contract and creates no new agent runtime. |
| AI Agent-ready | Won't in this increment. No model, prompt, reasoning request, or agent-discovery surface exists. |
| MCP Gateway-ready | Won't in this increment. The game adds no MCP tool or transport. |

## Release Boundary

The deliverable is a Dev/local runtime-readiness candidate. No Pages build upload, Worker deployment, D1/R2/KV/DO mutation, production route change, public smoke, or release claim belongs to this scope. A future release must begin from a protected integrated SHA and explicit operator authorization.
