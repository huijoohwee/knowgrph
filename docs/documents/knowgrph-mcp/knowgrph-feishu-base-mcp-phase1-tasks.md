# Knowgrph Feishu Base MCP - Phase 1 Tasks

Execution plan for Phase 1 of [knowgrph-feishu-base-mcp-prd-tad.md](knowgrph-feishu-base-mcp-prd-tad.md) and [knowgrph-feishu-base-mcp-prd-tad.companion.md](knowgrph-feishu-base-mcp-prd-tad.companion.md).

**Document Version**: 0.1.0
**Date**: 2026-06-06
**Status**: Proposed execution plan
**Scope**: Phase 1 only - external MCP configuration surface

---

## Goal

Ship a Phase 1 Feishu Base integration that makes Feishu Base discoverable inside the existing MainPanel MCP/settings surface without introducing:

- a new runtime branch
- a Base-to-graph shortcut
- browser-owned Base secrets
- a prod-only or Cloudflare-first implementation path

---

## Phase 1 Definition Of Done

- [ ] Feishu Base appears as a first-class MCP/configuration surface in MainPanel MCP
- [ ] Shared metadata is defined once and reused by docs rows, settings rows, and tests
- [ ] Operator copy explains that auth is owned by the MCP host or server, not browser settings
- [ ] No Base adapter or write-back logic ships in this phase
- [ ] Focused tests pass for rendering, metadata reuse, and no-secret boundaries
- [ ] Dev remains the implementation SSOT; no downstream-only prod/cloud patch is required

---

## Proposed Files

### New Files

| File | Type | Purpose |
|---|---|---|
| `canvas/src/features/settings/registry-feishu-base-mcp.ts` | new | Feishu Base non-secret settings metadata for the existing settings registry |
| `canvas/src/features/panels/views/feishuBaseMcpApiDocs.ts` | new | Feishu Base MainPanel MCP docs rows, anchors, and config/render helpers |
| `canvas/src/__tests__/mainPanelMcpFeishuBase.test.tsx` | new | Focused rendered MainPanel MCP and config-builder contract tests |

### Existing Files To Update

| File | Why It Changes |
|---|---|
| `canvas/src/features/settings/registry.ts` | Register the new Feishu Base settings block |
| `canvas/src/features/panels/views/settingsMcpDocEntries.ts` | Include Feishu Base virtual MCP doc entries and config mapping |
| `canvas/src/features/panels/views/settingsView.constants.ts` | Add `MCP_SECTION_META` entry for Feishu Base docs link and panel action |
| `canvas/src/__tests__/helpers/mainPanelMcpExpectations.ts` | Add reusable assertion helper for Feishu Base rendered content |
| `canvas/src/__tests__/mainPanelKtvRowsConsistency.test.ts` | Keep doc-entry and settings-registry wiring consistent if this test asserts new owner coverage |
| `canvas/src/__tests__/providerPrdTadDocs.test.ts` | Add Feishu Base doc/owner coverage if provider-level doc consistency is enforced here |
| `docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.md` | Update only if implementation-specific owner names need to move from proposed to implementation-accurate |
| `docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.companion.md` | Update only if owner names or exit criteria need to become implementation-accurate |

### Existing Files To Reuse Without Changing First

| File | Why It Matters |
|---|---|
| `canvas/src/features/panels/views/McpHubView.tsx` | Confirms MainPanel MCP already exists as the intended surface |
| `canvas/src/features/panels/views/SettingsView.tsx` | Confirms Phase 1 should reuse the existing settings/doc composition path |
| `canvas/src/features/settings/registry-openai-mcp.ts` | Concrete pattern for MCP-specific settings registry design |
| `canvas/src/features/panels/views/exaMcpApiDocs.ts` | Best Phase 1 reference pattern for docs rows and config builders |
| `canvas/src/__tests__/mainPanelMcpExa.test.tsx` | Best focused test pattern to mirror for Feishu Base |

---

## Task Breakdown

### Task 1 - Define Feishu Base SSOT Metadata

- [ ] Create `registry-feishu-base-mcp.ts`
- [ ] Define only non-secret settings keys
- [ ] Keep names, labels, defaults, and descriptions aligned with Phase 1 semantics
- [ ] Avoid any key that stores app secrets, Base tokens, or privileged credentials
- [ ] Keep the file narrowly scoped to Phase 1 metadata only

#### Proposed Settings Keys

- [ ] `search.feishuBase.mcp.serverKey`
- [ ] `search.feishuBase.mcp.remoteUrl`
- [ ] `search.feishuBase.mcp.connectionMode`
- [ ] `search.feishuBase.mcp.authBoundary`
- [ ] `search.feishuBase.mcp.docsUrl`
- [ ] `search.feishuBase.mcp.phase`
- [ ] `search.feishuBase.mcp.phase2Status`
- [ ] `search.feishuBase.mcp.phase3Status`

#### Notes

- Use names that clearly communicate Phase 1 status.
- Do not imply Phase 2 source-adapter support is already implemented.
- Do not imply Phase 3 publish/write-back support is already implemented.

### Task 2 - Register Feishu Base In The Shared Settings Registry

- [ ] Update `canvas/src/features/settings/registry.ts`
- [ ] Import `registry-feishu-base-mcp.ts`
- [ ] Append the new registry block in the same style as existing MCP/provider registries
- [ ] Confirm no unrelated settings area is modified

### Task 3 - Build Feishu Base MainPanel MCP Doc Entries

- [ ] Create `canvas/src/features/panels/views/feishuBaseMcpApiDocs.ts`
- [ ] Define a canonical doc area label
- [ ] Define virtual settings/doc entries for Feishu Base
- [ ] Define row anchor helpers in the same style as Exa/Stripe MCP docs
- [ ] Add config-display helpers only if they are useful in Phase 1 and remain non-secret

#### Minimum Expected Rows

- [ ] `server_key`
- [ ] `remote.url`
- [ ] `connection.mode`
- [ ] `auth_boundary`
- [ ] `phase`
- [ ] `phase_2_status`
- [ ] `phase_3_status`
- [ ] `docs_link`
- [ ] `operator_guidance`
- [ ] `phase_scope`
- [ ] `troubleshooting`

#### Required Content Rules

- [ ] Explain that auth is host/server owned
- [ ] Explain that Phase 1 is configuration-only
- [ ] Explain that Phase 2 and Phase 3 are not shipped by this task
- [ ] Avoid secret examples and browser BYOK patterns
- [ ] Avoid any copy that claims direct Base-to-graph support

### Task 4 - Wire Feishu Base Into MCP Doc Entry Aggregation

- [ ] Update `canvas/src/features/panels/views/settingsMcpDocEntries.ts`
- [ ] Import Feishu Base doc entries
- [ ] Add them into `buildMcpDocEntries()`
- [ ] Add Feishu Base anchor routing into `buildMcpVirtualEntry()`
- [ ] Add Feishu Base config text mapping only if Phase 1 includes a non-secret config block
- [ ] Keep the aggregation order intentional and stable

### Task 5 - Add MainPanel Section Metadata

- [ ] Update `canvas/src/features/panels/views/settingsView.constants.ts`
- [ ] Add `MCP_SECTION_META` entry for the Feishu Base doc area
- [ ] Provide a docs link
- [ ] Provide a panel action label consistent with other MCP integrations
- [ ] Ensure labels do not imply shipped Phase 2 or Phase 3 behavior

### Task 6 - Add Focused Render And Config Tests

- [ ] Create `canvas/src/__tests__/mainPanelMcpFeishuBase.test.tsx`
- [ ] Mirror the structure of `mainPanelMcpExa.test.tsx`
- [ ] Add a rendered MainPanel MCP surface test
- [ ] Add a non-secret config text test if a config block is rendered
- [ ] Add a no-unsupported-claims test for Phase 2 or Phase 3 behavior
- [ ] Add a no-browser-secret-material test

#### Minimum Test Functions

- [ ] `testMcpHubSurfacesFeishuBaseMcpConfig`
- [ ] `testFeishuBaseMcpDefaultGeneratedConfigIsNonSecret`
- [ ] `testFeishuBaseMcpSurfaceDoesNotClaimPhase2OrPhase3Implementation`

### Task 7 - Extend Shared Test Helpers

- [ ] Update `canvas/src/__tests__/helpers/mainPanelMcpExpectations.ts`
- [ ] Add `assertMcpHubSurfacesFeishuBaseMcpConfig(container)`
- [ ] Assert the presence of:
  - [ ] Feishu Base section title
  - [ ] stable keys and row names
  - [ ] docs link
  - [ ] auth-boundary wording
  - [ ] phase labels
- [ ] Assert the absence of:
  - [ ] raw secret examples
  - [ ] direct graph mutation language
  - [ ] claims that Phase 2 or Phase 3 are already shipped

### Task 8 - Keep Doc And Registry Consistency Tests Aligned

- [ ] Update `canvas/src/__tests__/mainPanelKtvRowsConsistency.test.ts` only if the new Feishu Base owner must be referenced there
- [ ] Update `canvas/src/__tests__/providerPrdTadDocs.test.ts` if Feishu Base should join provider-level doc-owner consistency coverage
- [ ] Keep these changes focused and avoid broad unrelated refactors

### Task 9 - Reconcile Docs After Code Lands

- [ ] Re-read `knowgrph-feishu-base-mcp-prd-tad.md`
- [ ] Re-read `knowgrph-feishu-base-mcp-prd-tad.companion.md`
- [ ] Update proposed owner names only if the implementation differs materially from the current plan
- [ ] Keep doc changes minimal and implementation-accurate

---

## Test Targets

### Primary Focused Tests

| Target | Reason |
|---|---|
| `canvas/src/__tests__/mainPanelMcpFeishuBase.test.tsx` | Primary Phase 1 render and config contract test |
| `canvas/src/__tests__/helpers/mainPanelMcpExpectations.ts` | Shared assertion owner for rendered Feishu Base MCP surface |

### Secondary Focused Tests

| Target | Reason |
|---|---|
| `canvas/src/__tests__/mainPanelKtvRowsConsistency.test.ts` | Protects settings/doc-entry consistency patterns if Feishu Base is folded into existing owner checks |
| `canvas/src/__tests__/providerPrdTadDocs.test.ts` | Protects doc-to-owner consistency if Feishu Base is added to the provider contract matrix |

### Commands To Run

```bash
npm --prefix canvas test -- mainPanelMcpFeishuBase
```

```bash
npm --prefix canvas test -- mainPanelKtvRowsConsistency
```

```bash
npm --prefix canvas test -- providerPrdTadDocs
```

```bash
npm --prefix canvas run doc:lint -- docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.md docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.companion.md docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-phase1-tasks.md
```

### Optional Safety Checks

```bash
git diff --check -- docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.md docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-prd-tad.companion.md docs/documents/knowgrph-mcp/knowgrph-feishu-base-mcp-phase1-tasks.md
```

---

## Execution Order

### Step 1 - Metadata First

- [ ] Create `registry-feishu-base-mcp.ts`
- [ ] Wire it into `registry.ts`

### Step 2 - Docs Surface Second

- [ ] Create `feishuBaseMcpApiDocs.ts`
- [ ] Add doc entry aggregation in `settingsMcpDocEntries.ts`
- [ ] Add section metadata in `settingsView.constants.ts`

### Step 3 - Focused Tests Third

- [ ] Add `mainPanelMcpFeishuBase.test.tsx`
- [ ] Extend `mainPanelMcpExpectations.ts`
- [ ] Update consistency/doc-owner tests only if needed

### Step 4 - Docs Reconciliation Last

- [ ] Reconcile PRD/TAD and companion wording against the actual landed owner files
- [ ] Run focused tests and doc lint

---

## Non-Goals

- [ ] No Phase 2 source adapter
- [ ] No Phase 3 publish target
- [ ] No Base record fetch pipeline
- [ ] No chat/workspace/canvas behavior changes
- [ ] No Cloudflare route changes as the primary implementation step
- [ ] No prod mirror edits as the primary implementation step

---

## Exit Checklist

- [ ] New file owners exist and compile
- [ ] Existing aggregators include Feishu Base exactly once
- [ ] MainPanel MCP surfaces Feishu Base with Phase 1-accurate wording
- [ ] Secret boundaries are preserved
- [ ] No direct graph or publish behavior is introduced
- [ ] Focused tests pass
- [ ] Docs remain aligned with landed code

---

*Document Version: 0.1.0 · Updated: 2026-06-06*
