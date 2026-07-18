---
title: "Knowgrph XR Motion Reference"
doc_type: "Runtime Design and Clean-Room Boundary"
status: "runtime-ready"
lang: "en-US"
frontmatter_contract: "required"
runtime_scope: "Toolbar Surface Mode XR with BottomPanel Timeline stage blocking, first-class Animation, camera choreography, cast marks, and generator handoff"
deploy_boundary: "Dev-only"
---

# Knowgrph XR Motion Reference

## Scope

Toolbar → Surface Mode → XR Mode opens one graph-native previs workflow in the existing BottomPanel Timeline player:

1. Open FloatingPanel → Media → **3D** and select an original procedural grey-box environment kit.
2. Place people, animals, vehicles, furniture, and props from the native library; assign editable subject labels.
3. Open first-class FloatingPanel → **Animation** to apply native character motions or compatible action paths to the selected cast identity.
4. Treat bounded graph nodes and mobile library subjects as cast identities synchronized through the graph/XR selected-actor binding.
5. Place timed cast marks in right-handed, Y-up meter coordinates; select a cast mark and nudge it on the stage plane with WASD or arrow keys, using Shift for a 0.05 m fine step.
6. Bind FloatingPanel Camera → SHOOT to the Scene or any 3D Object, then capture timed camera marks or apply an original target-bound Orbit, Crane, Drone Follow, or Vertigo move.
7. Preview any deterministic playhead instant in the ThreeGraph XR stage.
8. Save the normalized plan to `graphData.metadata.kgXrMotionReference`.
9. Export one deterministic `.xr-motion-reference.<fingerprint>.json` package for a video-generation workflow.

The fidelity target is clear motion and spatial intent. This feature does not become a general 3D asset editor, video renderer, or provider-specific prompt surface.

## Clean-Room Reference Boundary

[wassermanproductions/blockout](https://github.com/wassermanproductions/blockout) is product-level inspiration only for the broad idea that grey-box staging, timed cast/camera cues, and structured generator handoff can reduce motion ambiguity.

The Knowgrph implementation is independently authored and must not copy or import upstream code, algorithms, assets, screenshots, prompts, schemas, presets, camera-move catalogs, tests, CSS, icons, keyboard mappings, filenames, export directory layout, or documentation prose. It must not add a Git dependency, package dependency, submodule, binary, local bridge, API call, MCP call, or runtime fetch tied to that repository. The upstream Apache-2.0 license does not relax this stricter operator boundary.

Reference evidence remains documentation-only. Runtime modules and dependency manifests must not contain the repository identifier or depend on its Electron/FFmpeg stack.

## Native Owners

| Concern | Owner | Contract |
|---|---|---|
| Surface activation | `canvas3dMode` and `activateCanvasGraphSurfaceMode` | XR remains the existing 3D Surface Mode. |
| 3D media catalog | `MediaCatalogPanelView.tsx` and `XrMediaLibraryPanel.tsx` | Adds one Media-owned 3D view for environment selection, subject placement, labels, and removal; successful edits activate XR and persist through the canonical graph metadata owner. |
| Scene library | `xrSceneLibrary.ts` | Owns the original environment and procedural asset catalog without downloaded meshes, copied presets, or runtime egress. |
| Animation catalog | `xrAnimationCatalog.ts` | Owns typed native character-motion and action-path presets, compatibility, deterministic procedural pose sampling, and bounded path generation without external animation assets. |
| Animation projection | `XrAnimationFloatingPanelView.tsx` | First-class FloatingPanel view immediately after Media; reuses the Media 3D three-row cards, per-card disclosure, Expand All/Collapse All, selected cast target, shared transport, clear, and export controls. |
| Animation control | `xrAnimationMcpRuntime.ts`, `xrAnimationWebMcpTools.ts`, and `xrSelectedActorBinding.ts` | Structured WebMCP and hydrated `/animation.control` + `@selected-actor`/`@canvas` + `#character-motion`/`#action-path` invocations fail closed and update the same graph-persisted runtime. |
| Plan model | `xrMotionReferenceModel.ts` | Normalizes stages, placed subjects, tracks, marks, and graph metadata. |
| Package compiler | `xrMotionReferencePackage.ts` | Compiles deterministic subject, cast, camera, frame-sample, map, and generator-handoff virtual files. |
| Draft runtime | `xrMotionReferenceRuntime.ts` | One bounded external-store snapshot shared by panel and ThreeGraph stage. |
| Shot targets | `xrShotTargets.ts`, `xrSelectedActorBinding.ts`, and `XrShootCameraSection.tsx` | One runtime-only selection resolves the active Scene or 3D Object without changing camera framing during object selection or drag. SHOOT actions publish framing and camera marks only when explicitly invoked. |
| Timeline projection | `TimelineBottomPanelView.tsx`, `XrCameraMotionSection.tsx`, `xrMotionReferenceTimeline.ts`, and `GanttTimelineTransportPanel.tsx` | XR reuses the canonical Timeline player and shared playhead. The Scene bar, every 3D Object lane label/full-duration bar, and linked Camera marks select the same SHOOT target; cast marks retain their own choreography controls. |
| Stage projection | `XrMotionReferenceStage.tsx` and `XrSceneLibrarySubject.tsx` | Renders original procedural boxes, labeled subject silhouettes, cast paths, marks, and camera path. |
| Selected-object keyboard motion | `XrObjectKeyboardMotionRuntime.tsx` and `threeObjectInputOwnership.ts` | WASD and arrow keys move only the selected cast mark on X/Z by 0.25 m; Shift uses 0.05 m. Editable controls and ordinary toolbar/menu controls ignore the binding. The shared object-input owner synchronously pauses OrbitControls and framing writes, preserves the exact camera pose, and restores camera navigation on key release. |
| Scene isolation | `Scene.impl.tsx` and `ThreeGraph.impl.tsx` | Graph XR renders the motion stage exclusively; standard node/edge meshes, graph fog/starfield, Rich Media overlays, and hover UI remain unmounted. |
| Empty-world bootstrap | `ThreeGraph.impl.tsx`, `XrEmptyWorldStage.tsx`, and `XrEmptyWorldHud.tsx` | No-file XR rejects retained graph data and mounts a source-free navy world grid, center target, XYZ axes/HUD, neutral runtime camera framing, and zero cast; no decorative Camera prop or grey-box set geometry is mounted. |
| Camera authority | `cameraFramingRuntime.ts`, `cameraFramingControlsRuntime.ts`, `xrCameraPlaybackControlsRuntime.ts`, `xrCameraControlOwnership.ts`, `cameraFramingPose.ts`, and `Controls.tsx` | Canvas 3D and XR publish one shared framing draft to FloatingPanel Camera. Paused choreography permits an explicit framing preview; scrub/playback reasserts camera marks; active playback blocks competing orbit/zoom writers; BottomPanel Timeline remains the transport owner. |
| Camera moves | `xrCameraMoveCatalog.ts`, `xrCameraMoveRuntime.ts`, `xrMotionReferenceSampling.ts`, and `XrCameraMovePresetControl.tsx` | FloatingPanel Camera selects original typed move presets; pose sampling resolves a moving cast track, static 3D Object position, or Scene origin; only the canonical BottomPanel Timeline owns the resulting mark track, retiming, playhead, and transport. |
| Persistence | `updateGraphMetadata` | Writes one versioned `kgXrMotionReference` value through the canonical graph owner. |
| Download | `downloadBlob` | Reuses the repository-owned delayed-revoke browser download path. |

## Bounded Runtime Contract

| Input | Normalization |
|---|---|
| Graph nodes | At most 12 cast tracks; source ids and labels remain authoritative. |
| 3D library subjects | At most 48 placed subjects across people, animals, vehicles, furniture, and props; mobile subjects use available cast capacity while static subjects remain spatial references. |
| Cast marks | At most 32 per actor; duplicate times replace; coordinates clamp to ±50 m and nonnegative Y. |
| Camera marks | At most 32; a move atomically requires up to two free mark times; every mark retains its Scene/3D Object target id while shared semantic framing maps around that target on an 8 m stage-meter baseline. |
| Camera moves | Six original presets: clockwise/counterclockwise orbit, crane rise/descend, drone follow, and vertigo dolly-zoom. Duration clamps to 0.25–30 seconds; moving cast targets are resampled per frame while static objects and Scene use stable positions. |
| Timeline | Duration clamps to 1–30 seconds; FPS clamps to 6–30; export emits at most 901 inclusive frame samples. |
| Stage | One of ten original Knowgrph presets, including Downtown, Residential Street, Supermarket, Movie Theater, Train Car, Backyard with Pool, and Sky for Aerials. |

Malformed or missing persisted values normalize to a neutral stage, a six-second/12-fps timeline, graph-derived cast tracks, one starting mark per actor, and no camera marks. The workflow performs no network call or model call.

## Package Contract

The download is a single versioned JSON envelope because Knowgrph has no first-party ZIP writer and must not add an archive dependency for this feature. Its `files` array exposes virtual files:

| Virtual file | Purpose |
|---|---|
| `reference/manifest.json` | Coordinate system, stage, timeline, and bounded counts. |
| `reference/subjects.json` | Placed asset identities, categories, editable labels, colors, transforms, and static positions. |
| `reference/cast-tracks.json` | Source-backed cast identities, animation assignments, and timed spatial marks. |
| `reference/camera-track.json` | Timed shared-camera settings, typed move ids, rigs, anchors, and independently derived poses. |
| `reference/frame-samples.json` | Deterministic subject-bound camera/move samples, cast samples, action paths, procedural character poses, prop cues, and event cues for every inclusive frame. |
| `reference/stage-map.svg` | Original top-down grey-box map with cast and camera cues. |
| `handoff/video-generator-brief.txt` | Provider-neutral instruction compiled from the actual plan. |
| `README.txt` | Consumer guidance and the grey-box/non-final-art boundary. |

Separate graph-topology and normalized-motion fingerprints, stable property order, bounded samples, and absence of wall-clock fields make repeat exports byte-identical for the same graph and plan while distinguishing choreography revisions.

## Mutation and Cost Boundaries

- Timeline stage and mark edits remain in the local draft runtime until **Save**; the canonical Timeline transport is the only playhead.
- Pointer drag, WASD, and arrow-key cast-mark motion update that same bounded draft and never invoke Camera framing, SHOOT, or camera-mark mutation; stage bounds clamp X/Z and preserve Y.
- Media → 3D environment, placement, label, and removal actions persist immediately through `updateGraphMetadata`, then activate XR Mode and open the canonical Timeline.
- Animation apply/clear actions persist through the same graph metadata owner; play/pause/scrub reuse the canonical Timeline transport, and export reads the current native plan.
- Save writes only the canonical graph metadata field and schedules normal graph history.
- Export reads current graph and draft state, creates one local blob, and invokes the shared browser download helper.
- No model, paid API, provider profile, network egress, asset upload, Prod mirror, or Cloudflare mutation occurs.
- A future rendered-video or depth-pass exporter must be a separate source-owned slice with its own capability, codec, performance, and licensing proof.

## VCC

Given an active graph, when the operator opens Media → 3D, chooses an environment kit, places and labels mobile and static subjects, links SHOOT through the Scene bar or a 3D Object lane/bar, adds camera/cast marks, nudges the selected cast mark with WASD/arrows and the Shift fine step, applies a target-bound Camera move, moves the canonical Timeline playhead, and exports, then XR Mode shows the selected grey-box stage and procedural choreography; object keys change only bounded X/Z choreography while the shared camera pose remains invariant; camera samples remain aimed at the linked target; graph metadata contains one normalized plan; and the downloaded package contains the eight virtual files with exact inclusive frame count `floor(duration × fps) + 1`.

VCC: Verify the focused XR package test, Canvas TypeScript check, dependency/source scan, and local browser flow; stop without deployment or external runtime installation.
