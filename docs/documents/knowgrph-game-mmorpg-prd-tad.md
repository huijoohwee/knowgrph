---
title: "Knowgrph Game MMORPG PRD/TAD"
id: "md:knowgrph-game-mmorpg-prd-tad"
author: "airvio / joohwee"
date: "2026-07-22"
updated: "2026-07-22"
version: "0.1.0"
status: "draft"
doc_type: "Combined PRD/TAD"
lang: "en-US"
frontmatter_contract: "required"
domain: "knowgrph"
execution_boundary: "dev-only"
publish_scope: "local-only"
readiness:
  source_contract: "pending"
  focused_runtime: "pending"
  core_browser_smoke: "pending"
  production: "not authorized"
scope_reconciliation:
  tension: "a networked massively-multiplayer shared world conflicts with the zero-infra, local-first, offline-first, and no-Supabase constraints"
  resolution: "Must scope is an offline, single-player, MMO-style RPG world on the deterministic Agentic ECS; networked shared-world play is deferred and requires separate operator authorization and a substrate decision"
constraints:
  - "Must scope is one bounded offline single-player MMO-style RPG world on the canonical authored XR scene; no networked shared world in this increment"
  - "core gameplay requires no sign-in, camera permission, passkey, model, network, or Cloudflare service"
  - "native Knowgrph Agentic ECS with ephemeral runtime state; only validated Decisions persist through browser-local WorkspaceFs"
  - "deterministic fixed-step in-repo simulation and AABB collision; reproducible replay"
  - "no Rapier, Yuka, behavior-tree, navmesh, bitECS, edge-ML, or LLM dependency on the gameplay hot path"
  - "no runtime image-to-3D, asset generation, remote asset fetch, or provider call; all assets are committed local files"
  - "every asset carries a provenance + license record; internet-sourced assets must be FOSS/redistributable and license-gated"
  - "browser-local WebMCP only; no new stdio, HTTP gateway, or deployment transport"
  - "FORBID Supabase and any remote realtime/state backend; FORBID automatic Git operation or production deployment"
  - "one authored scene owner on the single React Three Fiber Canvas; no second renderer, Canvas, or world"
constraints_inspiration:
  - "refer to github.com/Julian-adv/OpenMMO for inspiration only (its mix of AI-generated, procedural, and internet-sourced assets); FORBID source copy and FORBID any runtime/build dependency on it"
source_references:
  agentic_ecs: "docs/documents/knowgrph-agentic-entity-component-system-prd-tad.md"
  sibling_game_fps: "docs/documents/knowgrph-game-fps-prd-tad.md"
  sibling_flight_sim: "docs/documents/knowgrph-game-flight-sim-prd-tad.md"
  renderer_owner: "canvas/src/lib/three/ThreeGraph.impl.tsx"
  xr_owner: "canvas/src/features/three/xrNativeControllerDemoRuntime.ts"
  motion_control: "canvas/src/features/three/motionControlRuntime.ts"
  workspace_fs: "canvas/src/features/workspace-fs/workspaceFs.ts"
  cost_log_contract: "contracts/cost-log.schema.js"
  mmorpg_runtime: "canvas/src/features/game-mmorpg/"
  asset_provenance_pipeline: "canvas/src/features/game-mmorpg/assetProvenance/"
  validation_seed: "docs/workspace-seeds/knowgrph-physics-playground-demo.md"
  asset_inspiration_reference_only: "github.com/Julian-adv/OpenMMO (inspiration only; no source copy, no dependency)"
---

# Knowgrph Game MMORPG PRD/TAD

Governed by the same solo-dev AI-native orientation as the sibling `knowgrph-game-fps-prd-tad.md` and `knowgrph-game-flight-sim-prd-tad.md`: every decision is evaluated through the four compounding lenses (min-viable-max-value, TCO-zero, token economics, harness-first). This module is a new increment; status is `draft` and no runtime-readiness proof exists yet. No production or Cloudflare deployment is authorized.

## Scope reconciliation (read first)

A **massively multiplayer** online world inherently requires shared-world networking, an authoritative server, and durable multi-player state — which directly conflicts with this stack's **zero-infra, local-first, offline-first, no-Supabase** constraints. This increment does **not** pretend to resolve that conflict. Instead:

- **Must scope** delivers an **offline, single-player, MMO-style RPG world** — persistent zones, NPCs, quests, inventory, and character progression — on the deterministic native Agentic ECS with browser-local, Decisions-only persistence. It is "MMO-flavored," not networked.
- **Networked shared-world play** (many concurrent players, authoritative sync) is **explicitly deferred**. It would require a networking substrate and a durable backend decision that are out of the current zero-infra scope, and it must not use Supabase. Any future networked increment requires separate operator authorization and its own ADR.

The distinctive capability specified here is the **asset provenance pipeline**: an MMO-scale world needs many assets, sourced as a **mix of AI-generated, procedurally/programmatically created, and internet-sourced** content. This document defines how that mix stays FOSS-first, license-governed, diffable, local, and offline.

## Outcome

Knowgrph gains one browser-local FloatingPanel **MMORPG World** mode that runs a bounded, offline, single-player RPG world inside the existing React Three Fiber Canvas, over the shared authored XR terrain catalog. It opens from a source-backed run-ready document, the shared XR surface catalog, browser WebMCP, or the strict `/mmorpg @canvas #world` invocation. Desktop keyboard/pointer, mobile touch, gamepad, and optional Motion Control input arm one deterministic native Agentic ECS world with in-repo movement, AABB collision, NPCs, quests, inventory, a visible HUD, selectable camera source, and Decisions-only WorkspaceFs persistence.

Core gameplay requires no camera, account, passkey, model, remote asset, gameplay network call, or Cloudflare service. The distinctive capability is the **asset provenance pipeline**: world content is a governed mix of (A) **procedural/programmatic** generators expressed as small, diffable TypeScript + JSON specs; (B) **AI-generated** assets authored offline as img2threejs TypeScript + JSON specs (primary) with TRELLIS.2 opaque GLB as a fallback; and (C) **internet-sourced** FOSS/redistributable assets committed local with a mandatory provenance + license record. All three tracks are offline authoring artifacts — no runtime generation, remote fetch, or provider call occurs during play. The asset-mix framing is inspired by `Julian-adv/OpenMMO`, but this module copies none of its source and takes no dependency on it.

## Product Requirements

### Problem

Knowgrph has a native Three.js renderer, a deterministic Agentic ECS, a procedural XR terrain catalog, and browser-local Source Files persistence — but no RPG world loop, and no disciplined way to assemble the large, mixed-provenance asset set an MMO-style world needs while staying FOSS-first, license-clean, diffable, local, and offline. A first increment must be playable offline without a second engine, a speculative AI stack, a network service, an authentication flow, or any runtime asset generation, and every asset must carry auditable provenance and a redistributable license.

### Primary user

Mei is a mobile-first player who wants to open a source-backed browser workspace and explore a small RPG world immediately — move, talk to an NPC, accept and complete one quest, pick up an item — with no sign-in, camera request, or network dependency, then explicitly Save her validated progress locally.

A secondary user, the solo maintainer, wants every world asset to arrive with clear provenance and a redistributable license, to prefer diffable procedural/spec assets over opaque binaries, and to keep asset TCO and audit cost near zero.

### Primary journey

| Stage | Player action | Runtime owner | Durable effect |
|---|---|---|---|
| Enter | Apply the source-backed world seed or invoke `/mmorpg @canvas #world operation=open` | Run-ready activation | World mounts on the shared XR Canvas |
| Explore | Move through a zone with keyboard/pointer/touch/gamepad | Deterministic Agentic ECS `World_Tick` | Player position/zone state |
| Interact | Talk to an NPC, accept a quest, pick up an item | Dialogue/quest/inventory systems | Quest-flag and inventory Decisions (pending) |
| Progress | Complete the quest objective | Objective evaluator | Terminal quest result (pending Save) |
| Save | Explicitly Save | WorkspaceFs Decision adapter | Decisions-only KGC `@node` write |
| Return | Reopen the same browser workspace | Hydration/resume adapter | Reconstructed world/quest/inventory progress |

### Must scope

- One selected authored XR zone/terrain and collider profile from the existing local catalog; the world owns no replacement environment, manifest, R2, CDN, or runtime asset download.
- One offline single-player world: one explorable zone, 3–5 NPCs, one dialogue tree, one quest with a completion objective, a small inventory, and one retry/reset path.
- One FloatingPanel MMORPG lifecycle: `open`, `start`, `stop`, `restart`, `interact`, `save`, and `exit`.
- Desktop keyboard/pointer, mobile touch, and gamepad controls, plus optional reuse of the existing Motion Control pose adapter (input only, never an NPC or quest policy).
- One fixed-step deterministic simulation using the native Agentic ECS with ephemeral runtime state.
- In-repo movement, AABB collision, deterministic NPC scoring (closed action set), and deterministic quest/inventory state transitions — no external engine, navmesh, or LLM.
- **Asset provenance pipeline** governing the three-track asset mix (procedural, AI-generated, internet-sourced), all committed local and offline, each with a provenance + license record; the loader prefers diffable spec/procedural assets.
- A HUD reporting health, zone, quest state, inventory, save state, and explicit errors.
- Browser-local, Decisions-only KGC persistence through an explicit, idempotent Save; terminal results remain pending until that action succeeds.
- Strict native `/mmorpg @canvas #world` invocation and browser-local `knowgrph.inspect_local_mmorpg` / `knowgrph.control_local_mmorpg` WebMCP.
- Stop followed by Start resumes the exact in-memory tick and world state; Restart is the explicit fresh-run action.
- Synchronous WebGL admission, one existing Canvas, XR pause/restore ownership, and visible fail-closed runtime errors.
- Source-authored `run_ready_demo.id` activation through the known registry, independent of an imported path and fail-closed on identity conflict.

### Deferred scope

- **Networked massively-multiplayer shared world**, authoritative server sync, concurrent players, shared persistence, guilds, chat, trading, and matchmaking. Requires separate operator authorization, an ADR, and a substrate decision; Supabase and any remote realtime/state backend are forbidden.
- WebAuthn/passkeys, identity, accounts, cloud sync, and cross-device saves.
- Hosted or local LLMs, agent reasoning, generative dialogue, model escalation, edge-ML policy models, ONNX Runtime, and token budgets.
- Runtime image-to-3D generation, streaming/procedural asset generation at play time, or any remote model/asset call during play.
- Rapier, Yuka, `behaviortree.js`, recastnavigation, bitECS, or another game/ECS/physics engine.
- Any copy of, or runtime/build dependency on, `Julian-adv/OpenMMO` (inspiration only), and any non-redistributable or license-incompatible asset.
- Remote assets, D1, R2, KV, Durable Objects, Workers, Pages, or production routes; automatic Git commits, pushes, pull requests, or deployments from the browser runtime.

### User stories

1. As Mei, I can enter and explore the world with no account, camera prompt, or network dependency.
2. As Mei, movement, NPC dialogue, quest acceptance/completion, and inventory pickup form one coherent local loop.
3. As Mei, the same input sequence reproduces the same world state.
4. As Mei, a malformed save is never silently replaced; I can inspect the error and explicitly reset it.
5. As Mei, explicitly saving writes only validated Decisions (quest flags, dialogue outcomes, world-tick results) to my browser-local workspace.
6. As the maintainer, every world asset carries a provenance + redistributable-license record, procedural/spec assets are preferred over opaque binaries, and no asset is generated or fetched at runtime.
7. As an operator or agent, I can inspect and control the same local world through one strict invocation grammar and browser WebMCP contract.
8. As a maintainer, I can prove the core runtime is model-free, network-free, deterministic, license-clean, and Dev-only.

### Acceptance criteria

#### AC-1: open and explore

Given a clean browser-local workspace, when the world seed is applied, then the bounded world reaches a playable frame in the canonical authored XR zone without sign-in, camera permission, passkey API access, remote asset fetch, or Cloudflare request.

#### AC-2: deterministic world

Given the same world seed and normalized input frames, when two fresh runtimes advance the same fixed number of ticks, then player, NPC, quest, inventory, Decisions, and HUD projection are byte-equivalent after canonical serialization.

#### AC-3: in-repo simulation and collision

Given control input, when a tick advances, then in-repo movement and the AABB resolver return bounded non-penetrating positions against the authored zone slabs, and NPC/quest/inventory transitions are deterministic with stable tie-breaking — without a second renderer, physics engine, navmesh, or floating dependency fallback.

#### AC-4: governed three-track asset provenance

Given any world asset, when it is loaded, then it resolves to a committed local file on one of three tracks — (A) procedural/programmatic TypeScript+JSON generator output, (B) AI-generated img2threejs TypeScript+JSON spec (primary) or TRELLIS.2 opaque GLB fallback, or (C) internet-sourced FOSS/redistributable asset — and it carries a provenance record `{track, origin, license, attribution, representation, diffable}`. The loader prefers a diffable spec/procedural asset when more than one representation exists. No runtime image-to-3D model, asset generator, network fetch, or Cloudflare resource is invoked to obtain any asset.

> **VCC translation** (AC-4): `Verify every world asset has a provenance record with a redistributable (FOSS-compatible) license and a non-empty origin, that a source scan finds no runtime asset-generation or network/model asset call, that opaque-binary (Track B GLB / Track C binary) count is tracked and minimized against diffable specs, and that any asset lacking a compatible license or provenance fails the local asset gate.`

#### AC-5: canonical zero cost

Given a successful world `World_Tick`, when no reasoning request exists, then it returns exactly one canonical zero Cost_Log (`model: "none"`, all token fields `0`, `estimated_cost_usd: 0`, `incomplete: false`). No token ceiling, escalation, retry, fallback model, or synthetic non-zero cost record exists in this increment.

#### AC-6: decision-only local save

Given a completed quest or world milestone, when Mei explicitly selects **Save** and persistence succeeds, then browser-local WorkspaceFs contains only canonical `EcsDecision` additions using the supported `dialogue_outcome`, `quest_flag`, or `world_tick_result` types. Component arrays, world snapshots, cost logs, credentials, and raw input history are not written.

#### AC-7: fail-closed hydration and retry

Given no save document, the runtime may create a fresh world. Given an existing malformed KGC save, hydration blocks before a World is created, names the unreadable local path, preserves the original bytes, and exposes an explicit **Reset local save** action. Given a write failure, pending Decisions remain in memory, prior bytes are unchanged, and the HUD exposes **Retry save**. No silent drop, fabricated success, or automatic reset is allowed.

#### AC-8: strict invocation and browser WebMCP

Given an invocation, exactly one `/mmorpg`, one `@canvas`, and one `#world` token is accepted. Duplicate sigils, unknown keys, mixed structured/native input, and invalid lifecycle operations fail closed. Browser agent-ready registration exposes only `knowgrph.inspect_local_mmorpg` and `knowgrph.control_local_mmorpg` for this surface; it adds no stdio tool, HTTP mutation route, remote gateway, or deployment authority. The private Agentic ECS stdio lane remains exactly three tools.

#### AC-9: shared Canvas and XR ownership

Given a running XR surface, entering MMORPG World keeps the authored atmosphere, zone, and scene graph visibly mounted inside the same Canvas and overlays only the player, NPCs, world props, camera, and HUD. No fallback scene, second renderer, alternate world, or renderer branch is introduced. Camera source (fixed-follow / free-orbit) and Timeline camera-marks are reused.

#### AC-10: no-network, no-multiplayer boundary

Given core gameplay, when the world runs, then no networked multiplayer session, remote sync, Supabase call, or Cloudflare resource is opened or required; the world is single-player and offline. Any networked shared-world path is absent from this increment and fails closed if invoked.

### Success metrics

| Metric | Must target |
|---|---|
| First value | Playable first frame plus one NPC interaction from the source-backed demo |
| Deterministic replay | Two identical input traces yield identical canonical results |
| Runtime model calls | 0 (including 0 runtime asset-generation calls) |
| Gameplay network calls | 0 required; 0 multiplayer sessions |
| Token and inference cost | 0 tokens; USD 0 |
| Asset license coverage | 100% of assets carry a provenance + redistributable-license record |
| Asset diffability | Diffable procedural/spec assets preferred; opaque-binary count tracked and minimized |
| Persistent data | Validated Decisions only |
| New runtime dependencies | 0 |
| Production mutation | 0 |

## Technical Architecture

### Four-lens overview

| Lens | Applied constraint (this module) | Key decision |
|---|---|---|
| **Min-viable-max-value** | One zone, a few NPCs, one quest, a small inventory — reusing the existing Canvas, ECS, terrain catalog, and camera source | No new engine and no networking; add only RPG systems and the asset-provenance loader |
| **TCO-zero** | Prefer diffable procedural/spec assets; internet-sourced assets are committed local and license-gated; zero infra, browser/local/offline | Diffable-first asset mix keeps storage, review, egress, and license risk near zero |
| **Token economics** | The world `World_Tick` performs zero model calls; asset generation is offline | Every tick emits a canonical `$0` Cost_Log; no runtime generation or provider call |
| **Harness-first** | No ad-hoc model calls; deterministic RPG systems in-tick; any future generative content stays an offline authoring step | NPC/quest/dialogue logic is deterministic, not LLM-driven |

### Ownership

| Concern | Canonical owner | Rule |
|---|---|---|
| World domain | `canvas/src/features/game-mmorpg/` | Zone config, movement/NPC/quest/inventory systems, input normalization, HUD projection, local save adapter |
| Surface lifecycle | `canvas/src/features/game-mmorpg/mmorpgRuntime.ts` | Own open/start/stop/restart/interact/save/exit state and previous-surface restoration |
| Invocation/WebMCP | `canvas/src/features/game-mmorpg/mmorpgMcpRuntime.ts` plus browser agent-ready registration | Enforce the strict native tuple and browser-local inspect/control schema |
| Entity simulation | `ecs/` | Reuse the native Agentic ECS API and its transactional `worldTick`; ephemeral runtime state |
| Movement & collision | `canvas/src/features/game-mmorpg/worldModel.ts` | In-repo deterministic movement and AABB zone resolution; no external physics engine or navmesh |
| NPC / quest / inventory | `canvas/src/features/game-mmorpg/rpgSystems.ts` | Deterministic scoring and state transitions with stable tie-breaking; no LLM or edge-ML |
| Asset provenance | `canvas/src/features/game-mmorpg/assetProvenance/` | Resolve assets across the three tracks; enforce the provenance + license gate; prefer diffable spec/procedural; load only committed local files |
| Rendering | `canvas/src/lib/three/ThreeGraph.impl.tsx` plus the canonical XR stage owners | Reuse the single React Three Fiber Canvas and authored XR world; add only players, NPCs, props, camera, and HUD |
| Camera/input arbitration | Existing Three controls, camera source, Timeline camera-marks, and Motion Control adapter | World owns framing while active; Motion Control contributes normalized input only |
| Browser persistence | `canvas/src/features/workspace-fs/` | Use WorkspaceFs and its existing source-file bridge; add no storage or Git owner |
| Cost truth | `contracts/cost-log.schema.js` | Accept only the canonical model-free zero record for the no-reasoning tick |
| Activation | `docs/workspace-seeds/knowgrph-physics-playground-demo.md` (validation) and a future `knowgrph-game-mmorpg-demo.md` seed | Source-backed run-ready activation |

### Runtime topology

```mermaid
flowchart LR
  SEED["Source-backed world seed"] --> ACTIVATE["Run-ready activation"]
  INVOKE["/mmorpg @canvas #world or browser WebMCP"] --> ACTIVATE
  ACTIVATE --> RUNTIME["MMORPG world runtime"]
  ASSETS["Asset provenance loader"] --> RUNTIME
  PROC["Track A: procedural TS + JSON generators (diffable)"] --> ASSETS
  AIGEN["Track B: AI-generated img2threejs spec (primary) / TRELLIS.2 GLB (fallback)"] --> ASSETS
  SRC["Track C: internet-sourced FOSS asset (committed local, license-gated)"] --> ASSETS
  GATE["Provenance + license gate"] --> ASSETS
  INPUT["Desktop, pointer, touch, gamepad, or optional Motion Control"] --> NORMALIZE["Normalized input frame"]
  NORMALIZE --> TICK["Fixed Agentic ECS World_Tick"]
  RUNTIME --> TICK
  TICK --> MOVE["In-repo movement + AABB collision"]
  TICK --> RPG["Deterministic NPC / quest / inventory"]
  TICK --> VIEW["Immutable scene and HUD projection"]
  VIEW --> THREE["Existing R3F Canvas"]
  TICK --> PENDING["Validated pending Decisions"]
  PENDING --> TERMINAL{"Terminal result?"}
  TERMINAL -->|no| TICK
  TERMINAL -->|yes| WAIT["Pending until explicit Save"]
  WAIT --> SAVE["Browser-local WorkspaceFs save"]
```

No node in this topology is a model, remote service, Cloudflare resource, Supabase backend, multiplayer session, Git operation, deployment step, or runtime asset-generation call. The asset provenance loader reads only committed local files that passed the license gate.

### World / RPG model

Zone rules are constant and source-controlled: the selected authored XR profile supplies world bounds, collision boxes, and admitted spawns; the world config supplies NPC placement, dialogue trees, quest definitions/thresholds, loot tables, and inventory limits. The simulation advances from normalized input frames on a fixed timestep, not from DOM events, with a bounded accumulator that caps catch-up work. NPC behavior, dialogue branching, quest-flag transitions, and inventory changes are deterministic with stable tie-breaking. Runtime component storage is ephemeral; only meaningful Decisions (dialogue outcome, quest flag, world-tick result) persist.

### Asset provenance pipeline (procedural + AI-generated + internet-sourced)

An MMO-style world needs many assets. This module governs a **three-track mix**, all committed local and loaded offline, each carrying a provenance record and passing a license gate before it can ship:

- **Track A — Procedural / programmatic (preferred).** In-repo deterministic generators (zones, props, dungeons, loot tables) expressed as **small, diffable TypeScript + JSON specs/seeds**. Highest diffability, lowest TCO, deterministic to load and replay. Preferred whenever an asset can be expressed procedurally.
- **Track B — AI-generated (offline authoring).** Bespoke models authored offline via the same discipline as the flight-sim module: **img2threejs TypeScript + JSON scene spec as the primary, diffable representation**, with a **TRELLIS.2 opaque binary GLB as a committed local fallback** where a spec is not yet available. Generation is an offline step; no image-to-3D model runs at runtime.
- **Track C — Internet-sourced (FOSS/redistributable).** Assets obtained once at authoring time from FOSS/appropriately-licensed sources, **committed local** with a **mandatory provenance + license manifest** (origin URL, license, attribution). Never fetched at runtime. Assets whose license is missing, incompatible with FOSS-first redistribution, or unverifiable are **rejected by the license gate**.

**Provenance record (every asset):** `{ assetId, track: "procedural" | "ai-generated" | "internet-sourced", origin, license, attribution, representation: "spec" | "glb" | "other-binary", diffable: boolean }`. **Governance rules:** the loader prefers a diffable spec/procedural representation when more than one exists; the runtime loads only committed local files that passed the gate; opaque-binary count (Track B GLB and Track C binaries) is a tracked success metric to minimize; the gate fails closed on a missing/incompatible license or empty origin. The asset-mix framing is inspired by `Julian-adv/OpenMMO` but copies none of its source and takes no dependency on it.

### Persistence and resume

The local save path is owned by the world adapter under WorkspaceFs. A terminal quest/milestone leaves canonical Decisions pending; only explicit **Save** merges them idempotently by `decisionId`. Existing authored bytes remain untouched except for supported KGC Decision insertion. Resume derives world/quest/inventory progress from the validated Decision index before the first tick. Malformed existing KGC is not equivalent to an absent save: the runtime reports the precise local path and error, creates no partial World, and waits for explicit reset.

### Error model

| Failure | Required result |
|---|---|
| Invalid world/zone config | Block activation with a typed local error |
| Invalid input value | Reject or normalize to a bounded neutral value before tick |
| Tick/system failure | Keep prior committed systems, expose failure, do not claim a successful frame |
| Asset missing provenance or license | Reject at the license gate with a local error naming the asset; never ship or fetch it |
| Missing/invalid asset representation | Try a lower-priority committed representation if licensed; else fail closed locally; never fetch remotely or generate at runtime |
| Malformed existing save | Preserve bytes, block hydration, expose explicit reset |
| Local write failure | Preserve prior bytes and pending Decisions, expose retry |
| Multiplayer/remote path invoked | Fail closed; the networked shared world is absent from this increment |
| WebGL unavailable | Fail the synchronous admission probe, keep the world stopped, show a local unsupported state without a remote or second renderer |

## Architecture Decisions

### ADR-1: Reuse the existing renderer and native ECS

**Status:** Accepted for this increment.

MMORPG World mounts a dedicated stage inside the existing `ThreeGraph` React Three Fiber Canvas and uses the native Agentic ECS for ephemeral runtime state. A second renderer, second camera owner, bitECS, Babylon.js, or another ECS is rejected because it duplicates an existing repository owner.

### ADR-2: Own minimal RPG simulation in-repo; deterministic, not LLM-driven

**Status:** Accepted for this increment.

Movement, AABB collision, NPC scoring, dialogue branching, quest flags, and inventory use deterministic in-repo rules with stable tie-breaking, consuming the shared authored XR collider profile. Rapier, navmesh, hosted/local LLMs, and edge-ML policies are rejected for the Must scope; they add weight, cost, and non-determinism without improving the bounded world's acceptance criteria (AC-2).

### ADR-3: Governed three-track asset provenance (procedural + AI-generated + internet-sourced)

**Status:** Accepted for this increment.

World assets are a governed mix of **procedural/programmatic** TypeScript+JSON generators (preferred, diffable), **AI-generated** img2threejs specs with a TRELLIS.2 GLB fallback (offline authoring), and **internet-sourced** FOSS/redistributable assets (committed local, license-gated). Every asset carries a provenance record and must pass a license gate.

**Alternatives considered:**
1. Runtime generation / streaming of assets (image-to-3D or fetched at play time): rejected — reintroduces model calls, network, latency, cost, and license ambiguity on the hot path, and breaks offline-first.
2. Binary-only asset library (GLB/other binaries as the default): rejected as the default — opaque, non-diffable, larger, and harder to audit or license-verify.
3. **Chosen — diffable-first, three-track, license-gated, offline mix**: procedural/spec preferred; AI-generated and internet-sourced allowed as committed local, provenance-tracked, license-verified exceptions.

**Rationale:** an MMO-scale world needs volume and variety, but the FOSS-first and TCO-zero lenses require that assets be auditable, redistributable, diffable where possible, and free of runtime cost. A provenance record plus a license gate makes a large mixed asset set safe to ship and cheap to review; preferring procedural/spec keeps most of the set diffable and deterministic.

**Consequences:**
- **Positive:** auditable, redistributable, mostly-diffable, offline asset set with no runtime generation/fetch cost and clear attribution.
- **Negative:** internet-sourced and AI-generated binaries need per-asset license verification and are counted/minimized against diffable specs; authoring has an offline gate step.
- **Neutral:** `Julian-adv/OpenMMO` remains inspiration only; the opaque-binary and internet-sourced counts are tracked success metrics.

### ADR-4: Defer networked massively-multiplayer play

**Status:** Accepted for this increment.

The Must scope is an **offline, single-player, MMO-style RPG world**. Networked shared-world play (concurrent players, authoritative sync, durable multi-player state) is deferred: it conflicts with the zero-infra, local-first, offline-first constraints and would require a networking substrate and durable backend that are out of scope. **Supabase and any remote realtime/state backend are forbidden.** A future networked increment requires separate operator authorization, its own ADR, and a substrate decision; core Game code must not open a multiplayer session, remote sync, or credential/`getUserMedia` flow.

### ADR-5: Persist Decisions through browser-local WorkspaceFs; Dev-only readiness

**Status:** Accepted for this increment.

The runtime writes canonical KGC Decisions through the existing browser-local filesystem owner; component state and raw World snapshots remain ephemeral. Runtime readiness means focused source proof plus a local browser smoke bound to an exact commit; production and Cloudflare lanes require a separate operator-authorized release workflow. No automatic Git commit is performed or implied.

## Runtime Readiness Gate

This module is `draft`; no runtime-readiness proof exists yet. The intended local, finite proof mirrors the sibling FPS and flight-sim gates:

```bash
npm run game-mmorpg:runtime-ready
npm run game-mmorpg:browser-smoke
```

Both commands must be finite and local apart from ordinary build/test artifacts, must access no paid model, runtime asset generator, or remote asset service, and must not deploy or mutate Cloudflare. A dedicated asset-provenance check must verify that every world asset carries a compatible license and provenance record and that no runtime generation/fetch path exists. The physics-playground seed (`docs/workspace-seeds/knowgrph-physics-playground-demo.md`) is the interim validation surface: it already provides the shared XR Canvas, procedural terrain, camera source, Motion Control boundary, and `/ @ #` MCP grammar — all local-only with no external calls.

## Agent-Platform Readiness

| Dimension | Scope |
|---|---|
| Agentic OS-ready | Canonical `/mmorpg @canvas #world` metadata is projected through the pinned Agentic OS invocation dictionary; cross-repo integration is separately evidenced. |
| AI Agent-ready | Browser agent-ready registration exposes read-only inspection and mutating lifecycle control without adding a model, prompt, reasoning path, or autonomous persistence. |
| MCP-ready | `knowgrph.inspect_local_mmorpg` and `knowgrph.control_local_mmorpg` are browser-local WebMCP only. No stdio, HTTP mutation route, remote gateway, or deployment authority is added; the private Agentic ECS stdio lane remains exactly three tools. |

## Release Boundary

This module is a local `draft` candidate. No Pages build upload, Worker deployment, D1/R2/KV/DO mutation, Supabase resource, production route change, or release claim belongs to this scope. Asset authoring (procedural generation, img2threejs, TRELLIS.2, and internet sourcing) is an offline step that produces committed, license-verified local artifacts; it is never a runtime or deployment dependency. Any future networked multiplayer increment must begin from a protected integrated SHA, an explicit operator authorization, and its own substrate ADR.
