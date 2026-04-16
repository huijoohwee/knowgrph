---
title: Markdown Syntax Guidelines (SSOT)
product: Knowgrph Canvas
status: canonical
---

# Markdown Syntax Guidelines

## Purpose
Provide a strict, renderer-safe Markdown contract for {{product}} Chat output that can be ingested and rendered across Infinite Canvas, Workspace Editor, Multi-dimensional Table, and Kanban.

## Core Rules
- Respond with Markdown only. No preamble. No explanation.
- Variables use `{{key}}`, optional `{{key:value}}`, optional `{{key|fallback}}`.
- For chatKnowgrph KGC output, include YAML frontmatter first, then a non-empty markdown body that references declared frontmatter variables via `{{}}`.
- For multi-part or complex chatKnowgrph requests, `solution_md` must contain the substantive answer content, not a thin one-line summary.
- Annotation sigils use inline code only: `#HEX:text`, `bg#HEX:text`, or `#HEX|bg#HEX:text` where HEX is exactly 6 uppercase digits.
- Prefer frontmatter `flow:` YAML for flow graphs; keep schema stable and parseable.

## Syntax Validation Rules

| Rule id | Check | Pattern | Pass condition |
|---|---|---|---|
| `V-01` | Color sigil HEX format | `` `#HEX:text` `` | HEX is exactly 6 uppercase digits |
| `V-02` | Long quote guard | prose | no quoted span ≥ 15 words |
| `V-03` | Variable references resolvable | `{{key}}` | all keys present in frontmatter or inline `{{key:value}}` |
| `V-04` | Multi-select arrays valid JSON | `` `["A","B"]` `` | `JSON.parse` succeeds after backtick strip |
| `V-05` | `compute:` function is pure | `compute: \|` block | no `fetch`, `document`, `window` in function body |
| `V-06` | No manual truncation ellipsis | `...` in headings | no `...` at end of H1–H4 labels |
| `V-07` | Confidence enum constrained | `confidence:` fields | values are exactly `low`, `medium`, or `high` |

## Retry Contract
On first failure, inject `@flag:correction` with `failed_rule: V-0x` into the next AI call. Max retry: `3`. After 3 failures surface `@flag:validation-failed`.
