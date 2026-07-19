---
title: "Knowgrph Native XR Physics Playground"
doc_type: "Workspace Demo"
status: "runtime-ready"
runtime_status: "runtime-ready"
publish_scope: "local-only"
kgCanvasSurfaceMode: "xr"
kgCanvasRenderMode: "3d"
kgCanvas3dMode: "xr"
kgFloatingPanelOpen: false
kgFloatingPanelView: "media"
kgBottomPanelOpen: false
kgBottomPanelTab: "timeline"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
kgDocumentStructureBaselineLock: false
run_ready_demo:
  id: "xr-physics"
  env_selector: "VITE_KNOWGRPH_RUN_READY_DEMO=xr-physics"
  validation_seed_path: "/knowgrph-physics-playground-demo.md"
  source_root: "knowgrph/docs"
  source_backed: true
  clean_canvas_recommended: true
  native_runtime: true
  presentation: "full-frame-playground"
  auto_start: true
  external_dependencies: []
native_controller_demo:
  runtime_owner: "XR Simulation workbench"
  default_controller: "ball"
  controller_switching: "preserve active body pose and velocity"
  deterministic_step: true
  camera_mode: "smooth follow"
  scene: "procedural tropical island"
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
runtime_validation:
  mode_activation: ["xr surface", "3d renderer", "xr stage"]
  required_states: ["ready", "running", "paused"]
  controller_parity: ["ball", "rocket"]
  replayable: true
  local_assets_only: true
  external_calls: false
  editor_chrome: false
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
        output: "Launch directly into the full-frame native demo, then switch controllers without resetting motion."
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

This workspace opens directly as a full-frame, playable XR physics playground. The tropical island, player presentations, physics stepping, inputs, controller switching, objective loop, and follow camera are owned by Knowgrph runtime modules and need no remote service or downloaded asset.

## Run

From the repository root, run `npm run demo:xr-physics`. The Beach Ball, playground, camera, and bottom vehicle switcher start automatically with no editor interaction.

## Controls

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Move or steer | W/A/S/D or arrow keys | Left stick |
| Jump or vertical thrust | Space | Primary action |
| Torque or stabilization | Shift | Shoulder action |
| Switch controller | Ball / Rocket buttons | Simulation controls |

The same runtime is MCP-controllable through `knowgrph.control_local_xr_scene`; use `/xr.physics @canvas #controller operation=develop-run mode=ball`, then `operation=select mode=rocket`, `operation=pause`, `operation=resume`, `operation=reset`, or `operation=exit`.

The ball rolls across the sand, jumps only from supported contact, retains bounded air steering, and exposes a stronger torque response while the modifier is held. The rocket applies directional and vertical thrust, visualizes bounded tilt and live exhaust, dampens rotation, and uses the modifier to stabilize toward upright.

Find the procedural key near the grotto, then return to the treasure chest to unlock it. Barrels, bowling pins, and timed cannonballs share the same deterministic collision world with both vehicles. Press `R` to restore the Beach Ball, player, interactive props, key, treasure, and selected objective state.

Switching between Ball and Rocket changes the active controller and procedural presentation while preserving the simulated body position and velocity. Pause, Resume, Reset, and Exit remain deterministic lifecycle actions. The follow camera eases toward the active body without creating a second camera owner.

## Demo-ready checks

- [x] Source-backed seed activates XR, 3D rendering, and the canonical XR stage.
- [x] Ball and rocket behaviors run through one native physics owner.
- [x] Keyboard and standard gamepad inputs normalize to one controller state.
- [x] Controller switching preserves pose and velocity.
- [x] Smooth follow camera respects the shared camera owner.
- [x] Full-frame launch hides editor chrome and starts with Beach Ball selected.
- [x] Procedural island, key-to-treasure objective, cannons, barrels, and pins are local runtime content.
- [x] No remote assets, provider calls, or external runtime dependencies are required.
