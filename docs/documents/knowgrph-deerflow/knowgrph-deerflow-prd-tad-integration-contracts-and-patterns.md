# Knowgrph DeerFlow Integration Contracts and Patterns

**Document Version**: 1.0.0  
**Date**: 2026-05-07  
**Status**: Proposed  
**Companion To**: `knowgrph-deerflow-prd-tad.md`

---

## Document Purpose

**Context**: DeerFlow integration spans MainPanel settings, parser metadata, runtime dispatch, and Canvas rendering.  
**Intent**: Define strict contracts and reusable patterns so all surfaces behave consistently.  
**Directive**: All integrations must use SSOT contracts; no duplicated provider logic across panel/editor/runtime layers.

---

## Contract Catalog

| Contract ID | Name | Producer | Consumer | Criticality |
|-------------|------|----------|----------|-------------|
| DFI-C001 | Integration SSOT Row Contract | Integrations SSOT module | MainPanel, Flow Manager, Node Overlay | High |
| DFI-C002 | MainPanel Anchor Contract | MainPanel settings view | Flow Manager deep links | Medium |
| DFI-C003 | Frontmatter Provider Metadata Contract | Parser | Graph compiler, runtime dispatcher | High |
| DFI-C004 | Generation Dispatcher Contract | Runtime dispatcher | Node execution pipeline | High |
| DFI-C005 | DeerFlow Direct Adapter Contract | DeerFlow direct adapter | Dispatcher | High |
| DFI-C006 | DeerFlow MCP Adapter Contract | DeerFlow MCP adapter | Dispatcher | High |
| DFI-C007 | Canonical Artifact Contract | Adapter/Normalizer | Canvas 2D renderer, rich media panel | High |
| DFI-C008 | Error Taxonomy Contract | Adapter/Dispatcher | UI node state and retry UX | High |
| DFI-C009 | Observability Event Contract | Runtime execution | Logs, diagnostics panels, CI reports | Medium |

---

## DFI-C001: Integration SSOT Row Contract

### Purpose
Provide a single-source, typed row schema for DeerFlow integration settings that all UI surfaces consume.

### Schema

```ts
type DeerFlowIntegrationMode = "direct" | "mcp";

interface DeerFlowIntegrationRow {
  key: string;                    // stable unique key
  title: string;                  // user-visible label
  description?: string;           // concise usage guidance
  required: boolean;              // required for current mode
  modeScope: "all" | DeerFlowIntegrationMode;
  fieldPath: string;              // canonical config path
  valueType: "string" | "number" | "boolean" | "enum" | "secret";
  enumOptions?: string[];
  defaultValue?: string | number | boolean;
  validationRule?: string;        // symbolic rule id
  docsAnchor?: string;            // local anchor for deep links
}
```

### Constraints
- `key` must be immutable once shipped.
- `fieldPath` must map to one canonical provider config tree.
- `required` must be computed by `modeScope` and not hardcoded per surface.

### Failure Handling
- Invalid row schema is rejected during build-time validation.
- Unknown `valueType` or missing `key` fails closed and surfaces a configuration error.

---

## DFI-C002: MainPanel Anchor Contract

### Purpose
Ensure every DeerFlow setting row can be opened via deterministic deep-link from editor surfaces.

### Contract

```ts
interface MainPanelAnchorLink {
  panelMode: "integrations";
  sectionKey: "deerflow";
  rowKey: string;
  anchorId: string;
}
```

### Rules
- `anchorId` must be generated from `sectionKey + rowKey` and remain stable.
- Flow Manager and Node Overlay may only reference declared `rowKey` values from SSOT.

---

## DFI-C003: Frontmatter Provider Metadata Contract

### Purpose
Normalize DeerFlow metadata in flow markdown so graph compiler and runtime share identical semantics.

### Contract

```ts
interface ParsedProviderMetadata {
  provider: "deerflow";
  mode: "direct" | "mcp";
  model?: string;
  skill?: string;
  endpoint?: string;
  toolName?: string;
  timeoutMs?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };
  extras?: Record<string, unknown>;
}
```

### Validation Policy
- Reject missing required fields by mode.
- Warn on unknown optional fields.
- Coerce numeric/string booleans only when safe and deterministic.

### Parser Guarantees
- Output always sets `provider = "deerflow"` when DeerFlow is declared.
- Output never leaks secret values into graph snapshots.

---

## DFI-C004: Generation Dispatcher Contract

### Purpose
Provide a single runtime entry point for text/image/video generation with mode-specific adapter routing.

### Contract

```ts
type GenerationKind = "text" | "image" | "video";

interface RunGenerationRequest {
  kind: GenerationKind;
  prompt: string;
  providerMetadata: ParsedProviderMetadata;
  options?: Record<string, unknown>;
  correlationId: string;
}

interface RunGenerationResponse {
  state: "succeeded" | "failed";
  artifact?: CanonicalArtifact;
  error?: CanonicalProviderError;
  metrics: {
    latencyMs: number;
    attemptCount: number;
    providerMode: "direct" | "mcp";
  };
}
```

### State Mapping
- `queued -> running -> succeeded|failed|cancelled`
- Transition order is strict and monotonic.

---

## DFI-C005 and DFI-C006: Adapter Contracts

### Direct Adapter Contract (DFI-C005)

```ts
interface DeerFlowDirectAdapter {
  generateText(req: RunGenerationRequest): Promise<AdapterRawResponse>;
  generateImage(req: RunGenerationRequest): Promise<AdapterRawResponse>;
  generateVideo(req: RunGenerationRequest): Promise<AdapterRawResponse>;
}
```

### MCP Adapter Contract (DFI-C006)

```ts
interface DeerFlowMcpAdapter {
  invokeTool(toolName: string, payload: Record<string, unknown>): Promise<AdapterRawResponse>;
}
```

### Shared Rules
- Adapters return raw payload plus protocol metadata.
- Adapters do not mutate graph state directly.
- Adapters do not perform UI-level formatting.

---

## DFI-C007: Canonical Artifact Contract

### Purpose
Keep renderer/provider decoupling by enforcing one artifact model for all generation outputs.

```ts
type CanonicalArtifact = TextArtifact | ImageArtifact | VideoArtifact;

interface TextArtifact {
  type: "text";
  content: string;
  meta?: Record<string, unknown>;
}

interface ImageArtifact {
  type: "image";
  uri: string;
  width?: number;
  height?: number;
  mime?: string;
  meta?: Record<string, unknown>;
}

interface VideoArtifact {
  type: "video";
  uri: string;
  durationSec?: number;
  previewUri?: string;
  mime?: string;
  meta?: Record<string, unknown>;
}
```

### Required Renderer Guarantees
- Renderer branches only on `type`.
- Missing optional fields degrade gracefully with fallback UI labels.

---

## DFI-C008: Error Taxonomy Contract

### Purpose
Ensure retry and UX semantics are deterministic across direct and MCP modes.

```ts
type ProviderErrorCategory =
  | "auth"
  | "timeout"
  | "rate_limit"
  | "invalid_request"
  | "provider_unavailable"
  | "transport"
  | "unknown";

interface CanonicalProviderError {
  category: ProviderErrorCategory;
  message: string;
  retryable: boolean;
  providerCode?: string;
  details?: Record<string, unknown>;
}
```

### Mapping Rules
- `timeout`, `rate_limit`, and selected `transport` errors are retryable.
- `auth` and `invalid_request` are terminal by default.
- Unknown errors default to non-retryable unless adapter marks otherwise.

---

## DFI-C009: Observability Event Contract

### Purpose
Provide stable telemetry events for diagnostics and release gates.

```ts
interface DeerFlowRunEvent {
  eventName: "deerflow.run.started" | "deerflow.run.completed" | "deerflow.run.failed";
  correlationId: string;
  nodeId: string;
  kind: "text" | "image" | "video";
  mode: "direct" | "mcp";
  latencyMs?: number;
  errorCategory?: ProviderErrorCategory;
}
```

### Rules
- Every run emits exactly one terminal event (`completed` or `failed`).
- `correlationId` must match dispatcher request context.

---

## Integration Patterns

## Pattern P001: SSOT-First Surface Reuse
- Define DeerFlow rows once.
- Consume rows in MainPanel, Flow Manager, and Node Overlay.
- Reject any surface-specific row forks.

## Pattern P002: Mode-Gated Validation
- Compute required fields from selected mode.
- Validate at save-time and run-time.
- Prevent mixed direct/MCP payloads.

## Pattern P003: Parse-Normalize-Dispatch
- Parse frontmatter metadata.
- Normalize into canonical provider metadata.
- Dispatch using one runtime entrypoint.

## Pattern P004: Adapter Isolation
- Keep protocol and provider quirks in adapter modules only.
- Normalize output before it reaches renderer.
- Do not spread protocol handling into UI or parser.

## Pattern P005: Artifact-First Rendering
- Renderer consumes canonical artifact model.
- Provider-specific display logic is prohibited.
- Add new providers by implementing adapters, not UI forks.

## Pattern P006: Error-Category-Driven Retry
- Retry policy derives from canonical error category.
- Backoff policy is centralized in dispatcher config.
- Node-level UX only consumes `retryable` and `message`.

---

## Anti-Pattern Guards

- Do not hardcode DeerFlow endpoints in node definitions.
- Do not introduce provider-specific renderer branches.
- Do not parse provider metadata directly in runtime executors.
- Do not duplicate integration rows in multiple modules.
- Do not fallback silently from one mode to another.

---

## Sequence Patterns

## Sequence S001: MainPanel Configuration
1. User opens Integrations mode.
2. User configures DeerFlow mode and required fields.
3. System validates mode-gated requirements.
4. System persists provider config with stable keys.

## Sequence S002: Parse to Runtime
1. User imports or opens flow markdown.
2. Parser extracts DeerFlow metadata for generation nodes.
3. Compiler emits typed graph with normalized provider metadata.
4. Dispatcher routes generation calls to selected adapter.
5. Adapter returns raw response.
6. Normalizer emits canonical artifact.
7. Renderer displays artifact in Canvas 2D.

## Sequence S003: Failure and Retry
1. Adapter returns error payload.
2. Dispatcher maps error to canonical category.
3. Node state updates to failed with retry hint.
4. User clicks retry.
5. Dispatcher replays request using same inputs with bounded attempt count.

---

## Requirement Mapping

| PRD Story | Primary Contracts | Primary Patterns |
|-----------|-------------------|------------------|
| PRD-E001-S001 | DFI-C001, DFI-C002 | P001 |
| PRD-E001-S002 | DFI-C001, DFI-C004, DFI-C005, DFI-C006 | P002, P004 |
| PRD-E002-S001 | DFI-C003 | P003 |
| PRD-E002-S002 | DFI-C007 | P005 |
| PRD-E003-S001 | DFI-C004, DFI-C007 | P003, P005 |
| PRD-E003-S002 | DFI-C008 | P006 |
| PRD-E004-S001 | DFI-C003, DFI-C004, DFI-C007, DFI-C009 | P003, P005, P006 |

---

## Review Checklist

- [ ] Contract IDs and names are stable and unique.
- [ ] All required PRD stories map to at least one contract.
- [ ] Renderer depends only on canonical artifact contract.
- [ ] Adapter layer owns all protocol-specific quirks.
- [ ] Error taxonomy is complete for current provider surfaces.
- [ ] Observability events cover start and terminal states.

---

## Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-07 | joohwee | Initial integration contracts and architecture patterns for DeerFlow |
