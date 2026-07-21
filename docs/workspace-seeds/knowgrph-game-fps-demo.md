---
title: "Knowgrph Game FPS Mission"
doc_type: "Workspace Demo"
status: "runtime-ready"
runtime_status: "runtime-ready"
publish_scope: "local-only"
execution_boundary: "dev-only"
kgCanvasRenderMode: "3d"
kgCanvas3dMode: "3d"
kgFloatingPanelOpen: false
kgBottomPanelOpen: false
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
run_ready_demo:
  id: "game-fps"
  activation: "applied-source-document"
  dev_command: "npm run demo:game-fps"
  readiness_command: "npm run game-fps:runtime-ready"
  canonical_source_file: "/docs/workspace-seeds/knowgrph-game-fps-demo.md"
  env_selector: "VITE_KNOWGRPH_RUN_READY_DEMO=game-fps"
  validation_seed_path: "/knowgrph-game-fps-demo.md"
  source_root: "knowgrph/docs"
  source_backed: true
  clean_canvas_recommended: true
  native_runtime: true
  presentation: "full-frame-playground"
  document_presentation: "workspace-playground"
  auto_start: true
  external_dependencies: []
mission:
  id: "mission-1"
  seed: 170721
  map: "procedural-training-yard"
  mode: "single-player"
  npc_count: 4
  weapon: "training-rifle"
  objective: "resolve four NPC encounters"
  simulation: "fixed-step"
  collision: "in-repo-aabb"
  weapon_resolution: "in-repo-hitscan"
  npc_actions: ["hold", "alert", "engage", "flee"]
  model_calls: 0
  network_required: false
persistence:
  owner: "browser-local WorkspaceFs"
  format: "KGC EcsDecision nodes"
  writes: "mission-completion Decisions only"
  malformed_save: "fail closed until explicit reset"
  write_failure: "retain pending Decisions and expose retry"
  repo_local_mirror: "best-effort existing Source Files bridge"
  automatic_git_commit: false
runtime_validation:
  candidate_commit: "db96d16921968d98afd8755437e507ac3a323322"
  verified_at: "2026-07-21T03:22:34Z"
  required_states: ["ready", "running", "complete", "save-error", "save-complete"]
  deterministic_replay: true
  local_assets_only: true
  external_calls: false
  camera_permission: false
  credentials_api: false
  cloudflare_calls: false
  deployment: false
flow:
  direction: "LR"
  edgeType: "smoothstep"
  nodes:
    - id: "game_fps_entry"
      type: "GameFpsControl"
      label: "Open Mission"
      pos: {x: -420, y: 0}
      properties:
        role: "lifecycle"
        state: "runtime-ready"
        output: "Apply this document to start the locally verified procedural mission."
    - id: "game_fps_simulation"
      type: "GameFpsSimulation"
      label: "Deterministic Mission"
      pos: {x: 0, y: -120}
      properties:
        role: "runtime"
        output: "Run fixed ECS ticks, AABB collision, hitscan, and four authored NPC policies with no model or network."
    - id: "game_fps_save"
      type: "GameFpsPersistence"
      label: "Local Decisions Save"
      pos: {x: 0, y: 120}
      properties:
        role: "persistence"
        output: "Persist validated completion Decisions through browser-local WorkspaceFs; retry or explicitly reset on failure."
    - id: "game_fps_gate"
      type: "GameFpsValidation"
      label: "Local Runtime Gate"
      pos: {x: 440, y: 0}
      properties:
        role: "validation"
        state: "runtime-ready"
        output: "Bind source, browser, determinism, cost, persistence, and no-deploy evidence to the candidate commit."
  connections:
    - from: "game_fps_entry"
      to: "game_fps_simulation"
      label: "play"
    - from: "game_fps_simulation"
      to: "game_fps_save"
      label: "complete"
    - from: "game_fps_simulation"
      to: "game_fps_gate"
      label: "verify runtime"
    - from: "game_fps_save"
      to: "game_fps_gate"
      label: "verify persistence"
---

# Knowgrph Game FPS Mission

This source document is the canonical local activation contract for the bounded Game FPS mission. The focused gate and local browser smoke passed at candidate commit `db96d16921968d98afd8755437e507ac3a323322`; the demo is runtime-ready for local/Dev use only.

## Run the runtime-ready demo

```bash
npm run demo:game-fps
```

Then open **Explorer → Source Files → docs → workspace-seeds → knowgrph-game-fps-demo.md** and apply this document. The mission must use only procedural in-repo geometry and the existing single Three renderer.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | W/A/S/D or arrow keys | Movement control |
| Look/aim | Pointer movement while the game stage owns input | Look control |
| Fire | Primary pointer action | Fire control |
| Reset mission | Reset button | Reset button |
| Retry failed save | Retry save button | Retry save button |

The exact visible labels are runtime-owned. No action requests camera, passkey, sign-in, model access, remote asset access, or Cloudflare connectivity.

## Evidence state

- [x] Focused source tests and deterministic replay pass.
- [x] Agentic ECS model-free tick returns one canonical zero Cost_Log.
- [x] Canvas typecheck and production-format local build pass.
- [x] Local browser smoke proves movement, aim, fire, NPC reaction, completion, and HUD feedback.
- [x] Mission completion writes validated Decisions only through WorkspaceFs.
- [x] Malformed KGC blocks hydration until explicit reset; write failure retains pending Decisions for retry.
- [x] Browser proof records zero non-local, local runtime-bridge, or Cloudflare requests; ordinary localhost application assets remain local build inputs.
- [x] No deployment or automatic Git operation occurs.

Proof belongs in `docs/documents/knowgrph-game-fps-runtime-readiness.md`; do not turn these boxes green from source inspection alone.
