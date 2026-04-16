---
title: Knowgrph Chat -> AI Markdown Pipeline (Fallback Recovery Companion)
status: canonical-companion
owner: platform-ai
---

# Fallback Recovery Companion

## Scope
This companion documents fallback recovery behavior for `chatKnowgrph` when model output fails validation after retries.

## Recovery Order
1. Score and select richest error candidate from raw assistant text, non-kgc answer text, and extracted `kgc`.
2. Try body salvage from leading frontmatter.
3. Try body salvage from embedded malformed frontmatter.
4. Try top-level frontmatter `solution_md` salvage.
5. Use omission note only when no usable markdown body remains.

## Workspace Handoff
- After final save, follow the resolved `kgc_*.md` path again.
- Force markdown workspace layout to `editor`.
- If a markdown path is active, runtime must switch from `nodeQuickEditor` to `document`.

## Guardrails
- Strip residual artifacts: bare `kgc`, escaped `\---`, escaped fence wrappers.
- Strip duplicated recovered shell sections (`# {{subject}}`, `## Intent`, `## Request`, leading `## Solution`) but keep useful content headings.
- Avoid adding new fallback branches outside the canonical recovery path.
