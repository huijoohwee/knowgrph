---
title: "Knowgrph Game FPS Mission"
doc_type: "Workspace Demo"
status: "runtime-ready"
runtime_status: "runtime-ready"
game_mode_xr_fidelity_status: "protected PR #273 and exact-main acceptance passed"
publish_scope: "local-only"
execution_boundary: "dev-only"
kgCanvasRenderMode: "3d"
kgCanvasSurfaceMode: "xr"
kgCanvas3dMode: "xr"
kgFloatingPanelOpen: true
kgFloatingPanelView: "gameMode"
kgBottomPanelOpen: false
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
run_ready_demo:
  id: "game-fps"
  activation: "applied-source-document"
  identity_authority: "source-authored run_ready_demo.id"
  imported_path_alias_required: false
  identity_conflict: "fail closed when path and source identity disagree"
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
  map: "shared-authored-xr-scene"
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
game_mode:
  surface: "FloatingPanel Game Mode"
  invocation: "/game.mode @canvas #gameplay operation=start"
  invocation_prefix: "/game.mode @canvas #gameplay"
  invocation_policy: "exactly one /game.mode command, one @canvas binding, and one #gameplay semantic"
  operations: ["open", "start", "stop", "restart", "fire", "reload", "save", "exit"]
  operation_invocations:
    open: "/game.mode @canvas #gameplay operation=open"
    start: "/game.mode @canvas #gameplay operation=start"
    stop: "/game.mode @canvas #gameplay operation=stop"
    restart: "/game.mode @canvas #gameplay operation=restart"
    fire: "/game.mode @canvas #gameplay operation=fire"
    reload: "/game.mode @canvas #gameplay operation=reload"
    save: "/game.mode @canvas #gameplay operation=save"
    exit: "/game.mode @canvas #gameplay operation=exit"
  web_mcp_schema: "knowgrph-game-mode-mcp/v1"
  inspect_tool: "knowgrph.inspect_local_game_mode"
  control_tool: "knowgrph.control_local_game_mode"
  renderer_owner: "existing React Three Fiber Canvas"
  canvas_surfaces: ["xr"]
  scene_owner: "the canonical authored XR world shared by Canvas View Mode and FloatingPanel Media, Animation, Motion Control, Game Mode, and Camera"
  variant_policy: "the fallback scene and environment implementation is deleted; renamed, conditional, or alternate variants are forbidden"
  webgl_gate: "synchronous probe; fail closed with the local unsupported state without mounting another scene or renderer"
  simulation_clock: "ready until normalized desktop, pointer, touch, Motion Control, or MCP input arms deterministic ticks"
  stop_start: "resume the exact in-memory mission tick and state"
  hud: "lifecycle, mission, persistence, and runtime errors remain visible"
  motion_control_input: "optional shared pose-to-controller adapter only; never the NPC decision policy"
  xr_surface: "retain the paused authored XR scene under the first-person gameplay actor overlay; preserve that same scene across panel changes and restore XR input and simulation ownership on exit"
persistence:
  owner: "browser-local WorkspaceFs"
  format: "KGC EcsDecision nodes"
  writes: "explicit Save after a terminal result; never automatic"
  terminal_result: "validated Decisions remain pending until explicit Save"
  malformed_save: "preserve bytes and block Start and Restart until explicit Reset"
  write_failure: "retain pending Decisions and expose retry"
  repo_local_mirror: "best-effort existing Source Files bridge"
  automatic_git_commit: false
runtime_validation:
  validation_input_forbid_hardcode_in_repo: true
  validation_input_locator_persisted: false
  external_proof: "operator-supplied public document bytes were read into the local exact-main runtime; no deploy or public mutation occurred"
  baseline_protected_commit: "fbb615be92ea58e6e4cfc981feb2122ea81e79b2"
  baseline_verified_at: "2026-07-21T07:50:51Z"
  follow_up_pull_request: 273
  follow_up_protected_merge_commit: "0b0e70787edb80e71d368d56c1478ffd9655ce0d"
  exact_main_runtime_commit: "0b0e70787edb80e71d368d56c1478ffd9655ce0d"
  follow_up_verified_at: "2026-07-21T10:08:11Z"
  follow_up_status: "protected and exact-main acceptance passed"
  launch_states: ["idle", "loading", "ready", "error"]
  mission_states: ["stopped", "playing", "won", "lost"]
  persistence_states: ["idle", "saving", "saved", "error"]
  deterministic_replay: true
  local_assets_only: true
  gameplay_external_calls: false
  core_camera_permission: false
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
        output: "Apply this document to start the locally verified mission in the shared authored XR scene."
    - id: "game_fps_simulation"
      type: "GameFpsSimulation"
      label: "Deterministic Mission"
      pos: {x: 0, y: -120}
      properties:
        role: "runtime"
        output: "Run fixed ECS ticks, AABB collision, slab hitscan, and four scored NPC actions with no model or network."
    - id: "game_fps_save"
      type: "GameFpsPersistence"
      label: "Local Decisions Save"
      pos: {x: 0, y: 120}
      properties:
        role: "persistence"
        output: "Keep terminal Decisions pending until explicit Save through browser-local WorkspaceFs; retry writes or explicitly Reset malformed hydration."
    - id: "game_fps_gate"
      type: "GameFpsValidation"
      label: "Local Runtime Gate"
      pos: {x: 440, y: 0}
      properties:
        role: "validation"
        state: "runtime-ready"
        output: "Bind source, browser, determinism, cost, persistence, and no-deploy evidence to the exact tested runtime commit."
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

This source document is the canonical local activation contract for the bounded Game FPS mission. The focused, local-browser, and external-source gates passed for the pre-follow-up baseline at protected main commit `fbb615be92ea58e6e4cfc981feb2122ea81e79b2`, verified through `2026-07-21T07:50:51Z`. PR #273 then passed protected integration, and the authored-XR follow-up reran on exact main commit `0b0e70787edb80e71d368d56c1478ffd9655ce0d` through `2026-07-21T10:08:11Z`; the demo is runtime-ready for local/Dev use only, with no production deployment authorized.

## Run the runtime-ready demo

```bash
npm run demo:game-fps
```

Then open **Explorer → Source Files → docs → workspace-seeds → knowgrph-game-fps-demo.md** and apply this document. Activation is owned by the source-authored `run_ready_demo.id`; an imported document needs no hardcoded path alias and may use any non-conflicting path, while a path/source identity conflict fails closed. The mission reuses the selected authored XR terrain, props, placement, and collider catalog in the existing single Three renderer. Game Mode adds only its first-person camera and actor overlay; it owns no replacement environment.

Open **FloatingPanel → Game Mode** and use **Open**, **Start**, **Stop**, **Restart**, **Fire**, **Reload**, **Save**, and **Exit**. Start prepares a healthy tick-zero frame; the deterministic clock begins only after normalized player engagement. Stop followed by Start resumes the exact in-memory tick and mission state. Restart creates a fresh deterministic mission. The authored XR world stays visibly mounted and paused under the first-person gameplay overlay; Exit restores its input and simulation owner on the same Canvas. Switching among **Media**, **Animation**, **Motion Control**, **Game Mode**, and **Camera** changes only the FloatingPanel projection and never replaces that Canvas or world.

The native invocation prefix is exactly `/game.mode @canvas #gameplay`; add one supported `operation` value for control calls. Browser-local WebMCP exposes schema `knowgrph-game-mode-mcp/v1` through `knowgrph.inspect_local_game_mode` and `knowgrph.control_local_game_mode`.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | W/A/S/D or arrow keys | Movement control |
| Look/aim | Pointer movement while the game stage owns input | Look control |
| Fire | Primary pointer action | Fire control |
| Reload | Reload control | Reload control |
| Stop / resume | Stop, then Start | Stop, then Start |
| Fresh mission | Restart button | Restart button |
| Persist terminal Decisions | Save button | Save button |
| Leave Game Mode | Exit button | Exit button |
| Retry failed save | Retry save button | Retry save button |

The exact visible labels are runtime-owned. The synchronous WebGL probe fails closed before mission start and leaves a visible local unsupported-state error without a second scene, Canvas, or remote renderer. Motion Control can optionally normalize pose input through the shared adapter, but it never selects NPC actions and the core mission never requests camera access. No action requests passkey, sign-in, model access, remote asset access, or Cloudflare connectivity.

Terminal mission results do not auto-save. Validated Decisions stay pending until **Save** is explicitly selected. A malformed saved document is preserved byte-for-byte and blocks **Start** and **Restart** until **Reset local save** is explicitly selected; a failed write retains pending Decisions for retry.

## Evidence state

- [x] Focused source tests and deterministic replay pass.
- [x] Agentic ECS model-free tick returns one canonical zero Cost_Log.
- [x] Canvas typecheck and production-format local build pass.
- [x] Local browser smoke proves movement, aim, fire, NPC reaction, completion, and HUD feedback.
- [x] FloatingPanel Game Mode owns Open, Start, Stop, Restart, Fire, Reload, Save, and Exit on the existing shared XR Canvas.
- [x] Protected PR #273 and exact-main proof: tick-zero health and Decisions remain stable until normalized player engagement; Stop/Start resumes exact in-memory state.
- [x] Protected PR #273 and exact-main proof: XR keeps its authored scene, atmosphere, props, placement, and collision catalog under Game Mode while its input/simulation pause and restore exactly on exit.
- [ ] Current scene-authority follow-up must prove the former fallback scene/environment source is deleted, alternate variants are statically forbidden, and Media, Animation, Motion Control, Game Mode, and Camera preserve one Canvas and authored XR world. PR #273's non-mount proof is historical and does not prove deletion.
- [x] Protected PR #273 and exact-main proof: every authored XR preset filters non-obstructing vertical slabs, admits clear player/NPC spawns, and replaces a stale live or stopped spatial profile before gameplay.
- [x] Terminal Decisions remain pending until explicit Save writes validated Decisions only through WorkspaceFs; no terminal auto-save exists.
- [x] Malformed KGC blocks Start and Restart until explicit Reset; write failure retains pending Decisions for retry.
- [x] The strict `/game.mode @canvas #gameplay` contract and browser-local WebMCP schema/tools reject duplicate or conflicting bindings.
- [x] Source-authored runtime identity activates imports without a path alias and fails closed on path/source conflict.
- [x] The synchronous WebGL gate and HUD expose unsupported and runtime-error states without a remote renderer.
- [x] Browser proof records zero non-local, local runtime-bridge, or Cloudflare requests; ordinary localhost application assets remain local build inputs.
- [x] Separate compatibility proof read operator-supplied public document bytes into the local exact-main runtime; it did not deploy or mutate a public document.
- [x] No deployment or automatic Git operation occurs.

Proof belongs in `docs/documents/knowgrph-game-fps-runtime-readiness.md`; do not turn these boxes green from source inspection alone.
