# Knowgrph Token Management and Markdown Highlight Budget

This document summarizes how Knowgrph manages token-related limits in the markdown viewer, with a focus on the always-on highlight complexity budget.

## Token Sharing & Performance Optimization

To further optimize performance in dual-mode editors (Markdown Viewer + Presentation Mode), Knowgrph implements a token sharing strategy.

- **Shared Lexing**: Markdown text is lexed once, and the resulting tokens are stored in the global store (e.g., Zustand).
- **Consumption**: Both the Markdown Viewer and Presentation Mode consume these pre-calculated tokens instead of re-lexing the text.
- **Presentation Mode Optimization**: The Presentation view (including "Two Column" layouts) reuses the full document's lexed tokens (`fullDocTokens`) by filtering them based on slide line ranges. This eliminates redundant lexing during slide transitions and preview generation.
- **Cache Invalidation**: The token cache is invalidated only when the source markdown text changes.
- **Semantic Rendering**: The renderer uses semantic HTML (`article`, `section`, `nav`, `figure`) to reduce DOM complexity and improve accessibility, which also contributes to better rendering performance.

## Always-On Markdown Highlight Budget

The markdown preview panel supports “always-on” text highlights that are derived from the active graph (nodes and edges) and the current markdown document.

- Component: MarkdownPreview
- Guard constant: ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET (default: 500000)
- Complexity metric: tokenCount × (nodeCount + edgeCount)

When the product of markdown tokens and graph entities exceeds the configured budget, the viewer disables always-on highlights for that render to avoid freezes on large documents or graphs. The markdown still renders; only the extra highlight computation is skipped.

Formally:

- Let T = number of lexed markdown tokens for the active document.
- Let E = number of graph entities (nodes + edges) with metadata matching the active document path.
- If T × E > budget → always-on highlights are disabled for that render.

This keeps the markdown pipeline responsive when importing large notebooks, long slide decks, or graphs with many entities.

## Configuring the Highlight Budget in Main Panel Settings

You can configure the complexity budget from the Main Panel Settings tab.

- Setting key: markdownAlwaysOnHighlightComplexityBudget
- Type: number
- Scope: UI → Markdown Viewer
- Storage: persisted via the settings registry (owner: ui.mainPanel)

Semantics:

- If the setting is unset or set to a non-positive value, the system falls back to the default budget (500000).
- If the setting is set to a positive number N, the markdown viewer uses N as the budget for the T × E guard.

Suggested ranges:

- 100000–300000 → conservative (disable highlights earlier on large graphs)
- 500000 (default) → balanced for typical project-sized notebooks and slide decks
- 800000–1200000 → aggressive (keep highlights enabled for larger graphs, with higher risk of heavy computations on very large imports)

To change the value:

1. Open the Main Panel.
2. Switch to the Settings tab.
3. Search for “markdownAlwaysOnHighlightComplexityBudget”.
4. Enter a numeric value and click Apply.

## Regression Tests Around the Budget

The canvas test suite includes regression tests that exercise the guard behavior using the markdown slide styling guidelines document.

- File: canvas/src/__tests__/markdownGuidelinesIngestion.test.ts
- Fixtures: markdown-slide-styling-guidelines.md (external guidelines document)

Tests:

- testGuidelinesMarkdownHighlightGuardWithLargeGraph
  - Computes tokenCount for the guidelines markdown.
  - Synthesizes a large graph with many nodes.
  - Asserts that tokenCount × entityCount > ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET.
  - Renders MarkdownPreview with always-on highlight mode enabled and verifies the preview root renders without errors.
  - This ensures that the guard kicks in for large T × E cases while the viewer remains responsive.

- testGuidelinesMarkdownHighlightGuardWithSmallGraph
  - Computes tokenCount for the same markdown.
  - Synthesizes a small graph with few nodes.
  - Asserts that tokenCount × entityCount < ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET.
  - Renders MarkdownPreview with always-on highlight mode enabled and verifies the preview root renders without errors.
  - This ensures that small T × E cases remain below the guard threshold and still render successfully.

Together, these tests define a safe operating envelope for always-on highlights and protect against regressions when the default budget or related logic is modified.

## Operational Guidance

When tuning the highlight budget:

- If users report UI freezes when importing large markdown files or graphs:
  - Lower markdownAlwaysOnHighlightComplexityBudget to disable highlights sooner.
  - Validate by re-running the markdownGuidelinesIngestion tests and smoke-testing imports via the Floating Panel markdown actions.

- If users want richer always-on highlighting on large workspaces:
  - Increase markdownAlwaysOnHighlightComplexityBudget gradually.
  - Monitor for slowdowns in the markdown preview panel on large documents.

The goal is to keep the markdown viewer responsive by default while allowing power users to push the budget higher when working on machines and datasets that can tolerate heavier highlight computations.

## Markdown Text Highlight Toggle Defaults

The Bottom Panel markdown section exposes a Text Highlight toggle next to Presentation mode.

- Storage key: LS_KEYS.markdownTextHighlight
- Location: Bottom Panel → Curation → Markdown
- Default: Off (no extra text highlighting)

Behavior:

- When Text Highlight is Off:
  - The markdown editor and viewer still auto-align to the selected node or edge.
  - No additional background bands or underline treatments are applied to the highlighted range.
  - Always-on token highlights are disabled unless explicitly enabled elsewhere.

- When Text Highlight is On:
  - Canvas selections with markdown provenance drive a highlightedLineRange in the markdown editor and viewer.
  - MarkdownTokenRenderer applies a tinted background band and underline treatments to blocks that overlap the range, using canvas-aware colors.
  - Always-on token highlights are enabled in the viewer, subject to the T × E complexity guard and the configured markdownAlwaysOnHighlightComplexityBudget.

Operationally, this means:

- Keeping Text Highlight Off by default minimizes extra highlight computations and is safest for large notebooks and dense graphs.
- Power users can turn Text Highlight On when working with moderate-sized documents or after raising the always-on budget, accepting the additional token-level work in exchange for richer visual feedback.

## Token Sharing Directive

To avoid redundant lexing and improve performance:
- **Share Tokenized Data**: Developers must share tokenized data structures across viewer and editor modes.
- **Reuse Parsed Tokens**: Reuse parsed tokens instead of re-parsing unchanged content when switching modes.
- **Single Source of Truth**: Maintain a single source of truth for token data to prevent inconsistencies.
- **Prevent Re-parsing**: Prevent re-parsing of unchanged content to optimize rendering cycles.

### Implementation Details

- **Store**: `GraphState` in `useGraphStore` holds `markdownTokens`, plus integrity metadata (`markdownTokensKey`, `markdownTokensPath`).
- **Key**: `buildMarkdownTokensKey(markdownText)` uses length + hash to bind tokens to exact content.
- **Hook**: `useMarkdownPreviewTokens` encapsulates the logic for retrieving, calculating, and caching tokens. It should be used by all consumers (Viewer, Editor, TOC) to ensure consistent token sharing.
- **Set**: `BottomPanelMarkdownSection` computes tokens via `useMarkdownPreviewTokens` and passes them to `MarkdownViewerPane` (for preview) and `MarkdownPanelLayout` (for TOC) via props, ensuring a single source of truth.
- **Invalidate**: `setMarkdownDocument` in `graphDataSlice` clears `markdownTokens`, `markdownTokensPath`, and `markdownTokensKey` when text changes.
- **Read**: Components reuse stored tokens only when `storedTokensKey === buildMarkdownTokensKey(currentText)`.
