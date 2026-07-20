---
title: "Knowgrph Motion Control PRD/TAD"
doc_type: "Runtime Design and Clean-Room Boundary"
status: "runtime-ready"
lang: "en-US"
frontmatter_contract: "required"
runtime_scope: "FloatingPanel Motion Control and Toolbar Surface Mode XR"
deploy_boundary: "Dev-only"
---

# Knowgrph Motion Control PRD/TAD

## Product contract

Motion Control is a first-class FloatingPanel view between Animation and Camera. It reuses the existing FloatingPanel catalog header, surface/body layout, form controls, local status rows, and Markdown invocation renderer. Entering Toolbar → Canvas View Mode → Surface Mode → XR opens Motion Control only when no FloatingPanel is already open and keeps BottomPanel Timeline as the sole transport.

Two compact target cards project the current **3D for XR** and **Animation** state into Motion Control. Their Open actions move the same FloatingPanel to Media's canonical 3D view or the canonical Animation view; they do not copy either catalog, create another target store, or introduce a second scene/animation mutation path. Each card renders the existing scene or animation WebMCP identity and its existing `/`, `@`, and `#` invocation rather than defining a Motion-Control-specific replacement.

The operator explicitly starts and stops one local camera session. A square mirrored preview shows the latest video frame and accepted skeleton; its **Bounding box** checkbox is disabled by default and can project the already-computed tracked pose ROI around the person. The checkbox is a page-session preference that survives Stop, restart, and panel remount, while its coordinates remain transient and clear with tracking or runtime loss. This projection adds no second detector, inference pass, visual-annotation runtime, or external dependency. Status rows report permission, requested and effective backend, fallback reason, confidence, inference latency, and effective FPS. The panel instructs the operator to keep one full body centered because the MVP runs Google's standalone landmark model with a bounded centered-person crop rather than claiming arbitrary-frame person detection.

## Runtime owners

| Concern | Canonical owner | Contract |
|---|---|---|
| UI route | `ToolbarToolMenu.impl.tsx` and `MotionControlFloatingPanelView.tsx` | One lazy-mounted first-class FloatingPanel projection with no parallel shell or nested scroll owner. The existing form-control and preview-canvas owners render the default-off Bounding box preference and the mirrored tracked ROI. |
| Target projection | `MotionControlTargetCards.tsx`, `motionControlTargetRuntime.ts`, `motionControlSurfaceRuntime.ts`, and `mediaCatalogModeRuntime.ts` | Compact read/action projections expose selected-humanoid compatibility plus current 3D/Animation status, then route to the existing Media or Animation FloatingPanel owner. Media and the lifecycle guard observe one ephemeral catalog-mode owner, so only the explicit 3D for XR submode retains capture. No target, asset, animation, invocation, or persistence schema is duplicated. |
| Asset configuration | `motionControlConfig.ts` | One same-origin URL owner for the official LiteRT Wasm directory and Google pose model. |
| Build assets | `scripts/prepare-litert-assets.mjs` | Copies Wasm from installed `@litertjs/core`; downloads and extracts the official Google model only after exact digest checks; generated binaries remain untracked. |
| Camera and inference | `motionControlRuntime.ts` | Explicit permission, local preprocessing, LiteRT compile/run, metadata validation, backpressure, ROI tracking, the same ROI's transient preview-box projection, smoothing input, telemetry, and shutdown. |
| Pose schema and projection | `motionControlPose.ts` | One finite app-owned frame schema maps 33 landmarks to selected-humanoid pose and normalized native-controller input. |
| XR lifecycle | `MotionControlXrLifecycleGuard.tsx` and `ToolbarMenuLauncher.tsx` | One stable toolbar-level owner covers graph-backed and empty-world XR. Capture may remain active only while XR is active and the open FloatingPanel is Motion Control, Media's explicit 3D for XR submode, or Animation. Stop, closing the panel, selecting ordinary Media or another unrelated FloatingPanel view, leaving XR, page lifecycle loss, camera end, or lifecycle-owner unmount releases capture; both ordinary XR and native physics branches consume the same latest pose without creating a second renderer or physics loop. |
| Invocation | `motionControlMcpContract.mjs` and `motionControlMcpRuntime.ts` | `/motion.control @canvas #pose operation=open`, optional strict `operation=open boundingBox=<true|false>`, `operation=stop`, or `operation=start backend=<auto|webgpu|wasm>` and equivalent structured control converge on one parser/runtime. `boundingBox` is a boolean valid only for `open`; `backend` is valid only for `start`. |
| Browser WebMCP | `motionControlWebMcpTools.ts` and `webMcpRuntime.ts` | The existing `knowgrph.inspect_local_motion_control` and `knowgrph.control_local_motion_control` tools address only the active browser runtime. Inspection exposes preview `boundingBoxEnabled` and `boundingBoxAvailable` booleans, never box coordinates or frames. No stdio or published HTTP host claims camera reachability. |

## Official LiteRT and model boundary

- Runtime dependency: [`@litertjs/core`](https://www.npmjs.com/package/@litertjs/core), maintained by [Google AI Edge LiteRT](https://github.com/google-ai-edge/LiteRT), Apache-2.0.
- Runtime loading: the application serves the package's Wasm artifacts from its own origin, calls `loadLiteRt`, compiles the model with `loadAndCompile`, awaits inference, and explicitly deletes input tensors, output tensors, and compiled models.
- Model source: Google's official [Pose Landmarker Full task](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task), from which the build step extracts only `pose_landmarks_detector.tflite`.
- Task SHA-256: `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad`.
- Extracted model SHA-256: `82be6d591b9dad7d29fe21dc9fd892bf8b9602c458fb05209283de8282a0c488`.
- Expected input: float32 `[1,256,256,3]`, RGB normalized to `[0,1]`.
- Expected public outputs: 33 normalized landmarks, 33 hip-relative world landmarks, and pose confidence. Output roles are resolved and shape-checked from model metadata rather than silently assuming output order.

The runtime prefers WebGPU when requested and supported. It reports pure `webgpu` only when LiteRT confirms full delegation, `webgpu+wasm` for partitioned execution, and `wasm` when capability, delegation, or compilation falls back to CPU. `auto`, `webgpu`, and `wasm` are preferences, not proof of the effective backend; inspection reports both requested and effective values.

## Capture, scheduling, and privacy

1. Camera access is requested only from explicit Start control after XR activation succeeds; a document lock or other rejected XR transition fails before permission or capture begins.
2. The first input is a centered square person crop; accepted landmarks produce a bounded next-frame ROI. When the operator enables Bounding box, that same ROI is mirrored into the preview without a second landmark scan or detector. Tracking loss resets to the centered acquisition crop and clears the transient box coordinates.
3. Only one inference may be active. The next animation frame is scheduled after the current asynchronous inference settles, so slow inference cannot queue frames.
4. Invalid shapes, non-finite values, and pose confidence below `0.5` clear the live pose and transient preview box instead of freezing stale motion.
5. Capture remains active across only the open Motion Control, Media's explicit 3D for XR submode, and Animation FloatingPanel surfaces while XR remains active. Explicit Stop, closing the FloatingPanel, selecting ordinary Media or any other unrelated view, leaving XR, page hide, camera end, backend replacement, lifecycle-owner unmount, or runtime error cancels scheduling; stops every `MediaStreamTrack`; detaches the video; clears canvases, pose, and transient box coordinates; and deletes LiteRT resources. The page-session enabled/disabled preference remains unchanged across Stop and restart.
6. A valid live pose transiently overrides only the selected compatible humanoid's character pose. Authored animation assignments and action-path marks stay canonical and resume when tracking is lost or Motion Control stops.
7. Camera frames, raw tensors, the live pose, preview-box coordinates, and pose history are not uploaded, persisted to graph/workspace storage, included in exports, or returned through MCP. Recording is not part of this feature.

The MVP is single-person entertainment/XR control. It does not claim identity recognition, surveillance, multi-person tracking, medically meaningful biomechanics, metric-accurate camera depth, or safety-critical control.

## Clean-room inspiration boundary

[andrisgauracs/LiteRT.js-Mocap](https://github.com/andrisgauracs/LiteRT.js-Mocap) was consulted only for neutral product-level ideas: local browser inference, backend selection, ROI continuity, smoothing, confidence-aware pose consumption, and XR/avatar control. The repository is not a dependency or implementation source.

Knowgrph must not copy or adapt its code, algorithms' expression, file/module structure, comments, prose, configuration, data schemas, UI/CSS, tests, character assets, model binaries, screenshots, or build layout. Runtime and build code must not import, fetch, embed, clone, bridge, or call that repository. All implementation is independently authored from existing Knowgrph owners plus official Google/browser specifications; a source test scans production modules and manifests for the forbidden owner/repository markers.

## Invocation and physics projection

- Opening: `/motion.control @canvas #pose operation=open` activates XR and opens the panel without requesting camera permission.
- Bounding-box preference: `/motion.control @canvas #pose operation=open boundingBox=true` enables the reused ROI projection and `boundingBox=false` disables it. Both forms only open/confirm the XR surface and update the page-session preference; neither starts the camera.
- Starting: `/motion.control @canvas #pose operation=start backend=auto` first verifies the approved XR surface, then starts the active browser-local capture/inference runtime and surfaces XR-activation or permission failure honestly.
- Stopping: `/motion.control @canvas #pose operation=stop` releases all capture and inference resources.
- WebMCP structured calls reuse the identical controller. `open` alone accepts the optional boolean `boundingBox`; `start` alone accepts `backend`; `stop` accepts neither field. Wrong types, casing, mixed invocation/structured fields, and unknown keys fail closed.
- Inspection returns only whether the Bounding box preference is enabled and whether current tracking makes a box available; it never returns coordinates, landmarks, images, or history.
- The 3D for XR card reuses `knowgrph.control_local_xr_scene` and the existing XR scene invocation; the Animation card reuses `knowgrph.control_local_animation` and the existing `/animation.control` grammar. Motion Control adds no composite MCP tool, operation, or invocation schema.
- The accepted pose projects transiently into the selected compatible humanoid through the existing animation pose seam. It overrides the visible character pose only; authored preset/path state is neither rewritten nor cleared and resumes after Stop or tracking loss. In the physics playground, torso lean and arm direction map to the native normalized controller input, which is merged with keyboard/gamepad input before the existing single deterministic physics step.

No invocation accepts an arbitrary model URL, Wasm URL, camera-frame payload, node id, document path, or validation share token.

## Acceptance and proof boundary

- Focused tests cover first-class panel routing and layout reuse; the default-off page-session Bounding box preference; reuse, mirroring, and lifecycle clearing of the existing tracked ROI; strict enable/disable convergence without camera start or coordinate disclosure; target-card projection into the existing 3D and Animation owners; the three-view XR capture allowlist, rejected-XR fail-closed behavior, and unrelated-view teardown; official LiteRT API markers; one-inference backpressure; cleanup; metadata shapes; same-origin asset integrity; strict `/ @ #` and WebMCP convergence; selected-humanoid projection; authored-animation resume semantics; physics controller integration; clean-room source scanning; and external validation-input hardcode rejection.
- Build validation must run `prepare:litert-assets`, TypeScript, focused runtime tests, docs checks, hygiene, and `git diff --check`.
- Browser validation must inspect a normal source-backed physics demo route, open XR and Motion Control, verify Bounding box starts disabled, enable and disable it without starting capture, exercise explicit Start/Stop when camera permission is available, confirm a tracked box appears only while enabled and available, confirm skeleton rendering remains independent, open the compact 3D for XR and Animation targets without losing capture, verify an unrelated FloatingPanel view stops it, and confirm no frame, box-coordinate, or pose-history write occurs.
- Source/build proof does not by itself prove camera permission, live pose quality, effective WebGPU execution, Prod, or Cloudflare deployment. Dev browser observations must state any host permission or hardware limitation explicitly.

VCC: Given a source-backed physics playground document, when the operator enters XR and opens Motion Control, then Bounding box is disabled by default and either the checkbox or strict `operation=open boundingBox=true|false` control changes only that page-session preference without starting the camera. After explicit Start and accepted centered full-body tracking, the enabled preview reuses the inference ROI while the disabled preview retains the skeleton without the box; tracking or lifecycle loss clears its coordinates. The panel reports honest local inference state, capture remains active only across the three approved XR FloatingPanel views, the accepted pose transiently drives the selected compatible humanoid and canonical physics-controller seam, authored preset/path state resumes after Stop or tracking loss, the existing scene/animation/motion WebMCP and `/ @ #` contracts remain the only invocation owners, inspection reveals only box enabled/available booleans, and Stop, panel close, an unrelated view, XR exit, page lifecycle loss, or camera end releases the camera without persisting pose or box history.
