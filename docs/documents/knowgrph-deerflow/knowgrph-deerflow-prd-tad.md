# Knowgrph DeerFlow Integration - PRD & TAD

**Document Version**: 1.1.0  
**Date**: 2026-05-07  
**Status**: Proposed  
**Scope**: MainPanel Integrations, Ingest->Parse->Render, Canvas 2D Flow Editor generation

---

## Document Purpose

**Context**: Knowgrph requires a provider-neutral way to add DeerFlow capabilities into integrations, parsing, and flow execution.  
**Intent**: Enable text, image, and video generation workflows in Canvas 2D with consistent UX, contracts, and validation.  
**Directive**: This document defines product requirements and architecture contracts; PRD states WHAT/WHY, TAD states HOW; implementation details remain in code tasks.

---

# PART I: PRODUCT REQUIREMENTS DOCUMENTATION (PRD)

## Problem Statement

### Current User Pain Points

**Problem 1: Integration Fragmentation**  
MainPanel Integrations do not expose DeerFlow as a first-class provider, forcing manual external setup and reducing discoverability.

**Problem 2: Pipeline Inconsistency**  
Ingest->Parse->Render can parse flow documents, but provider-specific metadata for DeerFlow is not standardized across generation nodes.

**Problem 3: Incomplete Generation Surface in Canvas 2D**  
Flow Editor users need consistent text/image/video generation in one run pipeline, but provider routing and artifacts are not unified for DeerFlow.

### Quantified Impact

- Integration onboarding time is high due to manual provider wiring and missing in-app setup guidance.
- Validation confidence is low because the same scenario is not verified end-to-end for ingest, parse, run, and render.
- Media-generation workflows risk drift when each node type uses custom provider logic instead of shared contracts.

---

## Personas

### Persona 1: Workflow Builder
**Role**: Analyst building multi-step knowledge workflows in Canvas  
**Goal**: Configure providers once and run generation nodes reliably  
**Pain Point**: Repeated setup and inconsistent node behavior

### Persona 2: Product Integrator
**Role**: Developer integrating external agent/runtime providers  
**Goal**: Add provider support with SSOT and minimal duplication  
**Pain Point**: Multiple configuration surfaces and missing traceability

### Persona 3: QA Engineer
**Role**: Reviewer validating pipeline correctness  
**Goal**: Verify ingest->parse->render with stable fixtures  
**Pain Point**: No single canonical fixture-driven acceptance suite for DeerFlow

---

## User Journey Flows

### Journey: Workflow Builder — Configure and Run DeerFlow Provider

| Stage    | Action               | Touchpoint        | Pain Point      | Opportunity      |
|----------|----------------------|-------------------|-----------------|------------------|
| Trigger  | Needs text/image/video generation in Canvas flow | Flow Editor toolbar | No DeerFlow option in provider dropdown | Add DeerFlow as first-class provider |
| Discover  | Opens MainPanel Integrations | Integrations tab | DeerFlow not listed; must configure externally | Show DeerFlow section with searchable rows |
| Engage   | Configures endpoint, auth, mode | Integration settings | Unclear which fields are required per mode | Mode-gated validation with progressive disclosure |
| Complete | Runs flow with DeerFlow-backed nodes | Canvas 2D renderer | Artifacts render inconsistently across providers | Canonical artifact schema for all providers |
| Return   | Adjusts prompt or retries failed node | Node overlay + retry button | No retry semantics; must rebuild graph | Typed error categories with one-click retry |

### Journey: Product Integrator — Add DeerFlow Provider Support

| Stage    | Action               | Touchpoint        | Pain Point      | Opportunity      |
|----------|----------------------|-------------------|-----------------|------------------|
| Trigger  | New provider integration requested | GitHub issue / planning | No integration template or contract guide | SSOT-first integration pattern with contract catalog |
| Discover  | Reviews existing integration code | Codebase search | Multiple config surfaces with no single source | One SSOT module consumed by all surfaces |
| Engage   | Implements adapter and parser extension | Adapter + parser modules | Protocol quirks leak into UI and dispatcher | Adapter isolation pattern with canonical normalization |
| Complete  | Validates with fixture test suite | CI pipeline | No canonical fixture for DeerFlow | `knowgrph-video-demo.md` fixture with focused test matrix |
| Return   | Adds new generation mode or skill | Adapter layer only | Requires UI changes for each new mode | Add modes via adapter, not UI forks |

### Journey: QA Engineer — Validate Pipeline Correctness

| Stage    | Action               | Touchpoint        | Pain Point      | Opportunity      |
|----------|----------------------|-------------------|-----------------|------------------|
| Trigger  | New DeerFlow feature merged | PR review | No focused test scope; full-suite runs are slow | Focused diff testing with contract coverage |
| Discover  | Reviews PRD acceptance criteria | PRD document | Criteria not mapped to test IDs | Traceability matrix linking stories to test IDs |
| Engage   | Runs fixture-driven test matrix | CI pipeline | Missing end-to-end coverage for ingest->render | Canonical fixture with per-layer assertions |
| Complete  | All gates pass with evidence | Quality gate dashboard | No gate definitions or rollback plan | Quality gate definitions with rollback runbook |
| Return   | Monitors regression suite on subsequent changes | CI | No baseline snapshots for comparison | Baseline fixture snapshots for regression detection |

---

## Workflow Flows

### Workflow: Configure DeerFlow Provider

**Trigger**: User opens MainPanel Integrations and selects DeerFlow section  
**Actors**: Workflow Builder, MainPanel Settings, Integration SSOT

**Happy Path**:
1. User opens Integrations mode → MainPanel displays provider sections
2. User selects DeerFlow → SSOT rows render with mode selector
3. User chooses mode (direct/MCP) → mode-gated fields appear
4. User fills required fields → validation passes on save
5. System persists config → provider ready for flow nodes

**Alternate Paths**:
- User switches mode after partial input: previously entered fields are preserved if applicable to new mode; incompatible fields are cleared with notice
- User provides invalid endpoint: validation blocks save with explicit error message

**Error Paths**:
- Network unreachable during validation: save succeeds with deferred validation status; runtime validates on first use
- Credential format invalid: immediate validation error with format hint

**Postconditions**: DeerFlow provider config persisted with stable keys; all integration surfaces reflect updated config

### Workflow: Ingest and Parse DeerFlow Flow

**Trigger**: User imports or opens a markdown flow file containing DeerFlow generation nodes  
**Actors**: Workflow Builder, Parser, Provider Metadata Normalizer

**Happy Path**:
1. User opens flow markdown → parser reads frontmatter
2. Parser encounters DeerFlow provider metadata → normalizer maps to canonical schema
3. Normalizer emits typed `ParsedProviderMetadata` → graph compiler consumes
4. Graph builds successfully → generation nodes carry provider intent

**Alternate Paths**:
- Flow contains unknown optional DeerFlow fields: normalizer emits warnings, parse succeeds
- Flow contains no provider metadata: nodes default to existing provider behavior

**Error Paths**:
- Missing required-by-mode fields: parse fails with actionable message identifying missing field and mode
- Invalid field type coercion: parse fails with type mismatch error

**Postconditions**: Graph contains typed provider metadata; no secret values in graph snapshot

### Workflow: Run Generation and Render Artifacts

**Trigger**: User clicks Run on a flow containing DeerFlow-backed generation nodes  
**Actors**: Workflow Builder, Generation Dispatcher, DeerFlow Adapter, Artifact Normalizer, Canvas 2D Renderer

**Happy Path**:
1. Dispatcher receives generation request → selects adapter by provider+mode
2. Adapter calls DeerFlow API or MCP tool → receives raw response
3. Normalizer transforms raw response → emits canonical artifact
4. Renderer consumes canonical artifact → displays text/image/video in Canvas
5. Node state transitions: queued → running → succeeded

**Alternate Paths**:
- User cancels during generation: node state transitions to cancelled; adapter aborts in-flight request
- Provider returns partial result: adapter returns partial artifact with degradation metadata

**Error Paths**:
- Timeout: dispatcher retries with bounded backoff → fails after max attempts with retryable error
- Auth failure: dispatcher returns terminal auth error → no retry; user must update credentials
- Rate limit: dispatcher retries after backoff → succeeds or fails with retryable error

**Postconditions**: Canvas displays rendered artifacts; node states are monotonic; structured logs include provider mode, latency, and error category

---

## Epic PRD-E001: MainPanel DeerFlow Integration

### Story PRD-E001-S001: Discover and Configure DeerFlow in Integrations
**As a** workflow builder  
**I want** DeerFlow listed in MainPanel Integrations with clear setup controls  
**So that** I can enable and configure the provider without leaving Knowgrph

**Acceptance Criteria**:
- **Given** MainPanel opens in Integrations mode  
- **When** user searches for "DeerFlow"  
- **Then** a DeerFlow section and rows are visible with provider status, endpoint, and auth fields
- **And** row anchors deep-link correctly from Flow Editor manager and node overlay

### Story PRD-E001-S002: Provider Mode Selection
**As a** product integrator  
**I want** DeerFlow configuration to support direct API mode and MCP bridge mode  
**So that** I can choose deployment topology without changing node contracts

**Acceptance Criteria**:
- **Given** DeerFlow integration settings  
- **When** user switches mode between direct and MCP  
- **Then** only mode-relevant fields are required and persisted
- **And** invalid mixed-mode configuration is blocked with explicit validation messaging

---

## Epic PRD-E002: Ingest->Parse->Render Enhancement

### Story PRD-E002-S001: Parse DeerFlow Metadata from Flow Markdown
**As a** workflow builder  
**I want** DeerFlow metadata parsed from frontmatter flow content  
**So that** generation nodes carry provider intent through graph compilation

**Acceptance Criteria**:
- **Given** markdown flow content containing generation nodes with DeerFlow metadata  
- **When** parser processes the content  
- **Then** graph nodes include normalized provider fields for text/image/video generation
- **And** parser warnings are emitted for unsupported fields without hard failure

### Story PRD-E002-S002: Render Provider-Neutral Generation Artifacts
**As a** workflow builder  
**I want** generated artifacts rendered consistently regardless of provider mode  
**So that** text/image/video outputs appear in the same Canvas UX contracts

**Acceptance Criteria**:
- **Given** a successful flow run with DeerFlow-backed generation nodes  
- **When** render phase completes  
- **Then** text outputs render as markdown/text blocks
- **And** image outputs render with uri, dimensions, and mime metadata
- **And** video outputs render with uri, duration, and preview metadata

---

## Epic PRD-E003: Canvas 2D Flow Editor Generation

### Story PRD-E003-S001: Unified Text/Image/Video Node Runtime
**As a** workflow builder  
**I want** text, image, and video nodes to use one provider dispatch contract  
**So that** node behavior is predictable and easier to maintain

**Acceptance Criteria**:
- **Given** a flow containing text, image, and video generation nodes  
- **When** user runs the flow  
- **Then** all generation nodes route through one provider dispatcher
- **And** node states expose queued, running, succeeded, failed, cancelled

### Story PRD-E003-S002: Failure and Retry UX
**As a** workflow builder  
**I want** clear retry and failure semantics for generation nodes  
**So that** I can recover from transient provider failures without rebuilding the graph

**Acceptance Criteria**:
- **Given** a provider timeout or transient API error  
- **When** node execution fails  
- **Then** failure state includes category, message, and retry hint
- **And** retry action reuses prior node inputs and preserves graph state

---

## Epic PRD-E004: Validation with Canonical Fixture

### Story PRD-E004-S001: End-to-End Validation on Video Demo Fixture
**As a** QA engineer  
**I want** DeerFlow coverage validated against a canonical fixture document  
**So that** regressions are detected in ingest, parse, run, and render

**Acceptance Criteria**:
- **Given** fixture file `knowgrph-video-demo.md` (workspace seed basename)  
- **When** targeted parser and flow tests run  
- **Then** ingest->parse->build-graph->run->render completes with expected artifacts
- **And** test suite verifies provider metadata mapping and artifact schema contracts

---

## Success Metrics

| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|--------------------|
| Integration discovery success | No DeerFlow row | DeerFlow visible in Integrations and searchable | Release +2 weeks | UI integration tests |
| Parser compatibility | Provider fields partially unsupported | 100% required DeerFlow fields parsed or warned | Release +2 weeks | Parser fixture tests |
| Generation run reliability | No DeerFlow execution path | >=95% success in controlled test runs | Release +4 weeks | Runtime test logs |
| Render artifact parity | Provider-specific variance | One canonical text/image/video artifact schema | Release +4 weeks | Snapshot and contract tests |
| Regression escape rate | No DeerFlow baseline | 0 critical regressions on fixture in release cycle | Continuous | CI focused tests |

---

## MoSCoW Prioritization

### Must Have
- [PRD-E001-S001] DeerFlow section in MainPanel Integrations with searchable rows
- [PRD-E002-S001] Parser support for DeerFlow metadata in frontmatter flow
- [PRD-E003-S001] Unified generation dispatcher for text/image/video
- [PRD-E004-S001] Fixture-based end-to-end validation using `knowgrph-video-demo.md`

### Should Have
- [PRD-E001-S002] Direct vs MCP mode toggle with strict validation
- [PRD-E003-S002] Retry/failure UX with typed error categories
- Provider observability metrics and per-run diagnostics in logs

### Could Have
- Provider profile presets for common DeerFlow deployment modes
- Advanced cancellation and resume controls for long-running generation
- Comparative provider benchmarking dashboard

### Won't Have (This Release)
- Full workflow orchestration migration into DeerFlow for all non-generation nodes
- Multi-provider auto-routing policy optimization
- Cross-tenant enterprise policy engine

---

## Out of Scope

- Replacing Knowgrph parser framework with external parser engines
- Rewriting existing BytePlus provider support
- Introducing backend services that break current local-first assumptions without explicit opt-in
- Large-scale refactor of unrelated panel modes

---

## Dependencies

### Product Dependencies
- MainPanel Integrations mode and settings row ownership contracts
- Flow Editor node registry templates and provider-linking conventions
- Existing run-generation capability for text/image/video

### Technical Dependencies
- DeerFlow reachable endpoint(s) and credentials
- Optional MCP server configuration where bridge mode is used
- Stable artifact schema contract for rich media rendering

### Validation Dependencies
- Fixture: `knowgrph-video-demo.md` (path-agnostic workspace seed)
- Focused parser, integration, and flow runtime tests

---

## Open Questions

**Q1**: Should direct mode and MCP mode share one credential envelope or separate field groups?  
**Owner**: Product + Architecture  
**Decision Date**: Sprint 1

**Q2**: Which DeerFlow error categories should map to retryable vs terminal in Canvas UX?  
**Owner**: QA + Engineering  
**Decision Date**: Sprint 1

**Q3**: Should provider-specific advanced fields be exposed in default UI or gated under advanced settings?  
**Owner**: Product  
**Decision Date**: Sprint 2

**Q4**: What timeout and concurrency defaults best fit local-first runs?  
**Owner**: Engineering  
**Decision Date**: Sprint 2

---

## Continuation

Part II: Technical Architecture Documentation (TAD) — architecture overview, component inventory, data flows, component specifications, integration contracts, ADRs, quality attributes, deployment strategy, and traceability matrix — continues in [knowgrph-deerflow-prd-tad.companion.md](knowgrph-deerflow-prd-tad.companion.md).
