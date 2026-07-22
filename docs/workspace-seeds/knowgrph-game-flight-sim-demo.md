---
title: "Knowgrph Native Flight Sim"
doc_type: "Workspace Demo"
status: "draft"
runtime_status: "draft"
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
planned_run_ready_demo:
  id: "flight-sim"
  activation: "applied-source-document"
  identity_authority: "future source-authored run_ready_demo.id after runtime-readiness approval"
  imported_path_alias_required: false
  identity_conflict: "fail closed when path and source identity disagree"
  dev_command: "npm run dev"
  canonical_source_file: "/docs/workspace-seeds/knowgrph-game-flight-sim-demo.md"
  env_selector: "VITE_KNOWGRPH_RUN_READY_DEMO=flight-sim"
  validation_seed_path: "/knowgrph-game-flight-sim-demo.md"
  source_root: "knowgrph/docs"
  source_backed: true
  clean_canvas_recommended: true
  native_runtime: true
  presentation: "full-frame-playground"
  document_presentation: "workspace-playground"
  auto_start: true
  external_dependencies: []
  forbid_external_copy_or_dependency: true
native_flight_demo:
  runtime_owner: "Flight Sim surface on the shared XR Canvas"
  default_aircraft: "vehicle-airplane"
  aircraft_switching: "preserve active body pose and velocity"
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
  scene: "procedural Singapore waterfront terrain"
  terrain:
    default: "singapore"
    selector: "XR Terrain / Environment catalog"
    available: ["singapore", "tropical-playground"]
  objective: "follow the waypoint route, then land on the marked pad"
  interactive_props: ["waypoint rings", "landing pad", "wind socks"]
  input:
    keyboard:
      pitch_roll: ["W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]
      throttle_up: "Shift"
      throttle_down: "Control"
      yaw: ["Q", "E"]
    touch: "virtual stick + throttle slider"
    gamepad:
      pitch_roll: "standard left stick"
      yaw: "standard shoulder axes"
      throttle: "standard triggers"
  lifecycle: ["develop-and-run", "pause", "resume", "reset", "exit"]
asset_pipeline:
  primary: "img2threejs TypeScript + JSON scene spec (small, diffable, committed in-repo, offline-loadable)"
  fallback: "TRELLIS.2 opaque binary GLB (committed local file, flagged opaque, used only where a spec is unavailable)"
  loader_preference: "prefer the TypeScript+JSON spec whenever both exist"
  runtime_model_calls: 0
  runtime_network_calls: 0
  authoring_step: "offline only; no image-to-3D model, network fetch, or Cloudflare resource is invoked at runtime to obtain any asset"
  diffability: "100% of demo aircraft/props are TypeScript+JSON specs; GLB fallback count tracked and minimized"
  native_in_repo: true
  forbid_external_copy_or_dependency: true
  inspiration_reference_only: "github.com/Arnie016/flight-simulator-fable5 (inspiration only; no source copy, no dependency)"
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
    throttle: "/flight.sim @canvas #flight operation=throttle"
    save: "/flight.sim @canvas #flight operation=save"
    exit: "/flight.sim @canvas #flight operation=exit"
  web_mcp_schema: "knowgrph-flight-sim-mcp/v1"
  inspect_tool: "knowgrph.inspect_local_flight_sim"
  control_tool: "knowgrph.control_local_flight_sim"
  lifecycle: "retain the authored XR scene while suspending its controller input and simulation; restore both on exit"
  renderer_owner: "the existing React Three Fiber Canvas in shared XR Mode; never a second Canvas"
  scene_composition: "authored XR atmosphere, terrain, and props plus the Flight Sim aircraft, flight camera, and HUD overlay; no fallback arena"
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
  glb_fallback_is_local_file: true
  editor_chrome: true
  status: "pending — no runtime-readiness proof exists yet for this draft module"
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
      label: {key: label, type: string, value: "Develop and Run"}
      position: {key: position, type: object, value: {"x":0,"y":-360}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_demo_entry"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Apply this Source Files document to launch the native flight demo over the authored XR terrain."}
      role: {key: role, type: string, value: "lifecycle"}
      state: {key: state, type: string, value: "draft"}
    - id: {key: id, type: string, value: "flight_aircraft"}
      type: {key: type, type: string, value: "FlightDemoAircraft"}
      label: {key: label, type: string, value: "Airplane"}
      position: {key: position, type: object, value: {"x":0,"y":-120}}
      aircraftId: {key: aircraftId, type: string, value: "vehicle-airplane"}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_aircraft"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Throttle, pitch, roll, yaw with bounded stable limits under in-repo flight dynamics."}
      role: {key: role, type: string, value: "controller"}
    - id: {key: id, type: string, value: "flight_asset_spec"}
      type: {key: type, type: string, value: "FlightDemoAssetSpec"}
      label: {key: label, type: string, value: "Asset Spec (img2threejs primary)"}
      position: {key: position, type: object, value: {"x":0,"y":120}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_asset_spec"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Load aircraft/props from committed diffable TypeScript+JSON specs; opaque TRELLIS.2 GLB only as a local fallback."}
      role: {key: role, type: string, value: "asset"}
    - id: {key: id, type: string, value: "flight_runtime_gate"}
      type: {key: type, type: string, value: "FlightDemoValidation"}
      label: {key: label, type: string, value: "Native Runtime Gate"}
      position: {key: position, type: object, value: {"x":0,"y":360}}
      "flow:widgetFormId": {key: "flow:widgetFormId", type: string, value: "fm:flight_runtime_gate"}
      "frontmatter:primitive": {key: "frontmatter:primitive", type: string, value: "node"}
      output: {key: output, type: string, value: "Verify deterministic stepping, flight dynamics, terrain collision, camera source, input, and asset-spec-primary loading."}
      role: {key: role, type: string, value: "validation"}
      state: {key: state, type: string, value: "draft"}
  edges:
---

# Native Flight Sim

This Source Files document activates a playable, browser-local flight simulator inside the normal Knowgrph workspace, over the same authored XR terrain the physics playground ships. The default Singapore waterfront terrain, aircraft presentation, flight dynamics, inputs, camera source, waypoint/landing objective, and HUD are owned by Knowgrph runtime modules and need no remote service or downloaded asset. This module is `draft`; no runtime-readiness proof exists yet.

## Run

From the repository root, run `npm run dev`. In Knowgrph, open **Explorer → Source Files → docs → workspace-seeds → knowgrph-game-flight-sim-demo.md**. Applying this document mounts the Flight Sim on the shared React Three Fiber Canvas over the authored Singapore terrain while Explorer remains available.

## Controls

| Action | Keyboard | Touch | Standard gamepad |
|---|---|---|---|
| Pitch / roll | W/A/S/D or arrow keys | Virtual stick | Left stick |
| Yaw | Q / E | Stick edge | Shoulder axes |
| Throttle up / down | Shift / Control | Throttle slider | Triggers |
| Pause / Resume / Reset | Simulation controls | Simulation controls | Simulation controls |

The same runtime is MCP-controllable through `knowgrph.control_local_flight_sim`; use `/flight.sim @canvas #flight operation=open`, then `operation=start`, `operation=throttle`, `operation=stop`, `operation=restart`, `operation=save`, or `operation=exit`. Exactly one `/flight.sim` command, one `@canvas` binding, and one `#flight` semantic are accepted; duplicate sigils, unknown keys, mixed structured/native input, and invalid lifecycle operations fail closed. Browser-local WebMCP exposes schema `knowgrph-flight-sim-mcp/v1` through `knowgrph.inspect_local_flight_sim` and `knowgrph.control_local_flight_sim`; it adds no stdio tool, HTTP mutation route, remote gateway, or deployment authority, and the private Agentic ECS stdio lane remains exactly three tools.

**FloatingPanel → Flight Sim** is a companion surface on the same Canvas. Opening it keeps the authored atmosphere, Singapore terrain, and props visibly mounted and overlays only the aircraft, flight camera, and HUD. The synchronous WebGL probe fails closed before mission start and exposes a visible local fallback without a second or remote renderer. Start prepares a healthy tick-zero frame and waits for normalized desktop, pointer, touch, gamepad, Motion Control, or MCP input before deterministic ticks begin. Stop followed by Start resumes the exact in-memory mission tick and state. Exiting restores the shared XR input and simulation ownership.

Camera source is independent of aircraft selection. In **FloatingPanel Camera → SHOOT**, choose **Fixed Follow** for stage-aware tracking or **Free Orbit** for direct pan, rotate, and zoom, or invoke `/camera.select @camera #camera camera=fixed-follow` / `camera=free-orbit`. Timeline camera-mark playback temporarily owns framing, then returns to the selected source. Motion Control remains an optional normalized player-input source only; its camera/LiteRT pose pipeline never becomes the flight control policy.

Terminal flight results remain pending and are not auto-saved. **Save** is the only operation that persists validated flight Decisions through browser-local WorkspaceFs. Malformed saved bytes remain intact and block **Start** and **Restart** until the operator explicitly chooses **Reset local save**.

## Asset pipeline (native, in-repo)

Aircraft and scene props load from **img2threejs output — small, diffable TypeScript plus a JSON scene spec** committed in-repo, human-editable, and offline-loadable; this is the primary, canonical representation. A **TRELLIS.2 opaque binary GLB** is used only where a spec is not yet available, is a committed local file flagged as an opaque fallback, and loads through the existing GLB path. Both are offline authoring artifacts: no image-to-3D model, network fetch, or Cloudflare resource is invoked at runtime to obtain an asset, and the loader prefers the spec when both exist. The feature framing is inspired by an external flight-sim project but copies none of its source and takes no dependency on it.

## Demo-ready checks

- [ ] Source-backed seed activates XR, 3D rendering, and the canonical XR stage.
- [ ] Airplane flight runs through one native deterministic physics owner (in-repo dynamics; no external engine).
- [ ] Keyboard, touch, and standard gamepad inputs normalize to one flight control state.
- [ ] Fixed Follow and Free Orbit are user-selectable through Camera and `/camera.select`; Timeline playback remains the temporary higher-priority framing owner.
- [ ] Normal `npm run dev` exposes this canonical Source Files document exactly once.
- [ ] Applying the document keeps Explorer available and starts with the Airplane selected.
- [ ] Aircraft and props load from committed img2threejs TypeScript+JSON specs; any GLB is a committed local opaque fallback, and no image-to-3D model or network call runs at runtime.
- [ ] FloatingPanel Flight Sim reuses the same shared-XR Canvas and provides Open, Start, Stop, Restart, Throttle, Save, and Exit.
- [ ] Strict `/flight.sim @canvas #flight` invocation and browser-local WebMCP schema/tools reject duplicate or conflicting bindings.
- [ ] Two identical input traces yield identical canonical flight results (deterministic replay).
- [ ] Motion Control is optional player input only; it never becomes the flight control policy.
- [ ] Terminal Decisions remain pending until explicit Save; malformed hydration blocks Start and Restart until explicit Reset.
- [ ] Source-authored `run_ready_demo.id` owns imported activation without a path alias and conflicts fail closed.
- [ ] No remote assets, provider calls, external runtime dependencies, or external source copies are required.
