## Goals
- Ensure data loading auto-detects supported formats and auto-applies the right parser
- Provide a clear path when data is not supported (manual parser script load)
- Auto-load the selected parser’s spec into the Bottom Panel → Parser tab
- Fix garbled text at the bottom of the Parser tab editor
- Clean up caches, duplicate logic, stale code paths, and potential leaks

## Current State (Verified)
- Auto-detect and apply parser on file load via `loadDataViaParser` using `bestMatch` and `applyParserAsync` (canvas/src/features/parsers/loader.ts:14–35, registry.ts:43–48)
- Built-in parsers cover CSV/JSON/JSON‑LD/N8n/Python/GraphRAG (default.ts:9–49, graphrag.ts:4–18)
- On load, Parser view stores input, selected parser, counts, and script text; opens Bottom Panel → Parser (ParserView.tsx:107–137, 263–279)
- Parser script auto-populates in the Parser tab via `parserSpecTextFromList` (specFormat.ts:15–18) and is rendered by `JsonEditor` (BottomPanel.tsx:426–434)
- Code tab textarea aligns center, selects IDs, and scrolls programmatically (BottomPanel.tsx:352–373, lib/editor.ts:49–77, panels/utils/editor.ts:1–33)

## Changes
### 1) Data Load UX
- Supported data: keep auto-detect + auto-apply via `loadDataViaParser` and show counts/warnings; auto-open Bottom Panel → Parser (no change required)
- Not supported data: keep current warning and focus the Custom Parser form (ParserView.tsx:263–266, 135). Add default transforms skeleton to `scriptText` on unmatched to guide users.

### 2) Auto‑Load Parser Script into Parser Tab
- Confirmed: after detection, set `scriptText` from selected spec and prefer language (`json` except `python` → `text`) (ParserView.tsx:119–123). No logic change required.

### 3) Fix Parser Tab Text Rendering Garbles
- Root cause: overlay `<pre>` and `<textarea>` may diverge in line-height and wrapping, causing bottom-line misalignment/clipping.
- Update `JsonEditor` to force consistent rendering across both layers:
  - Apply identical `line-height`, whitespace, and overflow styles to `<pre>` and `<textarea>`.
  - Add explicit `leading` to match Tailwind’s `text-xs` line-height and ensure smooth scroll math (lib/editor.ts uses computed lineHeight).
- Concretely update:
  - `JsonEditor.tsx:87–103`
    - Add `leading-[1rem]` to both elements
    - Add `whitespace-pre-wrap break-words` to `<textarea>` to mirror `<pre>`
    - Add `overflow-auto` to `<textarea>` (mirrors `<pre>`)
    - Keep `extraBottomPad` on both to avoid error overlay collision

### 4) Performance & Cleanup
- Parser cache
  - Keep LRU cache keyed by parser id, file name, text hash, and transforms cfg key (cache.ts:16–24; useParserEditor.ts:88–93) — already good
- Event/timer cleanup
  - Add cleanup for `blockHighlightTimerRef` like `codeSelectTimerRef` to avoid stray timers on unmount (BottomPanel.tsx:211–218). Clear if set.
- Effect stability
  - Ensure no re-register loops for built-in parsers; current `registerParser` de-dupes by id (registry.ts:8–12) — keep
- Minor hardcodes
  - Consider lifting `scheduleIdle` fallback delay to a shared constant (panels/utils/idle.ts:1–5). Low-risk improvement.

### 5) Validation
- Unit tests already cover auto-select behavior (canvas/src/__tests__/parserAutoApply.test.ts:3–9)
- Add a lightweight rendering test for `JsonEditor` to verify consistent height and scroll alignment given multi-line input and error state
- Manual QA: load sample files from `canvas/public/examples` and `test-data` to verify:
  - Supported formats auto-apply and open Parser tab
  - Unmatched input focuses Custom Parser and pre-fills script skeleton
  - Parser tab editor shows no clipping/garbling on long content and with error banners

## Implementation Summary
- Edit `JsonEditor.tsx` to unify line-height/whitespace/overflow for overlay and textarea
- Add default parser transforms skeleton on unmatched in `ParserView.tsx`
- Add timer cleanup in `BottomPanel.tsx` for `blockHighlightTimerRef`
- Optional: lift `scheduleIdle` fallback delay to a named constant

## File References
- canvas/src/features/parsers/loader.ts:14–35
- canvas/src/features/parsers/registry.ts:43–48
- canvas/src/features/parsers/default.ts:9–49
- canvas/src/features/parsers/graphrag.ts:4–18
- canvas/src/features/panels/views/ParserView.tsx:107–137, 263–279, 310
- canvas/src/features/parsers/specFormat.ts:15–18
- canvas/src/components/BottomPanel.tsx:352–373, 426–434
- canvas/src/features/json/JsonEditor.tsx:87–103
- canvas/src/lib/editor.ts:49–77
- canvas/src/features/panels/utils/editor.ts:1–33
- canvas/src/features/panels/utils/idle.ts:1–5
- canvas/src/__tests__/parserAutoApply.test.ts:3–9