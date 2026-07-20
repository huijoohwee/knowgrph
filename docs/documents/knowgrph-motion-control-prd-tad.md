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

The operator explicitly starts and stops one local camera session. A square mirrored preview shows the latest video frame and accepted skeleton; status rows report permission, requested and effective backend, fallback reason, confidence, inference latency, and effective FPS. The panel instructs the operator to keep one full body centered because the MVP runs Google's standalone landmark model with a bounded centered-person crop rather than claiming arbitrary-frame person detection.

## Runtime owners

| Concern | Canonical owner | Contract |
|---|---|---|
| UI route | `ToolbarToolMenu.impl.tsx` and `MotionControlFloatingPanelView.tsx` | One lazy-mounted first-class FloatingPanel projection with no parallel shell or nested scroll owner. |
| Asset configuration | `motionControlConfig.ts` | One same-origin URL owner for the official LiteRT Wasm directory and Google pose model. |
| Build assets | `scripts/prepare-litert-assets.mjs` | Copies Wasm from installed `@litertjs/core`; downloads and extracts the official Google model only after exact digest checks; generated binaries remain untracked. |
| Camera and inference | `motionControlRuntime.ts` | Explicit permission, local preprocessing, LiteRT compile/run, metadata validation, backpressure, ROI tracking, smoothing input, telemetry, and shutdown. |
| Pose schema and projection | `motionControlPose.ts` | One finite app-owned frame schema maps 33 landmarks to selected-humanoid pose and normalized native-controller input. |
| XR lifecycle | `XrGraphStage.tsx` | Leaving XR stops Motion Control; both ordinary XR and native physics branches consume the same latest pose without creating a second renderer or physics loop. |
| Invocation | `motionControlMcpContract.mjs` and `motionControlMcpRuntime.ts` | `/motion.control @canvas #pose operation=open`, `operation=stop`, or `operation=start backend=<auto|webgpu|wasm>` and equivalent structured control converge on one strict parser/runtime; `backend` is valid only for `start`. |
| Browser WebMCP | `motionControlWebMcpTools.ts` and `webMcpRuntime.ts` | `knowgrph.inspect_local_motion_control` and `knowgrph.control_local_motion_control` address only the active browser runtime. No stdio or published HTTP host claims camera reachability. |

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

1. Camera access is requested only from explicit Start control.
2. The first input is a centered square person crop; accepted landmarks produce a bounded next-frame ROI. Tracking loss resets to the centered acquisition crop.
3. Only one inference may be active. The next animation frame is scheduled after the current asynchronous inference settles, so slow inference cannot queue frames.
4. Invalid shapes, non-finite values, and pose confidence below `0.5` clear the live pose instead of freezing stale motion.
5. Stop, panel close, XR unmount, page hide, backend replacement, and runtime error cancel scheduling; stop every `MediaStreamTrack`; detach the video; clear canvases and pose; and delete LiteRT resources.
6. Camera frames, raw tensors, and pose history are not uploaded, persisted to graph/workspace storage, included in exports, or returned through MCP. Recording is not part of this feature.

The MVP is single-person entertainment/XR control. It does not claim identity recognition, surveillance, multi-person tracking, medically meaningful biomechanics, metric-accurate camera depth, or safety-critical control.

## Clean-room inspiration boundary

[andrisgauracs/LiteRT.js-Mocap](https://github.com/andrisgauracs/LiteRT.js-Mocap) was consulted only for neutral product-level ideas: local browser inference, backend selection, ROI continuity, smoothing, confidence-aware pose consumption, and XR/avatar control. The repository is not a dependency or implementation source.

Knowgrph must not copy or adapt its code, algorithms' expression, file/module structure, comments, prose, configuration, data schemas, UI/CSS, tests, character assets, model binaries, screenshots, or build layout. Runtime and build code must not import, fetch, embed, clone, bridge, or call that repository. All implementation is independently authored from existing Knowgrph owners plus official Google/browser specifications; a source test scans production modules and manifests for the forbidden owner/repository markers.

## Invocation and physics projection

- Opening: `/motion.control @canvas #pose operation=open` activates XR and opens the panel without requesting camera permission.
- Starting: `/motion.control @canvas #pose operation=start backend=auto` starts the active browser-local capture/inference runtime and surfaces permission failure honestly.
- Stopping: `/motion.control @canvas #pose operation=stop` releases all capture and inference resources.
- WebMCP structured calls reuse the identical controller and accept `backend` only with the `start` operation; `open` and `stop` reject it.
- The accepted pose projects into the selected humanoid through the existing animation pose seam. In the physics playground, torso lean and arm direction map to the native normalized controller input, which is merged with keyboard/gamepad input before the existing single deterministic physics step.

No invocation accepts an arbitrary model URL, Wasm URL, camera-frame payload, node id, document path, or validation share token.

## Acceptance and proof boundary

- Focused tests cover first-class panel routing and layout reuse; official LiteRT API markers; one-inference backpressure; cleanup; metadata shapes; same-origin asset integrity; strict `/ @ #` and WebMCP convergence; selected-humanoid projection; physics controller integration; clean-room source scanning; and external validation-input hardcode rejection.
- Build validation must run `prepare:litert-assets`, TypeScript, focused runtime tests, docs checks, hygiene, and `git diff --check`.
- Browser validation must inspect the normal source-backed physics demo route, open XR and Motion Control, verify local preview/status, exercise explicit Start/Stop when camera permission is available, and confirm no request targets the inspiration repository or uploads a frame.
- Source/build proof does not by itself prove camera permission, live pose quality, effective WebGPU execution, Prod, or Cloudflare deployment. Dev browser observations must state any host permission or hardware limitation explicitly.

VCC: Given the source-backed physics playground document, when the operator enters XR, opens Motion Control, explicitly starts capture, and moves within a centered full-body frame, then the panel reports honest local inference state, the accepted pose drives the selected humanoid and canonical physics-controller seam, `/motion.control @canvas #pose` and WebMCP reach the same runtime, Stop releases the camera, and neither the document URL nor the inspiration repository appears in production runtime logic.
