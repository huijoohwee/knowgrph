# Knowgrph DeerFlow Delivery and Validation

**Document Version**: 1.0.0  
**Date**: 2026-05-07  
**Status**: Proposed  
**Companion To**: `knowgrph-deerflow-prd-tad.md`, `knowgrph-deerflow-prd-tad-integration-contracts-and-patterns.md`

---

## Document Purpose

**Context**: DeerFlow integration requires coordinated delivery across settings, parser, runtime, and renderer surfaces.  
**Intent**: Define phased rollout, acceptance gates, and focused validation tied to canonical fixtures.  
**Directive**: Validation must prioritize focused diffs and contract coverage; avoid broad, unfocused full-suite runs.

---

## Delivery Strategy

## Phase 0: Readiness and Baselines

### Objectives
- Confirm baseline behavior for current providers and generation nodes.
- Freeze contract IDs and PRD traceability IDs before implementation.

### Deliverables
- Approved contract catalog and patterns.
- Baseline test report for impacted parser/runtime/integration tests.

### Exit Criteria
- Stakeholders agree on PRD scope, TAD contracts, and MoSCoW priorities.
- Baseline fixture snapshots stored for regression comparison.

---

## Phase 1: MainPanel Integrations Enablement

### Scope
- DeerFlow SSOT rows in Integrations mode.
- Anchor/deep-link support from Flow Manager and Node Overlay.
- Mode-gated direct/MCP settings validation.

### Stories
- PRD-E001-S001
- PRD-E001-S002

### Acceptance Gates
- DeerFlow rows are discoverable via MainPanel search.
- Deep links open correct section and row anchor.
- Invalid mixed-mode settings are blocked with explicit errors.

### Risks
- Anchor mismatch between row keys and editor links.
- Mode-specific required fields drifting across surfaces.

### Mitigations
- Generate anchors from canonical key builder.
- Validate row schema and mode rules in one shared module.

---

## Phase 2: Ingest->Parse->Graph Metadata

### Scope
- Parse DeerFlow metadata in frontmatter flow nodes.
- Normalize metadata into typed graph contract.
- Warning-first behavior for optional unsupported fields.

### Stories
- PRD-E002-S001

### Acceptance Gates
- Parser emits normalized metadata for text/image/video nodes.
- Unknown optional fields generate warnings, not crashes.
- Missing required-by-mode fields fail with actionable messages.

### Risks
- Field coercion ambiguity creating hidden runtime defects.
- Backward drift between parser output and dispatcher input schema.

### Mitigations
- Strict schema validation with deterministic coercion rules.
- Snapshot tests on parsed metadata payloads.

---

## Phase 3: Runtime Dispatch and Artifact Normalization

### Scope
- Unified generation dispatcher for text/image/video.
- DeerFlow direct and MCP adapters.
- Canonical artifact normalization and node state mapping.

### Stories
- PRD-E002-S002
- PRD-E003-S001
- PRD-E003-S002

### Acceptance Gates
- One dispatcher path handles all generation kinds.
- Node lifecycle states are monotonic and deterministic.
- Error categories drive retry behavior correctly.
- Renderer consumes canonical artifacts without provider-specific branches.

### Risks
- Adapter payload variance by mode or tool path.
- Retry storms under transport instability.

### Mitigations
- Adapter-level normalization tests with representative payloads.
- Bounded retries, jittered backoff, and explicit circuit limits.

---

## Phase 4: End-to-End Validation and Release

### Scope
- Fixture-driven full path validation from ingest to render.
- Regression gates for existing provider flows.
- Release checklist and rollback readiness.

### Stories
- PRD-E004-S001

### Acceptance Gates
- Canonical fixture passes all required assertions.
- No critical regression in existing generation providers.
- Release notes and migration guidance completed.

---

## Work Breakdown Structure (WBS)

| Workstream | Description | Primary Owner | Depends On |
|------------|-------------|---------------|------------|
| W1 | Integration SSOT and MainPanel wiring | Frontend | Phase 0 |
| W2 | Parser metadata normalization | Parsing | W1 |
| W3 | Dispatcher and adapter implementation | Runtime | W2 |
| W4 | Artifact normalization and renderer binding | Frontend Runtime | W3 |
| W5 | Test harness and fixture matrix | QA | W1-W4 |
| W6 | Observability and release controls | Platform | W3-W5 |

---

## Validation Scope

## Canonical Fixture
- `knowgrph-video-demo.md` (workspace seed basename; path-agnostic)

## Focused Test Domains
- MainPanel integration discoverability and anchor routing.
- Frontmatter parser normalization and warning behavior.
- Runtime dispatch for text/image/video in direct and MCP modes.
- Renderer artifact contract and fallback behavior.
- Error taxonomy mapping and retry paths.

## Non-Goals for Validation Cycle
- Unrelated panel modes not touching DeerFlow surfaces.
- Non-generation node execution behaviors outside mapped contracts.

---

## Test Matrix

| Test ID | Layer | Scenario | Input | Expected Result |
|---------|-------|----------|-------|-----------------|
| DFV-001 | Integrations UI | Search DeerFlow rows | "deerflow" query | DeerFlow section visible with expected row set |
| DFV-002 | Integrations UI | Deep-link anchor resolution | row key from node overlay | MainPanel opens exact anchor |
| DFV-003 | Parser | Direct mode metadata parse | frontmatter node with direct fields | normalized metadata emitted |
| DFV-004 | Parser | MCP mode metadata parse | frontmatter node with mcp fields | normalized metadata emitted |
| DFV-005 | Parser | Unknown optional fields | frontmatter with extras | warnings emitted, parse succeeds |
| DFV-006 | Parser | Missing required fields | invalid mode payload | parse fails with actionable message |
| DFV-007 | Runtime | Text generation dispatch | valid text request | text artifact contract returned |
| DFV-008 | Runtime | Image generation dispatch | valid image request | image artifact contract returned |
| DFV-009 | Runtime | Video generation dispatch | valid video request | video artifact contract returned |
| DFV-010 | Runtime | Timeout retry behavior | simulated timeout error | bounded retry then fail with retryable category |
| DFV-011 | Runtime | Auth failure behavior | invalid credentials | terminal auth error, no retry |
| DFV-012 | Renderer | Text artifact rendering | canonical text artifact | text block rendered |
| DFV-013 | Renderer | Image artifact rendering | canonical image artifact | image rendered with metadata |
| DFV-014 | Renderer | Video artifact rendering | canonical video artifact | video rendered with preview metadata |
| DFV-015 | E2E | Fixture ingest->render | `knowgrph-video-demo.md` | pipeline completes with expected outputs |
| DFV-016 | Regression | Existing provider stability | baseline provider fixture | no critical regression |

---

## Acceptance Criteria by PRD Story

| PRD Story | Acceptance Tests | Pass Condition |
|-----------|------------------|----------------|
| PRD-E001-S001 | DFV-001, DFV-002 | Discoverable DeerFlow rows and stable deep links |
| PRD-E001-S002 | DFV-003, DFV-004, DFV-006 | Valid mode enforcement and mode-correct persistence |
| PRD-E002-S001 | DFV-003, DFV-004, DFV-005, DFV-006 | Metadata normalization with warning-first policy |
| PRD-E002-S002 | DFV-007, DFV-008, DFV-009, DFV-012-014 | Canonical artifacts render consistently |
| PRD-E003-S001 | DFV-007-009, DFV-015 | Unified runtime path across generation kinds |
| PRD-E003-S002 | DFV-010, DFV-011 | Deterministic failure/retry semantics |
| PRD-E004-S001 | DFV-015, DFV-016 | End-to-end and regression gates pass |

---

## Quality Gate Definitions

## QG-1: Contract Gate
- All required contracts compile and validate.
- No unresolved contract mismatch between parser and dispatcher.

## QG-2: Functionality Gate
- Must-Have PRD stories pass mapped acceptance tests.
- No blocker defects in integration, parser, runtime, or renderer.

## QG-3: Reliability Gate
- Retry/failure paths verified for timeout and auth classes.
- No unbounded retries or silent fallbacks.

## QG-4: Regression Gate
- Existing provider fixtures remain green on focused regression suite.
- No P0/P1 regressions against baseline snapshots.

## QG-5: Release Gate
- Documentation updated and traceability matrix complete.
- Rollback instructions validated.

---

## Rollback and Recovery Plan

## Trigger Conditions
- Critical runtime failures in generation dispatch.
- Contract mismatch causing parser or renderer instability.
- High-severity regressions in existing provider paths.

## Rollback Actions
1. Disable DeerFlow feature flag for runtime dispatch.
2. Revert to prior provider routing for generation nodes.
3. Preserve parsed metadata but bypass DeerFlow adapter path.
4. Publish incident note and remediation ETA.

## Recovery Verification
- Focused smoke tests on MainPanel, parser, and existing generation flow.
- Confirm no residual invalid state in persisted integration settings.

---

## Release Checklist

- [ ] PRD/TAD traceability matrix updated.
- [ ] Integration contracts and patterns approved.
- [ ] Focused test matrix executed with recorded evidence.
- [ ] Fixture `knowgrph-video-demo.md` passes E2E expectations.
- [ ] Regression suite for existing providers passes.
- [ ] Feature flag strategy documented.
- [ ] Rollback runbook reviewed and accessible.
- [ ] Release notes include known limitations and open questions.

---

## Open Validation Questions

**VQ-001**: Should MCP-mode integration tests use a local mock MCP server or controlled staging endpoint?  
**Owner**: QA + Platform  
**Decision Target**: Before Phase 3 complete

**VQ-002**: What minimum sample size is required for run reliability target (`>=95%`) in CI?  
**Owner**: QA  
**Decision Target**: Before Phase 4 start

**VQ-003**: Should renderer snapshot assertions include metadata ordering guarantees or only key presence?  
**Owner**: Frontend + QA  
**Decision Target**: Before Phase 4 start

---

## Milestone Timeline

| Milestone | Scope | Target |
|-----------|-------|--------|
| M1 | Phase 1 complete | Sprint 1 |
| M2 | Phase 2 complete | Sprint 1 |
| M3 | Phase 3 complete | Sprint 2 |
| M4 | Phase 4 and release gate | Sprint 2 |

---

## Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-07 | joohwee | Initial delivery phases and validation matrix for DeerFlow integration |
