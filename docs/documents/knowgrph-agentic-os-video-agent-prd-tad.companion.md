---
title: "Knowgrph — Agentic OS Video_Agent PRD/TAD (Companion)"
id: "md:knowgrph-agentic-os-video-agent-prd-tad-companion"
author: "airvio / joohwee"
date: "2026-07-05"
updated: "2026-07-05"
version: "0.2.0"
status: "runtime-ready"
parent: "docs/documents/knowgrph-agentic-os-prd-tad.md"
parent_version: "0.5.0"
readiness:
  agentic_os: "n/a — this companion extends the Video_Remix Director harness the parent Agentic OS aggregates read-only; it adds no new Os_Status_Tool view"
  ai_agent: "unchanged — reuses the parent's four-surface MCP + harness contracts; no new agent-discoverable surface is introduced"
  mcp_gateway: "unchanged — no new tool transport; every video-generation/editing call routes through the existing control-plane `McpAgent`"
doc_type: "Combined PRD/TAD (Companion)"
lang: "en-US"
frontmatter_contract: "required"
domain: "knowgrph"
orientation:
  - "solo-dev"
  - "AI-native"
  - "min-viable-max-value"
  - "TCO-zero"
  - "FOSS-first"
  - "token-economical"
  - "harness-first"
constraints:
  - "universal"
  - "neutral"
  - "agnostic"
  - "modular"
  - "runtime-ready"
  - "native-in-repo: all runtime surfaces live in huijoohwee/knowgrph"
  - "enhancement of the existing Video_Remix Director — not a rebuild"
  - "zero new persistent datastore"
  - "zero new dependency"
  - "zero new provider-integration surface"
  - "zero new Approval_Gate id for any spend-bearing action"
traceability:
  prd: "PRD-VIDEO-AGENT"
  tad: "TAD-VIDEO-AGENT"
  repo: "huijoohwee/knowgrph"
  feature_surface: "knowgrph Video_Agent (Video_Remix Director enhancement)"
  doc_path: "docs/documents/knowgrph-agentic-os-video-agent-prd-tad.companion.md"
source_references:
  requirements: ".kiro/specs/knowgrph-video-agent/requirements.md"
  design: ".kiro/specs/knowgrph-video-agent/design.md"
  parent_prd_tad: "docs/documents/knowgrph-agentic-os-prd-tad.md"
  connector_spec: ".kiro/specs/knowgrph-acos-mcp-connector"
  agentic_os_spec: ".kiro/specs/knowgrph-agentic-os"
  tech_stack: "docs/documents/knowgrph-tech-stack-document.md"
---

# Knowgrph — Agentic OS Video_Agent PRD/TAD (Companion)

SSOT upstream: `.kiro/specs/knowgrph-video-agent/requirements.md` (EARS acceptance criteria, Glossary, MoSCoW) and `.kiro/specs/knowgrph-video-agent/design.md` (components, data models, 21 correctness properties). This companion follows the combined PRD/TAD form established by the parent [`knowgrph-agentic-os-prd-tad.md`](knowgrph-agentic-os-prd-tad.md) (v0.5.0) and the [PRD & TAD Guidelines](https://huijoohwee.github.io/guidelines/prd-tad-guidelines.md) Follow-On PRD/TAD Template — it does not restate parent content it can instead reference (DRY): the parent's Agentic OS topology, Os_Status_Tool, ADR-1 through ADR-4, and Spend_Isolation_Boundary reaffirmation are unchanged and unrepeated here. Where this document and `design.md` would otherwise duplicate content — the full quantified statement of each of the 21 correctness properties — this document lists property titles and traceability only and defers the exhaustive statements to `design.md` (MECE: one canonical location per fact).

**Relationship to parent**: the parent PRD/TAD's Overview names the `knowgrph.video_remix.run` Director as one of knowgrph's nine existing harnesses, aggregated (read-only) by the Agentic OS's Process_Registry, Cost_Ledger_Aggregator, and Gate_Catalog. This companion specifies an **enhancement of that same Director** — it does not touch the Agentic OS's own read-only aggregation code, and every new spend/token/approval event this companion introduces flows through the Agentic OS's existing aggregators without any change to them.

## Overview

`knowgrph` already runs the Video_Remix Director (`knowgrph.video_remix.run`) — a native-in-repo, approval-gated Agentic_Loop harness that now sequences **research → storyboard → render → edit → publish → checkout**. BytePlus ModelArk is integrated through the Cloudflare AI Gateway client (`mcp/video-remix/ai-gateway-client.js`), and the render/edit handoff is represented by durable render assets plus a single manifest-only `Edited_Video_Reference`.

The **Video_Agent** is the increment that closes that gap. It is a glue-and-extend layer over the existing Director — not a new orchestrator, not a rebuild — that:

1. Adds a **Narrative_Coherence_Check** and a **Token_Budget_Ceiling** (with a defined **Narrative_Degraded_Mode**) to the storyboard stage, so the agent's narrative ability is observable and its token spend is bounded.
2. Wires the already-implemented `createBytePlusVideoProvider` into the render stage's live-client resolution as the **default** video-generation client, replacing the generic Strytree queue client as the default while keeping it reachable behind an explicit override.
3. Adds exactly one new Director stage, **Editing_Stage**, between `render` and `publish`, producing an `Edit_Manifest` and an `Edited_Video_Reference` with zero new dependency and zero new datastore.
4. Reuses every existing approval gate, cost ledger, retry/circuit-breaker bound, and BytePlus integration path unmodified.

Two capabilities are first-class and independently demonstrable: **narrative ability** (a coherent, non-repetitive shot sequence) and **multimodal orchestration** (a traceable text→video→edited handoff), both under a **bounded token budget**.

## Four-Lens Overview

| Lens | Applied Constraint (this companion) | Key Decision |
|---|---|---|
| **Min-Viable-Max-Value** | Ship exactly one new stage (Editing_Stage) and route the existing BytePlus video provider through the existing Director | No new orchestrator, no new harness class beyond one small new file (`editing-harness.js`) |
| **TCO-Zero** | Zero new npm/pip dependency, zero new datastore, zero new provider-integration surface (Requirement 10) | Editing composition resolved to a manifest-persist, zero-re-encode approach (ADR-VA-1); BytePlus per-call spend is the only cost delta, already accounted |
| **Token Economics** | A configured Token_Budget_Ceiling bounds narrative-reasoning token spend; a token-accounting gap defaults to the protective full-remaining-budget assumption rather than silently permitting overspend | Default ceiling of 2000 tokens/run (ADR-VA-4) makes the bounded-budget capability demonstrable out of the box |
| **Harness-First** | Every new capability is a typed extension of an existing harness contract (Storyboard_Harness, Render_Harness) or one small new harness (Editing_Stage) with the same typed-input → typed-output → Cost_Log → fallback shape | No ad-hoc prompt call; the Editing_Stage is zero-spend by construction (ADR-VA-3) |

## PRD

### Problem Statement

The Video_Remix Director now sequences research → storyboard → render → edit → publish → checkout under approval gates and bounded retry. This companion makes those capabilities demonstrably agentic: live runs with complete BytePlus configuration route every approved planned shot through the existing Cloudflare AI Gateway → `createBytePlusVideoProvider` path, the zero-spend Editing_Stage assembles completed shots into one `Edit_Manifest`/`Edited_Video_Reference`, and real render/edit failures append the same shared-counter exhaustion record as any other Director failure. The remaining operator challenge is proving the run in a transparent manifest: narrative quality, text→video prompt identity, durable media handoff, bounded token spend, cost/ledger accounting, and downstream blocking must all be observable without a second provider surface, datastore, or translation layer.

### Personas

| Persona | Need | Success |
|---|---|---|
| **Operator** (solo founder demonstrating the agent) | Show, not just assert, that the agent tells a coherent story and orchestrates text → video → edit end to end, under a bounded token budget | A single run's Run_Manifest exposes `narrativeCoherence.ok:true`, a byte-identical storyboard-to-render prompt match per shot, and (where a ceiling is configured) an observed degrade-rather-than-exceed outcome |
| **End_Creator** (consumer of the pipeline's output) | Receive one cohesive, ordered video rather than a set of disconnected shot clips | Every run with ≥1 completed shot asset produces exactly one `Edited_Video_Reference` resolvable under the existing media bucket |

### User Journey Flow: Operator — Demonstrate Narrative Ability and Multimodal Orchestration

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| **Trigger** | Operator wants to show the agent's storytelling and text→video orchestration to a demo audience | `knowgrph.video_remix.run` (local MCP or control-plane) | No observable proof exists today that the storyboard is non-repetitive or that the render dispatch used the planned prompt | Narrative_Coherence_Check + Shot_Prompt_Traceability surfaced directly on the Run_Manifest |
| **Discover** | Operator runs a dry-run to preview the storyboard's planned shots | Storyboard stage result | Cannot tell, from the existing output, whether consecutive shots repeat a beat | `narrativeCoherence: {ok, repeatedShotIds}` on the storyboard result |
| **Engage** | Operator approves `render-action` and re-runs live | Render stage → BytePlus_Video_Provider | Operator needs proof that the planned prompt drove the generated video | Live BytePlus dispatch produces a real, resolvable video asset per shot |
| **Complete** | Operator reviews the completed run's Edit_Manifest and Edited_Video_Reference | Editing_Stage result | Individually rendered shots were never assembled into one output | One `Edited_Video_Reference` per run with ≥1 completed shot asset |
| **Return** | Operator re-runs with a tighter Token_Budget_Ceiling to demonstrate graceful degradation | Storyboard stage, degraded mode | No way to show the agent behaving well under a tight budget | `degraded:true, reason:"token_budget_ceiling"` observably recorded, never a silent overspend |

### User Stories (from requirements.md, condensed)

| Story | Acceptance (condensed) | VCC translation |
|---|---|---|
| **PRD-VA-1**: Narrative coherence is observable | No two consecutive planned shots share an identical prompt; result reported as `narrativeCoherence.ok`/`repeatedShotIds` | `Verify a storyboard result with pairwise-distinct consecutive prompts reports ok:true with empty repeatedShotIds; any consecutive duplicate reports ok:false naming both shot ids` |
| **PRD-VA-2**: Multimodal handoff is traceable | Every render dispatch's prompt is byte-identical to its storyboard-planned prompt; unplanned shots are logged, not fabricated | `Verify every recorded render-dispatch prompt is byte-identical to its storyboard-planned prompt; a shotId absent from the storyboard proceeds with the caller-supplied prompt and emits an unplannedShotDispatch log entry` |
| **PRD-VA-3**: Live BytePlus video generation | Render stage dispatches every planned shot through `createBytePlusVideoProvider` by default in Live_Mode with a verified `render-action` token | `Verify a Live_Mode run with a verified token dispatches every planned shot through createBytePlusVideoProvider; resolveStageClients() constructs no second video-generation client` |
| **PRD-VA-4**: Editing_Stage assembles one cohesive output | Edit_Manifest sequences every completed shot in storyboard order; exactly one Edited_Video_Reference is produced; zero-asset runs skip and block publish | `Verify N completed shot assets produce an Edit_Manifest with N entries in storyboard order; zero assets produce no Edit_Manifest and record an explicit skip reason` |
| **PRD-VA-5**: Token-budget ceiling with graceful degradation | Cumulative narrative-reasoning tokens never exceed a configured ceiling; the first call always issues; a token-accounting gap consumes the full remaining budget | `Verify a run whose post-call cumulative tokens meet/exceed the configured ceiling halts further narrative reasoning, reports degraded:true, and still emits a schema-valid Kgc_Document over shots planned before degradation` |
| **PRD-VA-6**: Approval-gate and spend-isolation reuse (guardrail) | Every spend-bearing boundary resolves to one of the six existing canonical gate ids; the new zero-spend-only gate id is never referenced by a spend-bearing path | `Verify every spend-bearing boundary check resolves to an existing APPROVAL_GATE_ID_VALUES entry; the new zero-spend-only id carries estimatedCostUsd:0 on every instance and is never referenced by a spend-bearing code path` |
| **PRD-VA-7**: Cost/token ledger reuse (guardrail) | Every new Cost_Log entry validates against the existing `validateCostLog()`; invalid entries are excluded and recorded, not silently dropped | `Verify every Cost_Log entry emitted by the video-generation/editing stages passes validateCostLog(), with contracts/cost-log.schema.js unmodified` |
| **PRD-VA-8**: BytePlus integration reuse (guardrail) | Every video-generation call routes through the existing `Ai_Gateway_Client`; zero new key/host/proxy surface | `Verify no new outbound host, provider id, or API-key environment variable is introduced; a run with absent/incomplete BytePlus configuration produces zero Ai_Gateway_Client invocations` |
| **PRD-VA-9**: Bounded orchestration preserved (guardrail) | Video-generation and Editing_Stage failures share the Director's one existing retry counter and circuit-breaker condition set | `Verify a shared-counter retry sequence that exhausts maxIterations produces Run_State "blocked" and halts every downstream stage, using the Director's existing retry.js exhaustion helpers unmodified` |
| **PRD-VA-10**: Zero new dependency/datastore (guardrail) | Zero new npm/pip dependency, zero new D1/R2/KV/Durable Object class | `Verify package manifests under mcp/, contracts/, and cloudflare/workers/knowgrph-mcp show zero added dependencies attributable to this increment's diff` |

### Success Metrics

Reproduced from requirements.md (SSOT — see that document for the complete table including baselines and timelines):

| Metric | Target |
|---|---|
| Narrative_Coherence_Check pass rate on demo runs | 100% report `ok:true` or a named, explainable failure |
| Shot_Prompt_Traceability match rate | 100% byte-identical prompt match |
| Video-generation stage live-wireable | Live BytePlus dispatch exercisable end to end in a deployed, approval-gated run |
| Editing_Stage present | 1 (produces Edit_Manifest + Edited_Video_Reference for every run with ≥1 completed shot asset) |
| Token_Budget_Ceiling enforcement | 100% of runs with a configured ceiling degrade rather than exceed it |
| New provider-integration surfaces / new dependency / datastore added | 0 (guardrail) |
| Monthly TCO delta (Video_Agent glue itself) | $0 beyond already-accounted BytePlus per-call spend |
| ROI Score threshold | ≥ 40 for any item promoted out of Won't |

### Time-to-Value: Operator Runs a Narrative-and-Video Demo

| Dimension | Estimate | Target ceiling | Validation method |
|---|---|---|---|
| TTV steps | 3 (configure a BytePlus live endpoint + Token_Budget_Ceiling; dry-run preview; approve `render-action` and re-run live) | ≤ 3 steps | Walk-through on a clean checkout |
| TTV elapsed time | ~5 minutes (excluding BytePlus poll time, bounded at 600s/shot) | ≤ 10 minutes to first approval-gated live shot | Timed first-run test |
| First-value action | One completed shot asset with a matching storyboard prompt and one Edit_Manifest entry | — | Observable Run_Manifest fields |
| Persona | Operator | — | Defined above |

### MoSCoW Priority

Reproduced from requirements.md (ROI Score = User Impact × Reach / (Build Hours + Monthly TCO + Token Cost/Month); Reach ≈ 40 demo/investor/judge sessions/month):

| Tier | Item | ROI Score | Rationale |
|---|---|---|---|
| Must | Live BytePlus video-generation stage (PRD-VA-3) | 50.0 | Demonstrates the headline capability; reuses ~90% of existing code |
| Must | Shot_Prompt_Traceability (PRD-VA-2) | 66.7 | Cheapest to build; highest demo-credibility value |
| Must | Narrative_Coherence_Check (PRD-VA-1) | 57.1 | Small, pure-function check; directly answers "does it demonstrate narrative ability" |
| Must | Approval-gate reuse, BytePlus integration reuse, zero-new-dependency (guardrails) | n/a | Non-negotiable constraints |
| Should | Editing_Stage (PRD-VA-4) | 33.3 | High demo value; composition mechanism needed a design decision (resolved: ADR-VA-1) |
| Should | Token_Budget_Ceiling + degraded mode (PRD-VA-5) | 36.4 | Directly demonstrates the bounded-budget goal; moderate build risk |
| Should | Cost/token accounting reuse (PRD-VA-7) | 40.0 | Needed to make PRD-VA-3/5 observable |
| Could | Bounded orchestration preserved, explicit re-statement (PRD-VA-9) | 30.0 | Mostly true by construction; formalized for verification value |
| Won't (this increment) | General-purpose video-editing UI/timeline | — | Out of scope for a headless Director stage; fails min-viable-max-value |
| Won't (this increment) | A second video-generation provider (fallback) | — | Fails TCO-zero/reuse-first |
| Won't (this increment) | Real-time preview/streaming during generation | — | Not required to demonstrate narrative ability or orchestration |

### Min-Viable Scope

The render stage dispatches live through `createBytePlusVideoProvider` by default; the storyboard stage reports `narrativeCoherence` and (when configured) degrades gracefully under a Token_Budget_Ceiling; the Editing_Stage assembles a manifest-only, zero-re-encode `Edit_Manifest`/`Edited_Video_Reference` for every run with ≥1 completed shot asset — all behind the Director's existing approval gates, retry bound, and cost ledger.

### Out of Scope

- A general-purpose, user-facing video-editing timeline or UI.
- A second video-generation provider integration.
- Modifying `contracts/approval.schema.js`, `contracts/cost-log.schema.js`, the six canonical Approval_Gate ids, or the 15-minute Approval_Token TTL.
- Modifying the Director's existing `maxIterations` bound, backoff policy, or circuit-breaker condition set.
- A new persistent datastore dedicated to Edit_Manifest or token-budget state.
- Real-time push/streaming/webhook delivery of render/edit progress.
- Modifying the parent Agentic OS's Os_Status_Tool, its five read views, or any of ADR-1 through ADR-4 in the parent document.

### Dependencies

See requirements.md's Dependencies section for the full list of existing files this companion extends unmodified or extends additively (`mcp/video-remix/run-video-remix.js`, `storyboard-harness.js`, `render-harness.js`, `render-providers.js`, `ai-gateway-client.js`, `live-clients.js`, `director-live-run.js`, `contracts/approval.schema.js`, `contracts/cost-log.schema.js`). No AWS, Vercel, or Supabase dependency exists or is introduced, consistent with the parent document's ADR-3.

### Resolved Decisions

| # | Prior decision point (requirements.md) | Resolution (this document) |
|---|---|---|
| 1 | Editing composition mechanism (physical re-encode vs. manifest at playback time) | **Manifest consumed at playback time** — zero new dependency, zero new datastore. See **ADR-VA-1**. |
| 2 | Live render-client routing mechanism and Strytree reachability | **New `AI_GATEWAY_VIDEO_URL`** env var (default, BytePlus) + **`RENDER_PROVIDER=strytree`** override (Strytree stays reachable). See **ADR-VA-2**. |
| 3 | Editing_Stage spend gate | **No spend-bearing edit action exists this increment** (corollary of ADR-VA-1); the new zero-spend-only gate id is catalog-only, never verified. See **ADR-VA-3**. |
| 4 | Token_Budget_Ceiling default value | **2000 tokens/run**, sized against the existing 4-shot default and 5000-character brief cap. See **ADR-VA-4**. |

## TAD

### Journey → System Mapping

| Journey Stage | Workflow | Data Flow | Orchestration/Harness Flow | Component |
|---|---|---|---|---|
| Operator: Trigger/Discover | Storyboard stage read (extended) | Narrative_Coherence_Check + Token_Budget_Ceiling read | Orchestration/Harness Flow: video-generation + Editing_Stage pipeline | `mcp/video-remix/run-video-remix.js` (extended) |
| Operator: Engage | Render stage live dispatch | BytePlus_Video_Provider dispatch → R2 persist | Orchestration/Harness Flow: video-generation + Editing_Stage pipeline | `mcp/video-remix/live-clients.js` (extended), `render-providers.js` (unmodified) |
| End_Creator: Complete | Editing_Stage assembly | Edit_Manifest build → trim validate → manifest persist | Orchestration/Harness Flow: video-generation + Editing_Stage pipeline | `mcp/video-remix/editing-harness.js` (new) |
| Operator: Return | Storyboard stage degraded-mode re-run | Token_Budget_Ceiling read (repeat) | Orchestration/Harness Flow: video-generation + Editing_Stage pipeline | `mcp/video-remix/run-video-remix.js` (extended) |

### Topology (incremental diff over the parent's Agentic OS Topology v2.1.0 and the Video_Remix Director)

**Boundaries**: unchanged from the parent — Local Dev (stdio) and CF Edge (WHERE deployed). This companion adds **zero new trust boundaries** and **zero new nodes at the boundary level**; it adds edges/behavior inside the existing `live-clients.js` / Director control-plane node, plus one new in-process node (`editing-harness.js`) reusing the existing R2 media bucket.

| Node | Diff vs. parent Topology v2.1.0 |
|---|---|
| `live-clients.js` `resolveStageClients()` | **Changed**: render-slot branch now defaults to `createBytePlusVideoProvider` via a new adapter function; `createStrytreeRenderQueueClient` becomes override-only (`RENDER_PROVIDER=strytree`) |
| `createBytePlusVideoProvider` (render-providers.js) | **Unchanged** — reused as the default live video-generation provider |
| `Ai_Gateway_Client` | **Unchanged** — same host, same account; one new call-shape (video) already supported |
| `editing-harness.js` | **New node** — persists into the *existing* R2 `knowgrph-media` bucket under a new `stageId:"edit"` key prefix; zero new datastore |
| `contracts/approval.schema.js` `APPROVAL_GATE_ID` | **Additive**: +1 value `edit-manifest-assembly` (catalog-only); six existing ids byte-unchanged |
| `contracts/run-manifest.schema.js` `STAGE_ID` | **Additive**: +1 value `edit`; five existing ids byte-unchanged |

Full runtime diagram, sequence diagram, and per-node connection-type/data-residency table: see `.kiro/specs/knowgrph-video-agent/design.md` Architecture section (not duplicated here per MECE).

### Orchestration/Harness Flow: video-generation + Editing_Stage pipeline

**Trigger**: the Director reaches the `render` stage of a Live_Mode run with a verified, unexpired `render-action` Approval_Token.
**Topology pattern**: Agentic loop (bounded retry) composed with a short sequential pipeline (`render → edit`).
**Max iterations**: the Director's existing `maxIterations` (default 8, range [1,100]) — **shared** by video-generation and Editing_Stage failures, not a second counter.
**Circuit-breaker**: the Director's existing condition set `{blocked, budget_exceeded, approval_required, verification_failed}` — no new condition.
**Token budget**: video-generation calls are non-token-bearing (video model); the Editing_Stage's manifest assembly is a zero-token, zero-spend in-memory transform.

| Role | Component | Cost log emitted | Fallback |
|---|---|---|---|
| Dispatcher | `runRenderHarnessAsync` (unmodified) | — | Fail-closed rejection — zero dispatch, zero spend |
| Executor | `createBytePlusVideoProvider` → `Ai_Gateway_Client.submitVideo`/`pollVideoUntilDone` | ✓ (Credit_Ledger event per shot) | Provider/poll failure → shot failed, ledger event with actual spend, prior assets unchanged; no key/budget-cap-met → deterministic mock |
| Observer | `mcp/video-remix/cost-log.js` (unmodified) | — | Invalid entry excluded, recorded as validation failure, aggregation continues |
| Consumer (edit) | `editing-harness.js` `runEditingHarness` (new) | — (zero-spend; no Cost_Log entry attempted) | Zero assets → skip stage, block publish; trim invalid → reject manifest; persist failure → mark edit failed, preserve prior artifacts |

Full happy-path/alternate-path/error-path narrative and sequence diagram: see `design.md`'s Orchestration/Harness Flow and Sequence Diagram sections.

### Component Inventory

| Component | File | Status |
|---|---|---|
| Narrative_Coherence_Check | `mcp/video-remix/run-video-remix.js` | Extended |
| Token_Budget_Ceiling + Narrative_Degraded_Mode | `mcp/video-remix/run-video-remix.js` (wraps `storyboard-harness.js` call site) | Extended |
| `resolveStageClients()` render branch + `adaptBytePlusVideoProviderToRenderClient` | `mcp/video-remix/live-clients.js` | Extended |
| `createBytePlusVideoProvider`, `Ai_Gateway_Client`, `runRenderHarnessAsync` | `render-providers.js`, `ai-gateway-client.js`, `render-harness.js` | Reused unmodified |
| Editing_Stage harness | `mcp/video-remix/editing-harness.js` | **New file** |
| `createMediaPersister` | `mcp/video-remix/media-persist.js` | Reused unmodified |
| Stage sequencing | `mcp/video-remix/run-video-remix.js` | Extended |
| `STAGE_ID` / `APPROVAL_GATE_ID` enums | `contracts/run-manifest.schema.js`, `mcp/video-remix/constants.js` | Extended (additive) |
| Cost/token accounting, bounded retry/circuit-breaker, approval verification | `cost-log.js`, `retry.js`, `failure-handling.js`, `gate-token.js`, `render-token.js` | Reused unmodified |

Full component responsibilities, dependencies, configuration, and code sketches: see `design.md`'s Components and Interfaces section.

## Architectural Decisions (ADRs)

### ADR-VA-1: Editing composition mechanism — Edit_Manifest consumed at playback time

**Status**: Accepted

**Decision**: the Editing_Stage's "composition" step is a durable-reference persist of an `Edit_Manifest` JSON document through the existing `media-persist.js` into the existing R2 `knowgrph-media` bucket. No video bytes are re-encoded or concatenated; a future, explicitly out-of-scope playback-time consumer fetches the manifest and sequences the existing per-shot assets client-side.

**TCO comparison** (12-month, demo load):

| Option | Deployment model | Infra cost | Ops burden | Verdict |
|---|---|---|---|---|
| FFmpeg-capable Worker (`ffmpeg.wasm`, FOSS) | Managed/Serverless | $0 idle; CPU-time billing scales with video length | Near-zero, but CPU-time caps risk transcode reliability | Rejected this increment — deferred ADR candidate |
| Self-hosted FFmpeg VM | Provisioned/Self-Managed | ~$5–$20/mo fixed, non-zero at zero demo traffic | Full patching/monitoring burden | Rejected — violates zero-new-dependency/datastore guardrail |
| Provider-side compositing endpoint | N/A | Unknown — no such BytePlus endpoint exists | Unknown | Rejected — would be a second provider-integration surface |
| **Manifest at playback time (chosen)** | N/A (reuses existing bucket) | $0 delta | Zero incremental | **Accepted** |

**FOSS-first**: the FFmpeg alternatives are recorded as a **deferred ADR candidate** — revisit `ffmpeg.wasm` in a Worker (Managed/Serverless) before a self-managed VM (Provisioned/Self-Managed) if a future increment needs true re-encoding.

### ADR-VA-2: Live render-client routing — `AI_GATEWAY_VIDEO_URL` default + `RENDER_PROVIDER` override

**Status**: Accepted

**Decision**: a new `AI_GATEWAY_VIDEO_URL` env var gates construction of the default BytePlus video client — a distinct opt-in from the storyboard's chat-client gate, so live video generation can be toggled independently of live narrative chat. A new `RENDER_PROVIDER=strytree` env var is the escape hatch that keeps `createStrytreeRenderQueueClient` fully reachable, keyed on the pre-existing `STRYTREE_RENDER_URL`/`STRYTREE_API_KEY`. The BytePlus API key lookup (`BYTEPLUS_API_KEY` falling back to `AI_GATEWAY_TOKEN`) is identical to the existing storyboard-client lookup — zero new key surface. A new adapter function, `adaptBytePlusVideoProviderToRenderClient`, bridges `createBytePlusVideoProvider`'s dispatch shape to the Render_Harness's client contract without modifying either existing module.

**TCO comparison**: all options are $0 TCO (pure routing/configuration, no new vendor); the chosen option was selected on architectural-coupling grounds (keeps two independently-toggleable capabilities decoupled and preserves the "reused unmodified" commitment for `createBytePlusVideoProvider`), not cost.

### ADR-VA-3: Editing_Stage spend gate — no spend-bearing edit action this increment; new gate id is catalog-only

**Status**: Accepted

**Decision**: because ADR-VA-1 resolves editing to a manifest-persist-only mechanism, **no Editing_Stage action in this increment incurs provider spend**. The new gate id `edit-manifest-assembly` (added to `contracts/run-manifest.schema.js`'s `APPROVAL_GATE_ID` and the `APPROVAL_GATES` catalog) exists solely so the parent Agentic OS's Gate_Catalog can describe the Editing_Stage's zero-spend action for observability — it is never passed to `verifyGateToken`/`withApprovalGate`, and `runEditingHarness` never checks for its presence. Should a future increment add a genuinely spend-bearing edit action, it must reuse the existing `render-action` gate id per the absolute constraint against new spend-bearing gate ids.

**FOSS-first / TCO**: N/A — pure approval-catalog decision, $0 cost impact.

### ADR-VA-4: Token_Budget_Ceiling default value — 2000 tokens

**Status**: Accepted

**Decision**: default `Token_Budget_Ceiling = 2000` tokens per run when unconfigured. Rationale: the Director's default shot count is 4; a single narrative-reasoning `plan()` call producing 4 shot prompts typically consumes a few hundred to ~1500 tokens for a brief bounded at 5000 characters. 2000 tokens is tight enough that a verbose brief or a retried storyboard call can plausibly trigger `Narrative_Degraded_Mode` at least once in a demo session (making the degrade path observable), while loose enough that a single well-formed `plan()` call almost always completes without degrading (so the narrative-ability demo is not undermined by premature degradation).

**Alternatives considered**: 500 tokens (too tight — risks degrading on the very first call); 10000 tokens (too loose — would rarely trigger degradation in a short demo session). **FOSS-first / TCO**: N/A — a configuration default has no vendor/cost dimension beyond token spend already accounted through the existing Cost_Log.

## Quality Attribute Scenarios

| Attribute | Scenario | Response measure |
|---|---|---|
| Performance | Live BytePlus video-generation dispatch | Uses the existing 5s poll interval / 600s max duration — no second polling policy |
| Security | Render dispatch or spend-bearing edit action without a verified `render-action` token | Rejected per the existing fail-closed contract; zero spend, zero provider call |
| Security | The new `edit-manifest-assembly` gate id referenced by a spend-bearing path | Never — by construction (ADR-VA-3); enforced by Property 16 (design.md) |
| Token cost | A run configures a Token_Budget_Ceiling > 0 | Cumulative narrative-reasoning tokens never exceed the ceiling except vacuously; the first call is always issued |
| TCO | This increment ships | $0 monthly TCO delta beyond already-accounted BytePlus per-call spend; zero new dependency/datastore |

## Correctness Properties

The full quantified statement of all 21 correctness properties this companion's implementation must satisfy — including generators, edge cases, and requirement backlinks — lives in `.kiro/specs/knowgrph-video-agent/design.md` (Correctness Properties section) as the single canonical source (MECE). Titles and traceability only, reproduced here for PRD↔TAD navigation:

| # | Property title | Validates |
|---|---|---|
| 1 | Narrative_Coherence_Check correctness (including sub-two-shot edge case) | R1.1–1.4 |
| 2 | Shot_Prompt_Traceability is byte-identical | R2.1, 2.2, 2.5 |
| 3 | BytePlus_Video_Provider dispatch call correctness (submit/poll/persist) | R3.1, 8.1 |
| 4 | Unplanned-shot dispatch handling | R2.3, 2.4, 2.6 |
| 5 | Default BytePlus routing vs. explicit-override routing | R3.1, 3.2, 8.1, 8.3 |
| 6 | Live-configuration routing continuity across a run | R3.7–3.9, 8.4–8.6 |
| 7 | Render dispatch failure isolates prior assets and records ledger spend | R3.4 |
| 8 | Successful render dispatch produces exactly one asset and one ledger event | R3.5 |
| 9 | Edit_Manifest sequencing, most-recent-wins, and per-entry trim defaults | R4.1, 4.2, 4.5, 4.6 |
| 10 | Edit_Manifest trim validation rejects invalid entries | R4.3, 4.4 |
| 11 | Editing_Stage composition failure preserves prior artifacts | R4.7 |
| 12 | Fixed stage order is preserved | R4.8 |
| 13 | Token_Budget_Ceiling of zero/unconfigured behaves as no ceiling | R5.1, 5.6 |
| 14 | Token_Budget_Ceiling enforcement, degraded-mode entry, and never-exceed guarantee | R5.2–5.5 |
| 15 | Approval-token spend boundary for video-generation and Editing_Stage spend paths | R6.1–6.3, 6.6 |
| 16 | New zero-spend gate id is never referenced by a spend-bearing path and always carries zero cost | R6.4, 6.7 |
| 17 | Cost_Log field-domain validity for video-generation and edit spend events | R7.1 |
| 18 | Validation-gated Budget_Meters aggregation with continuation on failure | R7.2, 7.4, 7.5 |
| 19 | Credit_Ledger recording for every spend-bearing event | R7.3 |
| 20 | Shared retry-counter accounting across video-generation and Editing_Stage failures | R9.1–9.3 |
| 21 | Retry exhaustion fails closed and halts every downstream stage | R9.4, 9.5 |

## Deployment Strategy

The Video_Agent ships as an in-repo code change to `mcp/video-remix/run-video-remix.js`, `mcp/video-remix/director-live-run.js`, `mcp/video-remix/video-agent-execution.js`, `mcp/video-remix/live-clients.js`, and `mcp/video-remix/editing-harness.js`, plus additive-only enum extensions to `contracts/run-manifest.schema.js` — no separate deployment artifact or datastore. Local stdio availability requires only restarting the local MCP server process. Exposure through the Cloudflare `McpAgent`, WHERE deployed, follows the existing control-plane deploy path unchanged; this increment adds no new Worker route. Rollback is the existing worker/commit rollback path — the Video_Agent introduces no new state to roll back beyond the additive enum values, which are themselves backward-compatible (existing Run_Manifests without an `edit` stage remain valid).

## PRD ↔ TAD Traceability

| Traceability line |
|---|
| `PRD-VA-1 ↔ TAD-Narrative_Coherence_Check-checkNarrativeCoherence ↔ VCC "Property 1"` |
| `PRD-VA-2 ↔ TAD-Shot_Prompt_Traceability-adaptBytePlusVideoProviderToRenderClient ↔ VCC "Property 2, 4"` |
| `PRD-VA-3 ↔ TAD-live-clients.js-resolveStageClients ↔ VCC "Property 3, 5, 6"` |
| `PRD-VA-4 ↔ TAD-editing-harness.js-runEditingHarness ↔ VCC "Property 9, 10, 11, 12"` |
| `PRD-VA-5 ↔ TAD-run-video-remix.js-wrapChatClientWithTokenCeiling ↔ VCC "Property 13, 14"` |
| `PRD-VA-6 ↔ TAD-contracts/approval.schema.js-APPROVAL_GATE_ID ↔ VCC "Property 15, 16"` |
| `PRD-VA-7 ↔ TAD-cost-log.js-buildCostLogAccounting ↔ VCC "Property 17, 18, 19"` |
| `PRD-VA-8 ↔ TAD-ai-gateway-client.js-createAiGatewayClient ↔ VCC "Property 3, 6"` |
| `PRD-VA-9 ↔ TAD-retry.js-failure-handling.js ↔ VCC "Property 20, 21"` |
| `PRD-VA-10 ↔ TAD-Deployment_Strategy-dependency_manifest ↔ VCC "package manifests show zero added dependencies"` |

## Validation

Focused Dev checks (per requirements.md's Testing Strategy — see design.md for the full property-test/unit-test breakdown):

```bash
node --test contracts/__tests__/video-agent-contract-enums.test.mjs mcp/__tests__/video-agent-runtime.test.mjs mcp/__pbt__/video-agent.pbt.test.mjs mcp/__tests__/storyboard-harness.test.mjs
node --test mcp/__tests__/director-live-run.test.mjs mcp/__tests__/director-gates-live-async.test.mjs cloudflare/workers/knowgrph-mcp/__tests__/tool-registry.test.mjs
npm run hygiene:check
```

## Anti-Pattern Guards

| Guard | Applied |
|---|---|
| No second copy of Harness state | Editing_Stage persists only through the existing R2 bucket / Run_Manifest; no new datastore (ADR-VA-1) |
| No new spend/approval boundary | New gate id is catalog-only, never verified, never spend-bearing (ADR-VA-3; Property 16) |
| No unbounded loops | Shared retry counter, existing `maxIterations`/circuit-breaker, no new condition (Property 20, 21) |
| No fabricated token/cost figures | Token_Emission_Gap treated as full-remaining-budget consumption, never silently ignored (Property 14) |
| No new dependency without ADR | ADR-VA-1 explicitly rejects the FFmpeg alternatives and defers them as an ADR candidate rather than adding the dependency |
| No blended deployment-model TCO | ADR-VA-1 separates Managed/Serverless vs. Provisioned/Self-Managed for the rejected FFmpeg alternatives |
| No silent config-gap live call | Absent/incomplete BytePlus configuration routes every shot to the deterministic mock; never a partial live call (Property 6) |
| No duplication of the parent's Agentic OS content | This document references, rather than repeats, the parent's Os_Status_Tool, ADR-1–4, and Spend_Isolation_Boundary reaffirmation |

*Content synthesized from `.kiro/specs/knowgrph-video-agent/requirements.md` and `.kiro/specs/knowgrph-video-agent/design.md`, following [PRD & TAD Guidelines v1.4.0](https://huijoohwee.github.io/guidelines/prd-tad-guidelines.md) and parent v0.5.0. v0.2.0 records runtime-ready local implementation with the 21-property Video_Agent suite passing.*
