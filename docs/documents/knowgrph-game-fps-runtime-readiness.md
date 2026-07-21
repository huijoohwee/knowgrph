---
title: "Knowgrph Game FPS Runtime Readiness"
doc_type: "Runtime Proof Checklist"
status: "verification-pending"
date: "2026-07-21"
updated: "2026-07-21"
frontmatter_contract: "required"
execution_boundary: "dev-only"
publish_scope: "local-only"
source_contract: "docs/documents/knowgrph-game-fps-prd-tad.md"
workspace_seed: "docs/workspace-seeds/knowgrph-game-fps-demo.md"
candidate_commit: "pending"
deployment: "not authorized"
---

# Knowgrph Game FPS Runtime Readiness

This file is the evidence ledger for the local/Dev game increment. `verification-pending` means no runtime-ready claim has been made yet. Replace `pending` only with evidence produced at the exact candidate commit.

## Canonical commands

```bash
npm run game-fps:runtime-ready
npm run demo:game-fps
```

The focused command must cover game unit/integration tests, deterministic replay, Agentic ECS proof, Canvas type checking, a production-format local build, and workspace-seed validation. The demo command supports the separate local browser smoke. Neither command may deploy or require network access.

## Evidence ledger

| Gate | Required evidence | State |
|---|---|---|
| Source scope | One procedural map, four NPCs, one hitscan weapon, no new runtime dependency | pending |
| Determinism | Two identical seeds/input traces produce byte-identical canonical results | pending |
| Collision/weapon | Stable AABB resolution and nearest hitscan result | pending |
| NPC policy | Closed typed actions with stable tie-breaking and no reasoning request | pending |
| Cost | Exactly one canonical zero Cost_Log per successful no-reasoning tick | pending |
| Persistence | Decisions-only WorkspaceFs save, idempotent resume, retry retention | pending |
| Malformed save | Hydration blocks, bytes remain intact, only explicit reset replaces | pending |
| Canvas | One existing R3F Canvas, coherent HUD, game camera ownership released on exit | pending |
| Browser | Visible movement, look, fire, reaction, completion, save, reset, and retry behavior | pending |
| Network | No required request, remote asset fetch, model call, or Cloudflare call | pending |
| Integration | Focused checks and protected repository checks pass at candidate SHA | pending |
| Release | No Pages/Worker/Cloudflare deployment performed | pending |

## Browser smoke record

Record the candidate SHA, local URL, browser, viewport, actions, observable results, console errors, failed requests, and saved local path. A screenshot alone is insufficient; the record must distinguish source proof, runtime interaction, local persistence, and deployment state.

## Promotion rule

After every row above passes at one commit, update this file, the PRD, and the workspace seed together from `implementation-pending`/`verification-pending` to `runtime-ready`. A local runtime-ready result does not authorize production, Cloudflare, or public-surface claims.
