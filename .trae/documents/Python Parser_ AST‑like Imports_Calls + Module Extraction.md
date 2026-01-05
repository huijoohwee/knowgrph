## Current State
- Parser registry and matching in `canvas/src/features/parsers/registry.ts:17-28`.
- Built‑ins register `pythonSpec` in `canvas/src/features/parsers/default.ts:48`.
- Python parsing is line‑based, extracting classes/functions and `memberOf` edges in `canvas/src/features/parsers/python.ts:11-53` and exposed via `pythonSpec` in `canvas/src/features/parsers/python.ts:66-76`.
- Parser caching via `LRUCache` in `canvas/src/features/parsers/cache.ts:15-24` and `setCachedParse` in `canvas/src/features/parsers/cache.ts:19-21`.
- ParserView applies selected parser and uses the cache in `canvas/src/features/panels/views/ParserView.tsx:75-84`.

## Goals
- Support Python import extraction (`import x`, `from x import y`) and call graph edges (`foo()`, `obj.method()`), in addition to classes/functions.
- Keep feature files under 600 lines by extracting utilities into feature‑scoped modules without changing the external API (`ParserSpec`, `builtInParsers`).
- Remove/avoid stale or redundant computation and prevent re‑renders/loops/memory leaks.
- Improve cache/memoize performance and targeted invalidation.

## Implementation (TS‑only, AST‑like)
- Create `features/parsers/python/` with:
  - `lexer.ts`: whitespace/indent tracking, token helpers for `import`, `from`, `def`, `class`, identifiers, and call patterns; streaming line iterator.
  - `scope.ts`: maintain class/function stacks with current indent; attach file/line info; track module name from `input.name`.
  - `builder.ts`: build nodes (`py:module:<mod>`, `py:class:<Name>`, `py:function:<Name|Class.Name>`, `py:symbol:<qualified>`), and edges (`imports`, `memberOf`, `calls`) with properties `{ file, line }`.
  - `parser.ts`: two‑pass parse:
    - Pass 1: definitions + imports; record symbol table per scope.
    - Pass 2: scan lines for call sites using patterns `^\s*([A-Za-z_][\w\.]*)\s*\(` and qualified calls within scope; resolve to known functions when possible; otherwise create `py:symbol` target.
    - Handle multi‑line calls and imports using simple bracket/continuation detection.
  - `index.ts`: export `pythonSpec` that delegates to the new parser, preserving `id`, `name`, `match` contract.
- Update `features/parsers/python.ts` to re‑export from `python/index.ts` (or replace implementation) while keeping the same `ParserSpec` shape, so `builtInParsers` remains unchanged.

## Edge Semantics
- Imports:
  - Node: `py:module:<mod>` and `py:symbol:<mod.Member>`; Edge: `imports` from module to imported module/symbol.
  - Support `import a as b`, `from a.b import c, d`, parenthesized/multi‑line imports, relative imports (`from .x import y`) normalized to string.
- Calls:
  - Edge: `calls` from calling function/method to target function/symbol.
  - Recognize decorators as calls attached to the decorated function (line association).
  - Qualified calls (`pkg.mod.func`, `self.method`) resolve via scope and import map when possible.

## Performance & Safety
- Streaming parse over lines with O(n) time; avoid backtracking; guard against nested parentheses causing infinite loops; cap continuation scanning.
- Memoize per input hash; reuse existing `getCachedParse` and `setCachedParse` paths in `ParserView`.
- Targeted cache invalidation: iterate keys and delete only those with `parserId|` prefix instead of `clear()`; keep TTL and size tuning configurable.
- Use early returns and small pure helpers to reduce re‑renders; no new global listeners.

## API Preservation
- Keep `ParserSpec` unchanged; `builtInParsers` remains `[...] pythonSpec]` in `default.ts`.
- Returned `GraphData` retains shape; adds new edge labels `imports`/`calls` and module/symbol nodes.

## UI Integration
- `ParserView` needs no UI changes; counts/warnings update automatically. Optional: surface a summary of imports/calls in `selectedSpec` details without changing core structure.

## Optional Advanced AST (tree‑sitter)
- Add `web-tree-sitter` and `tree-sitter-python`; parse in a Web Worker to avoid blocking the UI.
- Worker returns normalized nodes/edges; main thread maps to `GraphData`.
- This path offers higher accuracy for complex syntax; can be phased in behind a feature flag.

## Refactors To Stay <600 Lines
- Move common transform helpers already centralized in `canvas/src/features/parsers/transform.ts` and reuse from Python builder.
- Keep each new Python file ≤200 lines; lean helpers with single responsibility.

## Testing
- Add sample inputs covering: simple imports, multi‑imports, relative imports, nested classes/methods, decorators, qualified calls, unknown calls.
- Verify node/edge counts via `Apply Parser` in Parser panel and ensure cache hits on re‑apply.

## Risks & Mitigations
- Regex‑based calls may miss edge cases; mitigated by conservative fallbacks to `py:symbol` nodes.
- Cache invalidation must be precise; implement prefix delete and unit‑test in isolation.

## Next Steps
- Implement the TS‑only AST‑like parser and targeted cache invalidation.
- Verify on sample Python files; optimize hot paths if needed.
- Optionally scope a follow‑up for tree‑sitter worker integration.