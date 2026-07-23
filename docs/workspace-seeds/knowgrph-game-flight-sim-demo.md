---
title: "Knowgrph Native Flight Sim"
doc_type: "Workspace Demo"
status: "runtime-ready"
runtime_status: "runtime-ready"
runtime_claim: "local-runtime-ready"
publish_scope: "local-only"
kgCanvasSurfaceMode: "xr"
kgCanvasRenderMode: "3d"
kgCanvas3dMode: "xr"
kgFloatingPanelOpen: true
kgFloatingPanelView: "flightSim"
kgBottomPanelOpen: false
kgBottomPanelTab: "timeline"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
kgDocumentStructureBaselineLock: false
run_ready_demo:
  id: "flight-sim"
  activation: "applied-source-document"
  identity_authority: "source-authored run_ready_demo.id"
  imported_path_alias_required: false
  identity_conflict: "fail closed when path and source identity disagree"
  canonical_consumers: ["workspace", "xr-mode"]
  dev_command: "npm run dev"
  canonical_source_file: "/docs/workspace-seeds/knowgrph-game-flight-sim-demo.md"
  env_selector: "VITE_KNOWGRPH_RUN_READY_DEMO=flight-sim"
  validation_seed_path: "/knowgrph-game-flight-sim-demo.md"
  source_root: "knowgrph/docs"
  source_backed: true
  clean_canvas_recommended: true
  native_runtime: true
  presentation: "shared-xr-gameplay-overlay"
  document_presentation: "runtime-ready-workspace-demo"
  auto_start: true
  external_dependencies: []
  forbid_external_copy_or_dependency: true
shared_xr_scene:
  source_authority: "/docs/workspace-seeds/knowgrph-physics-playground-demo.md"
  world_ownership: "overlay-only"
  surface_owner: "XR Mode"
  renderer_owner: "canvas/src/lib/three/ThreeGraph.impl.tsx"
  collider_owner: "canvas/src/features/three/xrCanonicalSceneSpatialSource.ts"
  camera_owner: "canvas/src/features/three/useXrNativeControllerDemoCamera.ts"
  second_canvas_forbidden: true
native_flight_demo:
  runtime_owner: "Flight Sim surface on the shared XR Canvas"
  default_aircraft: "vehicle-airplane"
  deterministic_step: true
  flight_model: "in-repo thrust/pitch/roll/yaw with bounded lift/drag/gravity approximation; no external physics engine"
  collision: "authored XR AABB slab catalog (shared canonical spatial source); no mesh colliders or navmesh"
  camera_mode: "fixed-follow"
  camera:
    default: "fixed-follow"
    selector: "FloatingPanel Camera / SHOOT / Camera source"
    available: ["fixed-follow", "free-orbit"]
    invocation: "/camera.select @camera #camera camera=fixed-follow|free-orbit"
    timeline_override: "camera-mark playback temporarily owns framing"
    catalog_owner: "canvas/src/features/three/xrNativeControllerCameraCatalog.ts"
    selection_owner: "canvas/src/features/three/xrNativeControllerCameraRuntime.ts"
    driver_owner: "canvas/src/features/three/useXrNativeControllerDemoCamera.ts"
    follow_target: "Flight supplies a pure aircraft follow/framing descriptor; the shared Physics controller hook alone mutates the camera and OrbitControls"
  scene: "procedural Singapore waterfront terrain"
  terrain:
    default: "singapore"
    selector: "XR Terrain / Environment catalog"
    available: ["singapore", "tropical-playground"]
  objective: "complete the bounded waypoint route"
  interactive_props: ["waypoint rings"]
  input:
    keyboard:
      pitch_roll: ["W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]
      throttle_up: "Shift"
      throttle_down: "Control"
      yaw: ["Q", "E"]
    touch: "direction buttons + throttle slider"
    gamepad:
      pitch_roll: "standard left stick"
      yaw: "standard shoulder axes"
      throttle: "standard triggers"
  lifecycle: ["develop-and-run", "pause", "resume", "reset", "exit"]
asset_pipeline:
  primary: "img2threejs-style TypeScript + JSON Must-aircraft scene spec (small, diffable, committed in-repo, offline-loadable)"
  admission: "only the exact TypeScript+JSON vehicle-airplane spec is admitted in Must scope"
  opaque_binary_fallback: "not admitted in Must scope; non-null fallback metadata fails closed"
  glb_fallback_count: 0
  runtime_model_calls: 0
  runtime_network_calls: 0
  authoring_step: "offline only; no image-to-3D model, network fetch, or Cloudflare resource is invoked at runtime to obtain any asset"
  diffability: "the Must aircraft is TypeScript+JSON; GLB fallback count is exactly zero"
  native_in_repo: true
  forbid_external_copy_or_dependency: true
  inspiration_reference_only: "flight-simulator (inspiration only; no source copy, no dependency)"
motion_control:
  runtime: "browser-local LiteRT.js"
  model: "Google BlazePose GHUM Full"
  permission: "explicit Start action"
  frame_upload: false
  frame_persistence: false
  flight_role: "optional normalized player input only; never the flight control policy"
  invocation: "/motion.control @canvas #pose operation=start backend=auto"
flight_sim:
  companion_view: "flightSim"
  invocation: "/flight.sim @canvas #flight operation=open"
  invocation_prefix: "/flight.sim @canvas #flight"
  invocation_policy: "exactly one /flight.sim command, one @canvas binding, and one #flight semantic"
  operations: ["open", "start", "stop", "restart", "throttle", "save", "exit"]
  operation_invocations:
    open: "/flight.sim @canvas #flight operation=open"
    start: "/flight.sim @canvas #flight operation=start"
    stop: "/flight.sim @canvas #flight operation=stop"
    restart: "/flight.sim @canvas #flight operation=restart"
    throttle: "/flight.sim @canvas #flight operation=throttle throttle=0.75"
    save: "/flight.sim @canvas #flight operation=save"
    exit: "/flight.sim @canvas #flight operation=exit"
  web_mcp_schema: "knowgrph-flight-sim-mcp/v1"
  inspect_tool: "knowgrph.inspect_local_flight_sim"
  control_tool: "knowgrph.control_local_flight_sim"
  lifecycle: "retain the authored XR scene while suspending its controller input and simulation; restore both on exit"
  controller_handoff: "supply a pure aircraft follow/framing descriptor to the shared Physics controller camera; never mount a Flight-owned camera"
  renderer_owner: "the existing React Three Fiber Canvas in shared XR Mode; never a second Canvas"
  scene_composition: "authored XR atmosphere, terrain, and props plus Flight aircraft and waypoint/objective actors with the HUD overlay; no fallback arena or Flight-owned camera"
  simulation_clock: "ready at tick zero until normalized desktop, pointer, touch, gamepad, Motion Control, or MCP input"
  webgl_gate: "synchronous probe; fail closed on the local fallback surface"
  stop_start: "resume the exact in-memory mission tick and state"
  decision_persistence: "browser-local WorkspaceFs; terminal Decisions remain pending until explicit Save and are never auto-saved"
  malformed_hydration: "preserve bytes and block Start and Restart until explicit Reset"
  validation_input_forbid_hardcode_in_repo: true
runtime_validation:
  mode_activation: ["xr surface", "3d renderer", "xr stage"]
  required_states: ["ready", "running", "paused"]
  aircraft_parity: ["vehicle-airplane"]
  replayable: true
  local_assets_only: true
  required_external_calls: false
  asset_spec_primary: true
  glb_fallback_count: 0
  glb_fallback_runtime: "not admitted in Must scope"
  editor_chrome: true
  status: "repository-owned source/runtime proof passed; protected integration pending"
mcp_control:
  inspect_tool: "knowgrph.inspect_local_flight_sim"
  control_tool: "knowgrph.control_local_flight_sim"
  launch: "/flight.sim @canvas #flight operation=open"
  start: "/flight.sim @canvas #flight operation=start"
  reset: "/flight.sim @canvas #flight operation=restart"
flow:
  direction: {key: direction, type: string, value: "LR"}
  edgeType: {key: edgeType, type: string, value: "smoothstep"}
  balancedViewportPreset: {key: balancedViewportPreset, type: string, value: "widgetFrontmatter"}
  nodes:
    - id: {key: id, type: string, value: "flight_demo_entry"}
      type: {key: type, type: string, value: "FlightDemoControl"}
      label: {key: label, type: string, value: "Launch and Fly"}
      position: {key: position, type: object, value: {"x":0,"y":-360}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_demo_entry"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Apply this source to open the local Flight Sim on the canonical authored XR world."}
      role: {key: role, type: string, value: "lifecycle"}
      state: {key: state, type: string, value: "ready"}
    - id: {key: id, type: string, value: "flight_aircraft"}
      type: {key: type, type: string, value: "FlightDemoAircraft"}
      label: {key: label, type: string, value: "Airplane"}
      position: {key: position, type: object, value: {"x":0,"y":-120}}
      aircraftId: {key: aircraftId, type: string, value: "vehicle-airplane"}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_aircraft"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Fly with deterministic throttle, pitch, roll, and yaw under bounded in-repo dynamics."}
      role: {key: role, type: string, value: "controller"}
    - id: {key: id, type: string, value: "flight_asset_spec"}
      type: {key: type, type: string, value: "FlightDemoAssetSpec"}
      label: {key: label, type: string, value: "Asset Spec (img2threejs-style)"}
      position: {key: position, type: object, value: {"x":0,"y":120}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_asset_spec"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Load the committed diffable TypeScript+JSON aircraft spec; no opaque fallback is needed for this mission."}
      role: {key: role, type: string, value: "asset"}
    - id: {key: id, type: string, value: "flight_runtime_gate"}
      type: {key: type, type: string, value: "FlightDemoValidation"}
      label: {key: label, type: string, value: "Runtime Readiness"}
      position: {key: position, type: object, value: {"x":0,"y":360}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_runtime_gate"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Repository gates cover deterministic stepping, collision, input, Decisions-only persistence, strict invocation, and spec-primary loading."}
      role: {key: role, type: string, value: "validation"}
      state: {key: state, type: string, value: "ready"}
  edges:
---

# Native Flight Sim in XR Mode

This Source Files document is the local XR Mode runtime authority for one deterministic, browser-local flight mission. Applying it opens **Flight Sim** on the canonical Physics-authored XR world, prepares a healthy mission at tick zero, and waits for normalized input. It does not create another Canvas, renderer, terrain, collider catalog, camera driver, rendered XR world or scene owner, persistence owner, or deployment surface.

## Run locally

From the repository root, run `npm run dev`. In Knowgrph, open **Explorer → Source Files → docs → workspace-seeds → knowgrph-game-flight-sim-demo.md** and apply the document. The source-authored `run_ready_demo.id: flight-sim` activates XR/3D and the Flight Sim panel; an imported path is not required, and a conflicting known path fails closed.

## Controls

| Action | Keyboard | Touch | Standard gamepad |
|---|---|---|---|
| Pitch / roll | W/A/S/D or arrow keys | Discrete Pitch/Roll buttons | Left stick |
| Yaw | Q / E | Discrete Yaw buttons | Shoulder buttons |
| Throttle up / down | Shift / Control | Throttle slider | Triggers |
| Pause / Resume / Reset | HUD or FloatingPanel controls | HUD or FloatingPanel controls | HUD or FloatingPanel controls |

The browser-local control contract uses `knowgrph.control_local_flight_sim` and strict `/flight.sim @canvas #flight`, with schema `knowgrph-flight-sim-mcp/v1`. Throttle is explicit: `/flight.sim @canvas #flight operation=throttle throttle=0.75`. Duplicate sigils, unknown keys, mixed native/structured input, and invalid lifecycle operations fail closed.

**FloatingPanel → Flight Sim** controls Open, Start, Stop, Restart, Throttle, Save, and Exit. The panel projects runtime state only; the aircraft stage remains actor-only inside the shared renderer.

Camera source is independent of aircraft selection. In **FloatingPanel Camera → SHOOT**, choose **Fixed Follow** for stage-aware aircraft tracking or **Free Orbit** for direct pan, rotate, and zoom. The same shared catalog is invocable through `knowgrph.control_local_camera` with `/camera.select @camera #camera camera=fixed-follow` or `camera=free-orbit`. Flight supplies a pure aircraft follow/framing descriptor; the Physics controller hook alone mutates the camera and OrbitControls. Timeline camera-mark playback temporarily takes framing ownership, then returns to the selected source. Motion Control is optional normalized player input only and never becomes flight policy.

Terminal results remain pending and never auto-save. **Save** is the only operation that persists validated Decisions through browser-local WorkspaceFs at `/game-flight-sim/mission-1-decisions.md`. Malformed bytes remain intact and block Start and Restart until **Reset local save** succeeds.

## Asset pipeline

The aircraft loads from committed img2threejs-style TypeScript plus `vehicle-airplane.scene.json`: small, diffable, human-auditable, and offline. The Must scope admits only that exact spec, rejects non-null opaque fallback metadata, and has GLB fallback count zero. A future local GLB exception would require separate implementation and proof. Runtime code performs no image-to-3D model call, asset fetch, or Cloudflare request. The feature framing takes inspiration from an external flight-sim project but copies none of its source and has no dependency on it.

## Runtime-readiness gates

- [x] Source identity is `flight-sim`, independent of import path, with conflict rejection.
- [x] Flight is an XR Mode overlay on the Physics source-authored world; it owns no second rendered XR world, scene owner, or Canvas.
- [x] Fixed Follow and Free Orbit come from the shared Camera catalog, and the Physics controller hook is the sole camera/OrbitControls mutator for the pure Flight framing descriptor.
- [x] `npm run game-flight-sim:runtime-ready` passes on the final candidate.
- [x] `npm run game-flight-sim:browser-smoke` passes serially on the same exact candidate revision.
- [ ] The protected PR integrates the verified candidate.

The unchecked gates are proof/release state, not missing runtime behavior. This scope authorizes no Agentic workspace-seed projection, Prod/Cloudflare deployment, or public release.
