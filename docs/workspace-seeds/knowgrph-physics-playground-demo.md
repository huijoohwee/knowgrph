---
title: "Knowgrph Native XR Physics Playground"
doc_type: "Workspace Demo"
status: "runtime-ready"
runtime_status: "runtime-ready"
game_mode_xr_fidelity_status: "local PR #273 candidate passed; protected integration pending"
publish_scope: "local-only"
kgCanvasSurfaceMode: "xr"
kgCanvasRenderMode: "3d"
kgCanvas3dMode: "xr"
kgFloatingPanelOpen: true
kgFloatingPanelView: "motionControl"
kgBottomPanelOpen: false
kgBottomPanelTab: "timeline"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
kgDocumentStructureBaselineLock: false
run_ready_demo:
  id: "xr-physics"
  activation: "applied-source-document"
  identity_authority: "source-authored run_ready_demo.id"
  imported_path_alias_required: false
  identity_conflict: "fail closed when path and source identity disagree"
  dev_command: "npm run dev"
  canonical_source_file: "/docs/workspace-seeds/knowgrph-physics-playground-demo.md"
  env_selector: "VITE_KNOWGRPH_RUN_READY_DEMO=xr-physics"
  validation_seed_path: "/knowgrph-physics-playground-demo.md"
  source_root: "knowgrph/docs"
  source_backed: true
  clean_canvas_recommended: true
  native_runtime: true
  presentation: "full-frame-playground"
  document_presentation: "workspace-playground"
  auto_start: true
  external_dependencies: []
native_controller_demo:
  runtime_owner: "XR Simulation workbench"
  default_controller: "ball"
  controller_switching: "preserve active body pose and velocity"
  deterministic_step: true
  camera_mode: "fixed-follow"
  camera:
    default: "fixed-follow"
    selector: "FloatingPanel Camera / SHOOT / Camera source"
    available: ["fixed-follow", "free-orbit"]
    invocation: "/camera.select @camera #camera camera=fixed-follow|free-orbit"
    timeline_override: "camera-mark playback temporarily owns framing"
  scene: "procedural Singapore waterfront terrain"
  terrain:
    default: "singapore"
    selector: "XR Terrain / Environment catalog"
    future_provisioning: "catalog-driven stable terrain IDs"
    available: ["singapore", "tropical-playground"]
  asset_library:
    default: "vehicle-helicopter"
    featured: ["vehicle-helicopter", "vehicle-airplane", "vehicle-sedan", "prop-ball"]
  objective: "collect key then unlock treasure"
  interactive_props: ["barrels", "bowling pins", "cannonballs"]
  controllers:
    - id: "ball"
      presentation: "procedural sphere"
      behaviors: ["rolling movement", "grounded jump", "air control", "modifier torque"]
    - id: "rocket"
      presentation: "procedural rocket"
      behaviors: ["directional thrust", "vertical thrust", "bounded tilt", "modifier stabilization"]
  input:
    keyboard:
      movement: ["W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]
      primary: "Space"
      modifier: "Shift"
    gamepad:
      movement: "standard left stick"
      primary: "standard primary action"
      modifier: "standard shoulder action"
  lifecycle: ["develop-and-run", "pause", "resume", "reset", "exit"]
motion_control:
  runtime: "browser-local LiteRT.js"
  model: "Google BlazePose GHUM Full"
  permission: "explicit Start action"
  frame_upload: false
  frame_persistence: false
  xr_drivers: ["native physics controller", "selected humanoid pose"]
  invocation: "/motion.control @canvas #pose operation=start backend=auto"
  inspect_tool: "knowgrph.inspect_local_motion_control"
  control_tool: "knowgrph.control_local_motion_control"
  game_mode_role: "optional normalized player input only; never the NPC decision policy"
game_mode:
  companion_view: "gameMode"
  invocation: "/game.mode @canvas #gameplay operation=open"
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
  lifecycle: "retain the authored XR scene while suspending its controller input and simulation; restore both on exit"
  renderer_owner: "the existing React Three Fiber Canvas in shared XR Mode; never a second Canvas"
  scene_composition: "authored XR atmosphere, terrain, props, and paused frame plus the Game Mode first-person actor overlay; no fallback arena"
  spatial_profile: "reuse the authored stage placement, playable bounds, and ground-obstructing native-controller static colliders; admit deterministic clear spawns and replace stale surface/terrain profiles"
  simulation_clock: "ready at tick zero until normalized desktop, pointer, touch, Motion Control, or MCP input"
  webgl_gate: "synchronous probe; fail closed on the local fallback surface"
  stop_start: "resume the exact in-memory mission tick and state"
  decision_persistence: "browser-local WorkspaceFs; terminal Decisions remain pending until explicit Save and are never auto-saved"
  malformed_hydration: "preserve bytes and block Start and Restart until explicit Reset"
  validation_input_forbid_hardcode_in_repo: true
kgXrMotionReference:
  schema: "knowgrph-xr-motion-reference/v1"
  stageId: "singapore"
  durationSeconds: 6
  fps: 12
  subjects:
    - id: "xr-subject:vehicle-helicopter:1"
      assetId: "vehicle-helicopter"
      label: "Helicopter"
      color: "#f59e0b"
      position: [7.2, 0.55, 2.1]
      rotationYDegrees: -31.5
      scale: 0.42
    - id: "xr-subject:vehicle-airplane:1"
      assetId: "vehicle-airplane"
      label: "Airplane"
      color: "#cbd5e1"
      position: [-7.4, 4.8, -3.8]
      rotationYDegrees: 17
      scale: 0.28
    - id: "xr-subject:vehicle-sedan:1"
      assetId: "vehicle-sedan"
      label: "Car"
      color: "#60a5fa"
      position: [-5.6, 0.15, 3.8]
      rotationYDegrees: -24
      scale: 0.82
  cast:
    - actorId: "xr-subject:vehicle-helicopter:1"
      label: "Helicopter"
      animation: null
      marks:
        - timeSeconds: 0
          position: [7.2, 0.55, 2.1]
          transition: "hold"
          gait: "flight"
    - actorId: "xr-subject:vehicle-airplane:1"
      label: "Airplane"
      animation: null
      marks:
        - timeSeconds: 0
          position: [-7.4, 4.8, -3.8]
          transition: "hold"
          gait: "flight"
    - actorId: "xr-subject:vehicle-sedan:1"
      label: "Car"
      animation: null
      marks:
        - timeSeconds: 0
          position: [-5.6, 0.15, 3.8]
          transition: "hold"
          gait: "wheeled"
  camera: []
runtime_validation:
  candidate_commit: "067ed16d0a8c77d1c612d6f63aa791ae02fba19c"
  verified_at: "2026-07-21T07:01:46Z"
  mode_activation: ["xr surface", "3d renderer", "xr stage"]
  required_states: ["ready", "running", "paused"]
  controller_parity: ["ball", "rocket"]
  replayable: true
  local_assets_only: true
  required_external_calls: false
  editor_chrome: true
  dedicated_editor_chrome: false
  validation_input_locator_persisted: false
  external_proof: "operator-supplied public document bytes were read into the localhost candidate; no deploy or public mutation occurred"
mcp_control:
  inspect_tool: "knowgrph.inspect_local_xr_scene_assets"
  control_tool: "knowgrph.control_local_xr_scene"
  launch: "/xr.physics @canvas #controller operation=develop-run mode=ball"
  switch: "/xr.physics @canvas #controller operation=select mode=rocket"
  reset: "/xr.physics @canvas #controller operation=reset"
flow:
  direction: "LR"
  edgeType: "smoothstep"
  nodes:
    - id: "xr_demo_entry"
      type: "XrDemoControl"
      label: "Develop and Run"
      pos: {x: -420, y: 0}
      properties:
        role: "lifecycle"
        state: "runtime-ready"
        output: "Apply this Source Files document to launch the native demo, then switch controllers without resetting motion."
    - id: "xr_ball_controller"
      type: "XrDemoController"
      label: "Ball Controller"
      pos: {x: 0, y: -180}
      properties:
        role: "controller"
        controllerId: "ball"
        output: "Roll, jump, steer in air, and apply modifier torque."
    - id: "xr_rocket_controller"
      type: "XrDemoController"
      label: "Rocket Controller"
      pos: {x: 0, y: 180}
      properties:
        role: "controller"
        controllerId: "rocket"
        output: "Thrust, tilt, steer laterally, and stabilize with the modifier."
    - id: "xr_runtime_gate"
      type: "XrDemoValidation"
      label: "Native Runtime Gate"
      pos: {x: 440, y: 0}
      properties:
        role: "validation"
        state: "runtime-ready"
        output: "Verify deterministic stepping, controller switching, camera follow, keyboard input, and gamepad input."
  connections:
    - from: "xr_demo_entry"
      to: "xr_ball_controller"
      label: "select ball"
    - from: "xr_demo_entry"
      to: "xr_rocket_controller"
      label: "select rocket"
    - from: "xr_ball_controller"
      to: "xr_runtime_gate"
      label: "validate"
    - from: "xr_rocket_controller"
      to: "xr_runtime_gate"
      label: "validate"
---

# Native XR Physics Playground

This Source Files document activates a playable XR physics playground inside the normal Knowgrph workspace. The default Singapore waterfront terrain, player presentations, physics stepping, inputs, controller switching, objective loop, and selectable camera source are owned by Knowgrph runtime modules and need no remote service or downloaded asset.

## Run

From the repository root, run `npm run dev`. In Knowgrph, open **Explorer → Source Files → docs → workspace-seeds → knowgrph-physics-playground-demo.md**. Applying this document starts the Beach Ball, playground, camera, and bottom vehicle switcher automatically while Explorer remains available.

## Controls

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Move or steer | W/A/S/D or arrow keys | Left stick |
| Jump or vertical thrust | Space | Primary action |
| Torque or stabilization | Shift | Shoulder action |
| Switch controller | Ball / Rocket buttons | Simulation controls |

The same runtime is MCP-controllable through `knowgrph.control_local_xr_scene`; use `/xr.physics @canvas #controller operation=develop-run mode=ball`, then `operation=select mode=rocket`, `operation=pause`, `operation=resume`, or `operation=reset`. While this document remains applied, an `exit` transition is immediately reclaimed as a fresh Ball run so the authored editor preview cannot replace the native stage. Applying another document releases the document-owned runtime.

**FloatingPanel → Game Mode** is a companion surface on the same React Three Fiber Canvas. Its native invocation prefix is exactly `/game.mode @canvas #gameplay`; add one supported operation from **Open**, **Start**, **Stop**, **Restart**, **Fire**, **Reload**, **Save**, or **Exit**. Browser-local WebMCP exposes schema `knowgrph-game-mode-mcp/v1` through `knowgrph.inspect_local_game_mode` and `knowgrph.control_local_game_mode`. The synchronous WebGL probe fails closed before mission start and exposes a visible local fallback without a second or remote renderer.

Opening Game Mode while XR owns the surface keeps the authored atmosphere, Singapore terrain, props, and exact paused frame visibly mounted in the same Canvas. Only the first-person gameplay camera and actor overlay change; the fallback arena is not mounted. Start prepares a healthy tick-zero frame and waits for normalized desktop, pointer, touch, Motion Control, or MCP engagement before deterministic ticks begin. Stop followed by Start resumes the exact in-memory Game Mode tick and state. Exiting restores XR input and simulation ownership so its deterministic stage continues. Motion Control remains an optional normalized player-input source only; its camera/LiteRT pipeline never becomes the four-action NPC decision policy.

Terminal Game Mode results remain pending and are not auto-saved. **Save** is the only operation that persists validated game Decisions through browser-local WorkspaceFs. Malformed saved bytes remain intact and block **Start** and **Restart** until the operator explicitly chooses **Reset local save**.

Camera source is independent of controller and object selection. In **FloatingPanel Camera → SHOOT**, choose **Fixed Follow** for stage-aware tracking or **Free Orbit** for direct pan, rotate, and zoom. The same choice is invocable through `knowgrph.control_local_camera` with `/camera.select @camera #camera camera=fixed-follow` or `camera=free-orbit`. Timeline camera-mark playback temporarily takes framing ownership, then returns to the selected source.

The ball rolls across the terrain, jumps only from supported contact, retains bounded air steering, and exposes a stronger torque response while the modifier is held. The rocket applies directional and vertical thrust, visualizes bounded tilt and live exhaust, dampens rotation, and uses the modifier to stabilize toward upright. Rocket altitude stays within the authored terrain scale while the single camera raises and widens into a bounded aerial composition of the procedural Singapore waterfront and skyline.

XR authoring uses the same persisted scene owner. **Terrain / Environment** defaults to **Singapore** and remains catalog-driven for future terrain IDs. The Singapore first frame is a native procedural waterfront composition with Marina Bay towers, the Singapore Flyer, Gardens by the Bay, and source-authored selectable **Helicopter**, **Airplane**, and **Car** subjects. Those subjects use the same persisted 3D Objects / Assets path as anything placed from Media: select them on the Canvas, frame them with Camera, transform or replace their catalog asset, and remove them without a parallel showcase state. **Add 3D Object / Asset** defaults to **Helicopter** and exposes **Helicopter**, **Airplane**, **Car**, and **Ball** as native procedural library choices. Placed subjects remain visible while the controller demo runs and can change asset without changing subject ID, transform, custom label, or persistence path; untouched catalog-default labels and colors follow the selected asset. Buildings, landmark trees, roads, and waterfront geometry remain fixed environment-kit set dressing rather than selectable subjects.

Find the procedural key near the grotto, then return to the treasure chest to unlock it. Barrels, bowling pins, and timed cannonballs share the same deterministic collision world with both vehicles. Press `R` to restore the Beach Ball, player, interactive props, key, treasure, and selected objective state.

Switching between Ball and Rocket changes the active controller and procedural presentation while preserving the simulated body position and velocity. Pause, Resume, and Reset remain deterministic lifecycle actions. Fixed Follow eases toward the active body without creating a second camera owner; selecting Helicopter, Airplane, Car, or another authored object does not change the camera source.

## Demo-ready checks

- [x] Source-backed seed activates XR, 3D rendering, and the canonical XR stage.
- [x] Ball and rocket behaviors run through one native physics owner.
- [x] Keyboard and standard gamepad inputs normalize to one controller state.
- [x] Controller switching preserves pose and velocity.
- [x] Fixed Follow and Free Orbit are user-selectable through Camera and `/camera.select`; Timeline playback remains the temporary higher-priority framing owner.
- [x] Normal `npm run dev` exposes this canonical Source Files document exactly once.
- [x] Applying the document keeps Explorer available and starts with Beach Ball selected.
- [x] Procedural Singapore terrain, landmark skyline, source-authored selectable vehicle subjects, key-to-treasure objective, cannons, barrels, and pins are local runtime content.
- [x] Default Helicopter, Airplane, Car, and Ball asset choices are local catalog content with no downloaded models.
- [x] FloatingPanel Game Mode reuses the same 3D/shared-XR Canvas and provides Open, Start, Stop, Restart, Fire, Reload, Save, and Exit.
- [x] Strict `/game.mode @canvas #gameplay` invocation and browser-local WebMCP schema/tools reject duplicate or conflicting bindings.
- [x] Local PR #273 candidate: Game Mode retains the authored XR world and atmosphere, shares its placement/collider catalog, suppresses the fallback arena, and restores the exact continuing XR frame on Exit. Protected integration is pending.
- [x] Local PR #273 candidate: every catalogued XR terrain/environment filters walkable-low and overhead slabs, admits clear player/NPC spawns, and replaces stale live/stopped spatial profiles. Protected integration is pending.
- [x] Local PR #273 candidate: Game Mode remains healthy at tick zero until normalized input, and Stop/Start preserves exact in-memory state. Protected integration is pending.
- [x] Motion Control is optional player input only; NPCs retain the deterministic four-action scored policy.
- [x] Terminal Decisions remain pending until explicit Save; malformed hydration blocks Start and Restart until explicit Reset.
- [x] Source-authored `run_ready_demo.id` owns imported activation without a path alias and conflicts fail closed.
- [x] Separate compatibility proof read operator-supplied public document bytes into the localhost candidate; it did not deploy or mutate a public document.
- [x] No remote assets, provider calls, or external runtime dependencies are required.
