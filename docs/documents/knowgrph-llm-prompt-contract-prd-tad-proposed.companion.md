---
title: Knowgrph LLM Prompt Contract PRD-TAD Companion (Runtime, Validation, Implementation)
id: knowgrph-llm-prompt-contract-prd-tad-proposed-companion
schema: kgc-computing-flow/v1
doc_type: prd-tad-companion
status: Proposed
version: 0.3.2
created: 2026-05-27
updated: 2026-05-27
canonical_doc: docs/documents/knowgrph-llm-prompt-contract-prd-tad-proposed.md
continuation_note: Maintains TAD, validation, and implementation detail moved out of the canonical sub-600-line source index.
---

# Knowgrph LLM Prompt Contract PRD-TAD Companion

> Canonical source: `docs/documents/knowgrph-llm-prompt-contract-prd-tad-proposed.md`
>
> Continuation scope: TAD, data contracts, validation, implementation guidance, open questions, and final decision.

---

## 7. TAD

### 7.1 Technical Decision Summary

| Decision | Status | Rationale |
|---|---|---|
| Reuse `CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT` as the sole chatKnowgrph contract owner | Accepted | Avoids prompt duplication and keeps fixes upstream. |
| Reuse workspace-document apply path for chat-generated KGC Markdown | Accepted | Keeps persistence, replay, and graph application deterministic. |
| Keep `tryParseMarkdownFrontmatterFlowGraph()` as the first Markdown graph parser | Accepted | Prevents duplicate or lossy parser forks. |
| Keep `flow.subgraphs -> kg:subgraphs -> deriveGraphGroups()` as the grouping pipeline | Accepted | Prevents duplicate cluster/group owners. |
| Reuse `buildScopedGraphSemanticKey()` everywhere graph identity is needed | Accepted | Prevents recomputation churn and signature drift. |
| Delete stale competing paths instead of aliasing them | Accepted | Aligns with root-fix and no-backcompat-shim rules. |

### 7.2 Component Specification

#### TAD-C01 - MainPanel Chat Configuration

- Owner: `SettingsView` and `useSettingsChatAssist`.
- Responsibility: provider presets, endpoint resolution, model discovery, context-scope selection, and integration enablement.
- Constraint: configuration is upstream-only; chat rendering and request submission must not define competing config sources.

#### TAD-C02 - FloatingPanel Chat Mount

- Owner: `ToolbarToolMenu.impl.tsx` with `FloatingPanelChatLazy`.
- Responsibility: mount the chat UI when the floating panel is in chat mode.
- Constraint: no second chat entrypoint inside MainPanel.

#### TAD-C03 - FloatingPanelChat Runtime

- Owner: `FloatingPanelChat.tsx`.
- Responsibility: read graph data, current node, markdown text, workspace context cache key, and chat settings from the store.
- Constraint: graph context and workspace context must reuse shared cache and signature helpers.

#### TAD-C04 - Submit Shell / Coordinator / Helpers

- Owners:
  - `useFloatingPanelChatSubmit.ts`
  - `floatingPanelChatSubmitPreflight.ts`
  - `floatingPanelChatSubmitCoordinator.ts`
  - `floatingPanelChatSubmitRequest.ts`
  - `floatingPanelChatSubmitTransport.ts`
  - `floatingPanelChatStreaming.ts`
  - `floatingPanelChatKgcAttempt.ts`
  - `chatStreamArtifacts.ts`
  - `chatStreamArtifactDereference.ts`
- Responsibility:
  - keep `useFloatingPanelChatSubmit.ts` as a thin shell for request-url guards and optimistic submit setup
  - choose KGC or generic contract by `chatStorageTarget` during request-build
  - resolve endpoint and provider request options through dedicated request and transport helpers
  - stream SSE deltas and persist live drafts plus session-folder stream artifacts through shared helpers
  - dereference eligible share/report URLs through the existing workspace URL-content import pipeline
  - validate KGC Markdown and retry with correction prompts through the KGC attempt helper plus validator/recovery modules
  - keep async lifecycle ownership centralized in `floatingPanelChatSubmitCoordinator.ts`
- Constraint: submit-flow enhancements must land in the existing shell-plus-helper stack, not in a second orchestrator and not by re-monolithizing the hook.

#### TAD-C05 - Finalize / Persist / Apply

- Owner: `useFinalizeAssistantSuccess.ts` plus `chatKgcCanvasApply.ts`.
- Responsibility:
  - append canonical workspace document
  - normalize canonical KGC path
  - follow workspace path
  - persist stream-log, stream-report, and dereferenced markdown artifacts in the same session folder
  - call `applyChatKgcWorkspaceDocumentToCanvas()`
- Constraint: canvas application must reuse `setActiveMarkdownDocument()`.

#### TAD-C06 - KGC Workspace Path Contract

- Owner: `chatHistoryWorkspace.paths.ts`.
- Responsibility: canonical `kgc_YYYYMMDDHHMMSS.md`, trace companion `kgc-trace_YYYYMMDDHHMMSS.md`, and output companion `kgc-output_YYYYMMDDHHMMSS.*` path derivation.
- Constraint: path identity is part of the runtime contract; ad hoc filename schemes are forbidden.

#### TAD-C07 - Stream Artifact Session Contract

- Owner: `chatStreamArtifacts.ts`.
- Responsibility: derive one timestamped session folder and stable `chat-stream-log_*`, `chat-stream-report*`, plus dereferenced markdown artifact filenames on the shared workspace path.
- Constraint: stream artifacts are additive companions to canonical `kgc_*`; they must not become a second graph-apply source.

#### TAD-C08 - Markdown Graph Parse Priority

- Owner: `features/parsers/default.ts`.
- Responsibility: prefer frontmatter-flow parsing before generic Markdown parse.
- Constraint: no Mermaid-only side parser may supersede this entry order for chat-generated Markdown.

#### TAD-C09 - Frontmatter-Flow Graph Parser

- Owner: `markdownFrontmatterFlowGraph.core.ts` and its parser modules.
- Responsibility:
  - parse YAML-frontmatter and body `flow:` variants
  - normalize nodes, edges, connections, socket types, clusters, and subgraphs
  - emit `GraphData` with `context: 'frontmatter-flow'`
- Constraint: grouping and graph semantics are normalized here once.

#### TAD-C10 - Import Mode Application

- Owner: `applyGraphDataCanonicalBootstrap.ts`, `frontmatterFlowImportMode.ts`, and `applyWorkspaceImportToCanvas.ts`.
- Responsibility: apply graph data, frontmatter-flow import modes, and canvas presets without leaking interactive view mutations into passive paths.
- Constraint: active import and passive source switching must remain separate.

#### TAD-C11 - Group And Cluster Rendering

- Owner: `subgraphs.ts` and `graphGroups.ts`.
- Responsibility: read normalized `kg:subgraphs` metadata and project it into rendered group underlays and nested group structures.
- Constraint: rendered groups are a projection, not an independent authoring model.

#### TAD-C12 - Shared Graph Semantic Identity

- Owner: `semanticKey.ts` and `lookupCache.ts`.
- Responsibility: stable graph-structure signatures and scope-aware semantic keys for reuse across graph-aware UI surfaces.
- Constraint: no local substitute helper may fork semantic identity behavior.

### 7.3 Data Contracts

#### DC-01 - Chat Storage Target

- `chatKnowgrph` -> KGC structured Markdown contract.
- `chatHistory` -> generic chat response contract.
- The PRD enhancement MUST NOT blur these two output modes.

#### DC-02 - KGC Workspace File Identity

- Canonical file: `kgc_<timestamp>.md`
- Trace file: `kgc-trace_<timestamp>.md`
- Output companion: `kgc-output_<timestamp>.<ext>`

The runtime MUST persist and normalize to these forms instead of inventing alternate file identity patterns.

#### DC-03 - Stream Artifact Session Identity

- Session folder: `YYYYMMDDTHHmmssZ`
- Stream log file: `chat-stream-log_<session>.md`
- Stream report file: `chat-stream-report_<session>.md`
- Additional dereference files: stable ordinal markdown basenames inside the same session folder

The runtime MUST derive these from the shared session timestamp instead of provider-local naming.

#### DC-04 - Frontmatter Graph Identity

- Graph context: `frontmatter-flow`
- Group metadata key: `kg:subgraphs`
- Group render ID: `subgraph:<id>`

#### DC-05 - Prompt And Validator Coupling

- Prompt contract emits structured KGC Markdown.
- Validator checks structural and syntactic rules.
- Correction prompt reuses the same output contract.
- Finalize persists the validated or best-available KGC document.

### 7.4 Failure Handling

| Failure point | Current owner | Required behavior |
|---|---|---|
| Missing endpoint or model | `floatingPanelChatSubmitPreflight.ts` via `useFloatingPanelChatSubmit` | Abort early with UI error; do not create alternate request path. |
| Provider request 400/429/model mismatch | `floatingPanelChatSubmitTransport.ts` via `floatingPanelChatSubmitCoordinator.ts` | Retry token parameter fallback or model fallback in the same runtime. |
| Empty assistant response | `floatingPanelChatStreaming.ts` plus `floatingPanelChatSubmitCoordinator.ts` | Surface explicit error and do not persist partial final content as success. |
| Invalid KGC structure | `validateChatMarkdown` + `buildCorrectionPrompt` | Retry upstream contract before finalize. |
| Stream artifact persistence mismatch | `chatStreamArtifacts.ts` | Keep canonical `kgc_*` success path intact and fail stream artifacts additively. |
| Share/report dereference failure | `chatStreamArtifactDereference.ts` via `fetchWorkspaceUrlContent()` | Skip the failing dereference, keep the original observed URL, and avoid a second fetch stack. |
| Persist/apply mismatch | `useFinalizeAssistantSuccess` / `chatKgcCanvasApply.ts` | Persist canonical file first, then apply through workspace-document import. |
| Parse failure | parser stack | Fall back inside the existing parser chain only; do not spawn a parallel parser owner. |
| Group rendering mismatch | `subgraphs.ts` / `graphGroups.ts` | Fix normalization or projection at the root; do not duplicate group metadata. |

### 7.5 Performance And Stability Constraints

- Draft writes should remain throttled during SSE streaming; no per-character synchronous graph apply.
- Final graph application occurs after canonical workspace persistence, not on every stream chunk.
- Passive source-file parsing must remain passive.
- Stream artifact writes must stay session-scoped and additive to the canonical KGC path.
- URL dereference must reuse the shared workspace URL-content import path, not a second fetch/cache layer.
- Group derivation must read normalized metadata and avoid recomputing alternative group registries.
- Graph cache identity must reuse the shared semantic-key helper.

---

## 8. Validation And Traceability

### 8.1 Current Validation Surfaces

| Surface | Existing test / code guard | What it proves |
|---|---|---|
| Prompt snippets and contract wording | `canvas/src/__tests__/chatResponseContractPrompt.test.ts` | KGC and generic prompt contracts include required structural guidance. |
| Structured KGC compatibility | `chatResponseContractPrompt.test.ts` | Base template and deterministic fallback are parseable by frontmatter-flow parser and validation rules. |
| Submit helper ownership | `chatResponseContractPrompt.test.ts` | Thin hook delegation, request-build, transport fallback, preflight, coordinator, and KGC retry helpers stay decomposed and behaviorally aligned. |
| Finalize-to-canvas apply path | `chatResponseContractPrompt.test.ts` | Finalize uses `applyChatKgcWorkspaceDocumentToCanvas()` and the workspace-document apply flags. |
| Stream artifact session writes | `canvas/src/__tests__/chatStreamArtifacts.test.ts` | Session-folder stream logs, reports, and dereferenced markdown artifacts stay on the shared workspace path. |
| Stream hardcode guard | `canvas/src/__tests__/miromindStreamArtifactHardcodeGuard.test.ts` | Example shared URLs are not committed as repo literals. |
| Frontmatter-flow parse behavior | `frontmatterFlowNodeNormalize.test.ts` | Frontmatter-flow node and subgraph normalization stays valid. |
| Passive import-mode guard | `frontmatterFlowImportModeSeepageRegression.test.ts` | Passive flows do not replay interactive import modes. |
| Source-file apply guard | `sourceFilesIngestStaleGuard.test.ts` | Workspace import and composed graph apply stay on the canonical graph-owning path. |
| Shared semantic-key reuse | `sourceFilesIngestStaleGuard.test.ts` and other regressions | Graph identity remains rooted in `buildScopedGraphSemanticKey()`. |

### 8.2 Required PRD-To-TAD Traceability

| PRD epic | TAD owner(s) | Validation owner |
|---|---|---|
| PRD-E1 | TAD-C01, TAD-C02, TAD-C03, TAD-C12 | settings assist behavior + graph semantic-key reuse tests |
| PRD-E2 | TAD-C04, TAD-C09 | `chatResponseContractPrompt.test.ts`, validator behavior |
| PRD-E3 | TAD-C04, TAD-C05, TAD-C06, TAD-C07 | finalize/apply tests plus stream artifact and workspace path helpers |
| PRD-E4 | TAD-C08, TAD-C09, TAD-C10, TAD-C11 | parser and import-mode regression tests |
| PRD-E5 | TAD-C10, TAD-C11, TAD-C12 | stale-guard and semantic-key reuse tests |

### 8.3 Definition Of Done

This scope is done only when all of the following are true:

1. The docs describe only real in-repo runtime owners for the current chat-to-canvas path.
2. The enhanced prompt contract is specified as an upstream change to `CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT`.
3. Group and cluster semantics are documented as one normalized pipeline, not parallel concepts.
4. Stream artifacts and share/report dereference remain additive workspace companions, not alternate apply surfaces.
5. Stale or speculative components are removed from the canonical doc rather than kept as competing proposed owners.
6. Focused validation remains tied to existing tests and parser/import guards.

---

## 9. Implementation Guidance For The Next Code Pass

This document update does not itself change runtime code, but it sets the exact direction for the next implementation pass.

### 9.1 Safe Enhancement Targets

1. `chatResponseBaseContract.ts`
   - tighten anti-duplicate and anti-stale wording
   - reinforce `flow.subgraphs` as the grouping SSOT
   - reinforce request-shaped section behavior
2. `chatMarkdownValidation`
   - reject any newly discovered duplicate grouping or stale heading patterns
3. `chatHistoryWorkspace.kgc.build`
   - preserve request-shaped normalization and continue stripping stale canned labels
4. `chatStreamArtifacts.ts`
   - keep session-folder lineage concise and renderer-neutral
5. `chatResponseContractPrompt.test.ts`
   - add focused assertions for any newly tightened prompt requirements

### 9.2 Unsafe Changes To Avoid

1. Adding a new chat orchestrator hook for the same request path.
2. Adding a direct assistant-text-to-graph mutation helper.
3. Adding a second grouping metadata format next to `kg:subgraphs`.
4. Introducing compatibility remaps for stale prompt shapes instead of fixing the prompt and validator upstream.
5. Adding a second share/report fetch client instead of reusing workspace URL import helpers.
6. Replacing shared semantic-key helpers with local hash logic.

---

## 10. Open Questions

| ID | Question | Why it matters | Current direction |
|---|---|---|---|
| OQ-01 | Should the enhanced KGC contract explicitly require classic canvas preset keys in addition to the existing `canvas:` block? | The import layer accepts presets, but the canonical chat contract is already richer. | Prefer the richer KGC contract as SSOT; add classic keys only if there is a concrete import benefit without duplication. |
| OQ-02 | Which new validator rules belong in `validateChatMarkdown()` versus prompt-only wording? | Over-validating can cause churn; under-validating can allow drift. | Add only rules that prevent deterministic structural regressions. |
| OQ-03 | Should prompt tests assert `flow.subgraphs` wording more strongly? | Group semantics are central to this pipeline. | Yes, if implemented as a focused prompt regression. |
| OQ-04 | Should canonical KGC persistence expose a stronger UI signal when the validator had to retry? | Better debugging for malformed model output. | Safe follow-up if it does not create a second state channel. |
| OQ-05 | Should dereferenced share/report markdown docs expose richer frontmatter lineage for Storyboard defaults? | Better Canvas observability without a second renderer contract. | Safe follow-up if it stays additive to the shared frontmatter path. |
| OQ-06 | Are there any remaining stale docs that still mention the removed speculative bridge/orchestrator/parser owners? | Canonical docs must not compete. | Audit adjacent docs after this rewrite. |

---

## 11. Final Decision

Knowgrph already owns a coherent chat-to-canvas pipeline. The correct strategy is to strengthen and document that existing upstream path, not to add new layers.

Therefore the architecture decision is final for this scope:

- MainPanel config stays upstream.
- FloatingPanel chat stays the chat UI owner.
- `useFloatingPanelChatSubmit` stays a thin submit shell.
- `floatingPanelChatSubmitCoordinator.ts` plus the existing submit helpers stay the async submit / stream / validate owner.
- `chatStreamArtifacts.ts` and `chatStreamArtifactDereference.ts` stay additive workspace companions on the shared runtime.
- `useFinalizeAssistantSuccess` plus `applyChatKgcWorkspaceDocumentToCanvas()` stays the persistence / apply owner.
- `tryParseMarkdownFrontmatterFlowGraph()` stays the first Markdown graph parser.
- `flow.subgraphs -> kg:subgraphs -> deriveGraphGroups()` stays the grouping pipeline.
- `buildScopedGraphSemanticKey()` stays the semantic identity helper.

Everything stale, speculative, duplicate, conflicting, downstream-patched, or second-runtime is forbidden.

---

*Companion ID: `knowgrph-llm-prompt-contract-prd-tad-proposed-companion`*  
*Version: `0.3.2`*  
*Updated: `2026-05-27`*
