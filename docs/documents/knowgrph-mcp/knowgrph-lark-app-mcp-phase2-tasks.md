# Knowgrph Lark App MCP - Phase 2 Tasks

Execution plan for the next Phase 2 slice of [knowgrph-lark-app-mcp-prd-tad.md](knowgrph-lark-app-mcp-prd-tad.md) and [knowgrph-lark-app-mcp-prd-tad.companion.md](knowgrph-lark-app-mcp-prd-tad.companion.md).

**Document Version**: 0.1.0
**Date**: 2026-06-06
**Status**: Proposed execution plan
**Scope**: Phase 2 only - Canvas handoff and import ergonomics for Lark-driven workflows

---

## Goal

Ship the next Phase 2 Lark app slice that makes Canvas handoff explicit and operator-usable for Lark-driven review/import flows without introducing:

- a second Lark-specific runtime branch
- a direct Lark/webpage-to-graph shortcut
- browser-owned Lark or Base secrets
- a replacement for the deployed `https://airvio.co/knowgrph/mcp` endpoint
- a replacement for `knowgrph` Canvas as the canonical review/import surface
- a prod-only or Cloudflare-first implementation path

---

## Phase 2 Slice Definition Of Done

- [ ] A documented and implemented Canvas handoff contract exists for Lark-driven review/import flows
- [ ] The handoff reuses existing Canvas query/bootstrap or deep-link owners
- [ ] The `webpage` surface is treated as launch/configuration only and never as the MCP endpoint
- [ ] Base snapshot import still routes through the existing `window.knowgrphFeishuBaseSourceImportCommand.importSnapshot` seam
- [ ] No direct graph mutation code is introduced
- [ ] Focused tests pass for handoff parsing, launch behavior, and no-secret/no-bypass boundaries
- [ ] Dev remains the implementation SSOT; no downstream-only prod/cloud patch is required

---

## Proposed Files

### New Files

| File | Type | Purpose |
|---|---|---|
| `canvas/src/features/canvas/larkAppCanvasHandoff.ts` | new | Shared parser/builder for Lark-to-Canvas handoff payloads and query-state rules |
| `canvas/src/__tests__/larkAppCanvasHandoff.test.ts` | new | Focused contract tests for parsing/building the Phase 2 handoff payload |
| `canvas/src/__tests__/canvasLarkAppHandoffRuntime.test.tsx` | new | Focused runtime tests for query/bootstrap behavior and non-bypass guarantees |

### Existing Files To Update

| File | Why It Changes |
|---|---|
| `canvas/src/lib/routing/queryParams.ts` | Add explicit query-param SSOT only if the Phase 2 handoff needs new stable param names |
| `canvas/src/features/canvas/CanvasQueryBootstrapRuntime.tsx` | Route Lark handoff payloads through the existing query/bootstrap runtime instead of inventing a parallel launcher |
| `canvas/src/features/canvas/canvasQueryBootstrapSearch.ts` | Add small search helpers if the Lark handoff path needs shared query detection |
| `canvas/src/App.tsx` | Update only if a new thin runtime install is truly required; prefer not to change if query/bootstrap is sufficient |
| `canvas/src/features/panels/views/larkAppMcpApiDocs.ts` | Add Phase 2 handoff guidance, query examples, or launch copy after the contract is real |
| `canvas/src/__tests__/helpers/mainPanelMcpExpectations.ts` | Extend expectations if MainPanel copy gains Phase 2 handoff rows |
| `docs/documents/knowgrph-mcp/knowgrph-lark-app-mcp-prd-tad.md` | Reconcile only if the implemented handoff owners differ from the current Phase 2 plan |
| `docs/documents/knowgrph-mcp/knowgrph-lark-app-mcp-prd-tad.companion.md` | Mark completed Phase 2 checklist items and actual owner files |

### Existing Files To Reuse Without Changing First

| File | Why It Matters |
|---|---|
| `canvas/src/features/canvas/CanvasQueryBootstrapRuntime.tsx` | Existing query/bootstrap entrypoint for operator-visible launch behavior |
| `canvas/src/features/canvas/CanvasDocDeepLinkRuntime.tsx` | Existing deep-link runtime pattern for safe document-oriented handoff behavior |
| `canvas/src/lib/routing/queryParams.ts` | Existing query-param SSOT |
| `canvas/src/features/source-files/feishuBaseSourceImportCommand.ts` | Existing Canvas runtime import seam for Base snapshots |
| `canvas/src/App.tsx` | Confirms the Base import command is already installed during app startup |
| `canvas/src/__tests__/canvasDocDeepLinkRuntimeRegression.test.ts` | Best existing regression pattern for deep-link and non-bypass behavior |
| `canvas/src/__tests__/mainPanelOpenEmitterContract.test.ts` | Best existing regression pattern for launch/handoff event consistency |

---

## Task Breakdown

### Task 1 - Define The Lark App To Canvas Handoff Contract

- [ ] Create `canvas/src/features/canvas/larkAppCanvasHandoff.ts`
- [ ] Define a typed handoff payload that is explicit about intent
- [ ] Keep the contract Phase 2 only: review/import launch semantics, not remote mutation
- [ ] Prefer a small parser/builder owner rather than spreading query parsing across runtime files
- [ ] Fail closed on malformed or incomplete payloads

#### Proposed Contract Fields

- [ ] `source`
- [ ] `surface`
- [ ] `intent`
- [ ] `openMainPanelTab`
- [ ] `openEditorWorkspace`
- [ ] `openCanvas`
- [ ] `importAction`
- [ ] `fileId`
- [ ] `snapshot`
- [ ] `returnUrl`

#### Required Rules

- [ ] The contract must distinguish `review`, `import`, and `read-only` intent
- [ ] The contract must not encode secrets
- [ ] The contract must not imply remote mutation
- [ ] The contract must support `webpage` as a launch/configuration source only

### Task 2 - Define Stable Query Or Launch Parameters

- [ ] Update `canvas/src/lib/routing/queryParams.ts` only if new stable params are needed
- [ ] Reuse existing `openMainPanel` and `openEditorWorkspace` params where possible
- [ ] Add only narrowly scoped Lark handoff params
- [ ] Keep parameter names explicit and phase-accurate
- [ ] Avoid a generic catch-all param that becomes a second command transport

#### Proposed Query Params

- [ ] `kgLarkHandoff`
- [ ] `kgLarkSurface`
- [ ] `kgLarkIntent`

#### Notes

- Prefer one encoded handoff payload plus existing stable params over many loosely related flags.
- Do not reuse `kgWorkspaceCommand` for Lark import unless the same trust and environment rules still hold.

### Task 3 - Route The Handoff Through The Existing Canvas Bootstrap Runtime

- [ ] Update `canvas/src/features/canvas/CanvasQueryBootstrapRuntime.tsx`
- [ ] Parse the Lark handoff through the new shared helper
- [ ] Open MainPanel or editor workspace only through existing bootstrap paths
- [ ] Keep URL cleanup behavior consistent with existing query bootstrap behavior
- [ ] Keep failure states explicit and reversible

#### Minimum Expected Behaviors

- [ ] `review` intent can open the right Canvas/MainPanel context without mutating graph state
- [ ] `import` intent can stage a valid import request for the existing Base import seam
- [ ] malformed handoff payloads fail closed and surface a readable error path
- [ ] consumed handoff params are removed from the URL after processing

### Task 4 - Reuse The Existing Base Import Seam

- [ ] Wire `import` intent to `window.knowgrphFeishuBaseSourceImportCommand.importSnapshot` or the equivalent existing event bridge
- [ ] Confirm the handoff never bypasses `sourceFilesIngestIntegration.ts`
- [ ] Confirm the handoff never bypasses `feishuBaseSourceAdapter.ts`
- [ ] Confirm the handoff never writes directly to graph state
- [ ] Keep the import path operator-visible and testable

#### Required Content Rules

- [ ] Import is allowed only when the payload includes a valid non-secret snapshot shape
- [ ] Import failures stay explicit and do not mutate graph state
- [ ] The handoff must never accept privileged tokens as part of the payload
- [ ] The runtime must remain safe if opened from the Lark `webpage` surface

### Task 5 - Document The `webpage` Handoff Track

- [ ] Update `canvas/src/features/panels/views/larkAppMcpApiDocs.ts` only after the handoff contract is real
- [ ] Add operator copy that explains how the `webpage` surface may launch or hand off into Canvas
- [ ] Keep the copy explicit that `https://open.larksuite.com/app/cli_a7ddaa5aeff89010/webpage` is not the deployed MCP endpoint
- [ ] Keep the copy explicit that `webpage` is not a graph runtime or a write-capable bridge
- [ ] Keep the copy explicit that Canvas remains the canonical review/import/visualization surface

#### Minimum Expected Rows Or Guidance

- [ ] `handoff.intent`
- [ ] `handoff.query_contract`
- [ ] `webpage.surface_role`
- [ ] `canvas.review_boundary`
- [ ] `import.command`
- [ ] `troubleshooting`

### Task 6 - Add Focused Handoff Contract Tests

- [ ] Create `canvas/src/__tests__/larkAppCanvasHandoff.test.ts`
- [ ] Test valid payload parsing
- [ ] Test malformed payload rejection
- [ ] Test that secrets or unsupported fields are rejected or ignored
- [ ] Test that `webpage` is accepted only as a declared launch surface, not as an MCP endpoint

#### Minimum Test Functions

- [ ] `testLarkAppCanvasHandoffParsesReviewIntent`
- [ ] `testLarkAppCanvasHandoffParsesImportIntent`
- [ ] `testLarkAppCanvasHandoffRejectsMalformedPayload`
- [ ] `testLarkAppCanvasHandoffDoesNotAcceptSecretMaterial`

### Task 7 - Add Focused Runtime And No-Bypass Tests

- [ ] Create `canvas/src/__tests__/canvasLarkAppHandoffRuntime.test.tsx`
- [ ] Mirror the style of existing query/bootstrap or deep-link regression tests
- [ ] Verify the handoff routes through `CanvasQueryBootstrapRuntime.tsx`
- [ ] Verify MainPanel/editor launch behavior uses existing owners
- [ ] Verify import behavior still routes through the existing import seam
- [ ] Verify there is no direct graph mutation shortcut

#### Minimum Runtime Assertions

- [ ] Handoff runtime reads from the live URL search rather than stale one-shot props
- [ ] Handoff runtime consumes and cleans up handled query params
- [ ] Handoff runtime does not call graph-apply owners directly
- [ ] Handoff runtime does not embed remote mutation logic
- [ ] Handoff runtime does not treat `webpage` as the MCP endpoint

### Task 8 - Extend MainPanel Expectations Only If Phase 2 Copy Lands

- [ ] Update `canvas/src/__tests__/helpers/mainPanelMcpExpectations.ts` only if MainPanel guidance changes
- [ ] Add reusable assertions for Phase 2 handoff wording
- [ ] Assert the presence of Canvas handoff language
- [ ] Assert the absence of write-capable remote bridge claims
- [ ] Keep the helper focused and avoid unrelated MCP refactors

### Task 9 - Reconcile Docs After Code Lands

- [ ] Re-read `knowgrph-lark-app-mcp-prd-tad.md`
- [ ] Re-read `knowgrph-lark-app-mcp-prd-tad.companion.md`
- [ ] Update proposed owner names only if the implementation differs materially from the current plan
- [ ] Keep doc changes minimal and implementation-accurate
- [ ] Add the Phase 2 task file to docs lint coverage if needed

---

## Test Targets

### Primary Focused Tests

| Target | Reason |
|---|---|
| `canvas/src/__tests__/larkAppCanvasHandoff.test.ts` | Primary Phase 2 handoff contract test |
| `canvas/src/__tests__/canvasLarkAppHandoffRuntime.test.tsx` | Primary Phase 2 runtime/no-bypass test |

### Secondary Focused Tests

| Target | Reason |
|---|---|
| `canvas/src/__tests__/canvasDocDeepLinkRuntimeRegression.test.ts` | Protects deep-link and non-bypass patterns reused by the handoff path |
| `canvas/src/__tests__/mainPanelOpenEmitterContract.test.ts` | Protects launch/open-panel behavior if MainPanel handoff stays event-driven |
| `canvas/src/__tests__/mainPanelMcpLarkApp.test.tsx` | Protects MainPanel docs surface if Phase 2 guidance rows are added |
| `canvas/src/__tests__/feishuBaseSourceImportCommand.test.ts` | Protects the existing import seam used by Phase 2 import intent |

### Commands To Run

```bash
npx tsx --eval "(async () => { const m = await import('./src/__tests__/larkAppCanvasHandoff.test.ts'); m.testLarkAppCanvasHandoffParsesReviewIntent(); m.testLarkAppCanvasHandoffParsesImportIntent(); m.testLarkAppCanvasHandoffRejectsMalformedPayload(); m.testLarkAppCanvasHandoffDoesNotAcceptSecretMaterial(); })().catch(err => { console.error(err); process.exit(1); });"
```

```bash
npx tsx --eval "(async () => { const m = await import('./src/__tests__/canvasLarkAppHandoffRuntime.test.tsx'); await m.testCanvasQueryBootstrapHandlesLarkReviewHandoff(); await m.testCanvasQueryBootstrapHandlesLarkImportHandoffWithoutGraphBypass(); m.testCanvasQueryBootstrapDoesNotTreatWebpageAsMcpEndpoint(); })().catch(err => { console.error(err); process.exit(1); });"
```

```bash
npx tsx --eval "(async () => { const m = await import('./src/__tests__/canvasDocDeepLinkRuntimeRegression.test.ts'); m.testCanvasDocDeepLinkSelectsDocumentBeforePassiveGraphApply(); })().catch(err => { console.error(err); process.exit(1); });"
```

```bash
npx tsx --eval "(async () => { const m = await import('./src/__tests__/mainPanelOpenEmitterContract.test.ts'); await m.testEmitMainPanelOpenDispatchesSharedEvent(); m.testMainPanelOpenCallsitesUseSharedEmitter(); })().catch(err => { console.error(err); process.exit(1); });"
```

```bash
npx tsx --eval "(async () => { const m = await import('./src/__tests__/feishuBaseSourceImportCommand.test.ts'); m.testFeishuBaseSourceImportCommandInstallsStableWindowCommand(); await m.testFeishuBaseSourceImportCommandImportsSnapshotThroughWindowCommand(); await m.testFeishuBaseSourceImportCommandEventBridgePublishesResult(); m.testAppInstallsFeishuBaseSourceImportCommand(); })().catch(err => { console.error(err); process.exit(1); });"
```

```bash
git diff --check -- docs/documents/knowgrph-mcp/knowgrph-lark-app-mcp-prd-tad.md docs/documents/knowgrph-mcp/knowgrph-lark-app-mcp-prd-tad.companion.md docs/documents/knowgrph-mcp/knowgrph-lark-app-mcp-phase2-tasks.md
```

---

## Execution Order

### Step 1 - Contract First

- [ ] Create `larkAppCanvasHandoff.ts`
- [ ] Define payload shape, parser, and builder rules
- [ ] Add narrow query-param SSOT only if needed

### Step 2 - Runtime Wiring Second

- [ ] Update `CanvasQueryBootstrapRuntime.tsx`
- [ ] Reuse existing launch/open-panel paths
- [ ] Reuse the existing Base import seam for import intent

### Step 3 - Focused Tests Third

- [ ] Add `larkAppCanvasHandoff.test.ts`
- [ ] Add `canvasLarkAppHandoffRuntime.test.tsx`
- [ ] Run nearby regression tests for deep links, open-panel events, and Base import

### Step 4 - Docs Reconciliation Last

- [ ] Reconcile PRD/TAD and companion wording against actual landed owner files
- [ ] Add Phase 2 MainPanel copy only if the handoff contract is implemented
- [ ] Run focused validation and doc hygiene checks

---

## Non-Goals

- [ ] No new remote write-capable MCP tool
- [ ] No authenticated remote mutation bridge
- [ ] No Lark-specific Cloudflare route as the primary implementation step
- [ ] No direct Lark or webpage payload -> graph apply shortcut
- [ ] No browser-owned Lark or Base secrets
- [ ] No replacement for `https://airvio.co/knowgrph/mcp`
- [ ] No replacement for `knowgrph` Canvas as the canonical review/import surface

---

## Exit Checklist

- [ ] New file owners exist and compile
- [ ] Handoff parsing is owned in one place
- [ ] Existing query/bootstrap or deep-link owners are reused intentionally
- [ ] The `webpage` surface is treated as launch/configuration only
- [ ] Import still routes through the existing Base import seam
- [ ] No direct graph or publish behavior is introduced
- [ ] Focused tests pass
- [ ] Docs remain aligned with landed code

---

*Document Version: 0.1.0 · Updated: 2026-06-06*
