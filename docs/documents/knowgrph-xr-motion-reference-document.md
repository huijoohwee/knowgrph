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
5. Place timed cast marks in right-handed, Y-up meter coordinates; select a cast mark and tap WASD or arrow keys for a 0.25 m nudge, hold them for smooth frame-timed movement, or use Shift for 0.05 m precision.
6. Set the real Camera optics in FloatingPanel Camera: Super 16, Super 35, Full Frame, or 65mm sensor; an 8–300mm focal length; a 0.1–1000m focus distance; and a 4:3, 16:9, 1.85:1, or 2.39:1 aspect mask. FloatingPanel Camera is the sole optics editor; BottomPanel Timeline projects those values on Camera marks without adding a second editor.
7. Bind FloatingPanel Camera → SHOOT to the Scene or any 3D Object, then capture timed camera marks or apply an original target-bound Orbit, Crane, Drone Follow, or Vertigo move. A selected Camera mark uses the same keys for normalized orbit choreography; with no mark selected, an open Camera panel routes them to the live framing draft.
8. Preview any deterministic playhead instant in the ThreeGraph XR stage, including the delivery aspect mask, sensor-aware field of view, zoom, and focus-distance metadata.
9. Save the normalized plan to `graphData.metadata.kgXrMotionReference`.
10. Export one deterministic `.xr-motion-reference.<fingerprint>.json` package for a video-generation workflow.

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
| Animation control | `xrAnimationMcpRuntime.ts`, `xrAnimationWebMcpTools.ts`, and `xrSelectedActorBinding.ts` | Structured WebMCP and hydrated `/animation.control` + `@selected-actor`/`@canvas` + `#character-motion`/`#action-path` invocations fail closed and update the same graph-persisted runtime. `operation=move-object` accepts the shared WASD/arrow vocabulary and a bounded deterministic distance. |
| Plan model | `xrMotionReferenceModel.ts` | Normalizes stages, placed subjects, tracks, marks, and graph metadata. |
| Package compiler | `xrMotionReferencePackage.ts` | Compiles deterministic subject, cast, camera, frame-sample, map, and generator-handoff virtual files. |
| Draft runtime | `xrMotionReferenceRuntime.ts` | One bounded external-store snapshot shared by panel and ThreeGraph stage. |
| Shot targets | `xrShotTargets.ts`, `xrSelectedActorBinding.ts`, and `XrShootCameraSection.tsx` | One runtime-only selection resolves the active Scene or 3D Object without changing camera framing during object selection or drag. SHOOT actions publish framing and camera marks only when explicitly invoked. |
| Timeline projection | `TimelineBottomPanelView.tsx`, `XrCameraMotionSection.tsx`, `xrMotionReferenceTimeline.ts`, and `GanttTimelineTransportPanel.tsx` | XR reuses the canonical Timeline player and shared playhead. The Scene bar, every 3D Object lane label/full-duration bar, and linked Camera marks select the same SHOOT target; cast marks retain their own choreography controls. |
| Stage projection | `XrMotionReferenceStage.tsx` and `XrSceneLibrarySubject.tsx` | Renders original procedural boxes, labeled subject silhouettes, cast paths, marks, and camera path. |
| Shared 3D keyboard choreography | `threeKeyboardChoreography.ts` | One headless utility owns accepted WASD/arrow keys, case normalization, diagonal normalization, opposing-key cancellation, frame timing, bounded command amounts, stage-clamped object positions, and Camera orbit resolution for browser, `/ @ #`, structured control, and WebMCP callers. Object profiles use 0.25 m/0.05 m taps and 2 m/s/0.4 m/s holds; Camera profiles use 0.08/0.02 orbit-unit taps and 0.64/0.16 orbit-unit-per-second holds. |
| XR keyboard routing | `XrKeyboardChoreographyRuntime.tsx` and `threeObjectInputOwnership.ts` | One XR adapter routes a selected cast mark to object movement, a selected Camera mark to Camera choreography, or no selected mark plus an open Camera panel to live framing. It owns browser event isolation only. Editable controls and ordinary toolbar/menu controls ignore the binding; the active Camera panel trigger remains a deliberate framing-key surface so opening Camera cannot strand focus on a rejected toolbar button. Cast chords synchronously pause OrbitControls and framing writes, preserve the exact camera pose, and restore camera navigation on final key release; active Camera playback rejects competing Camera-key writes. |
| Scene isolation | `Scene.impl.tsx` and `ThreeGraph.impl.tsx` | Graph XR renders the motion stage exclusively; standard node/edge meshes, graph fog/starfield, Rich Media overlays, and hover UI remain unmounted. |
| Empty-world bootstrap | `ThreeGraph.impl.tsx`, `XrEmptyWorldStage.tsx`, and `XrEmptyWorldHud.tsx` | No-file XR rejects retained graph data and mounts a source-free navy world grid, center target, XYZ axes/HUD, neutral runtime camera framing, and zero cast; no decorative Camera prop or grey-box set geometry is mounted. |
| Camera authority | `cameraFramingRuntime.ts`, `cameraFramingControlsRuntime.ts`, `xrCameraPlaybackControlsRuntime.ts`, `xrCameraControlOwnership.ts`, `cameraFramingPose.ts`, and `Controls.tsx` | Canvas 3D and XR publish one shared framing draft to FloatingPanel Camera. Paused choreography permits an explicit framing preview; scrub/playback reasserts camera marks; active playback blocks competing orbit/zoom writers; BottomPanel Timeline remains the transport owner. |
| Real Camera optics | `cameraOptics.ts`, `StrybldrCameraOpticsSection.tsx`, `XrCameraAspectMask.tsx`, `xrMotionReferenceSampling.ts`, and `CameraMotionMarkRetime.tsx` | FloatingPanel Camera alone edits sensor, focal length, focus distance, and aspect mask. Timeline and XR viewport are read-only projections. Focal length and focus distance interpolate with the source Camera mark easing; sensor and aspect cut at the destination mark. Playback applies sensor-aware FOV and the Three `PerspectiveCamera.focus` value. Focus distance is deterministic motion-reference metadata; this slice does not claim simulated depth-of-field or bokeh. |
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
| Camera optics | Four normalized sensor gates: Super 16 (12.4 × 7.0mm), Super 35 (27.99 × 19.22mm), Full Frame (36 × 24mm), and 65mm (54.12 × 25.58mm). Focal length clamps to 8–300mm, focus distance to 0.1–1000m, and aspect mask to 4:3, 16:9, 1.85:1, or 2.39:1. These are explicit engineering presets, not a claim that every camera sold under a format name has identical active dimensions. |
| Camera moves | Six original presets: clockwise/counterclockwise orbit, crane rise/descend, drone follow, and vertigo dolly-zoom. Duration clamps to 0.25–30 seconds; moving cast targets are resampled per frame while static objects and Scene use stable positions. |
| Timeline | Duration clamps to 1–30 seconds; FPS clamps to 6–30; export emits at most 901 inclusive frame samples. |
| Stage | One of ten original Knowgrph presets, including Downtown, Residential Street, Supermarket, Movie Theater, Train Car, Backyard with Pool, and Sky for Aerials. |
| Agent keyboard movement | `knowgrph.control_local_animation` accepts `operation=move-object`, 1–8 unique WASD/arrow keys, an optional distance greater than 0 and at most 10 m, optional fine-step defaulting, and an explicit or currently selected cast mark. The same stage clamp and normalized diagonal math as the browser runtime apply. |
| Agent Camera keyboard choreography | `knowgrph.control_local_camera` accepts `/camera.frame @camera|@selected-actor #camera-shot` or `/camera.animate @camera|@selected-actor #camera-motion`, 1–8 unique WASD/arrow keys, an optional amount greater than 0 and at most 2 orbit units, optional fine-step defaulting, and an optional Camera `markId` for animate. Framing publishes through the shared Camera runtime; Camera-mark edits persist through `kgXrMotionReference`; active playback fails closed. |
| Agent Camera optics | The same `knowgrph.control_local_camera` tool accepts typed `sensorId`, `focalLengthMm`, `focusDistanceMeters`, and `aspectRatio` fields. Hydrated grammar accepts `sensor=`, `lens=`, `focus=`, and `aspect=` on `/camera.frame @camera|@selected-actor #camera-shot` and `/camera.animate @camera|@selected-actor #camera-motion`; invalid values and optics mixed with keyboard movement fail closed. |

Malformed or missing persisted values normalize to a neutral stage, a six-second/12-fps timeline, graph-derived cast tracks, one starting mark per actor, and no camera marks. The workflow performs no network call or model call.

## Package Contract

The download is a single versioned JSON envelope because Knowgrph has no first-party ZIP writer and must not add an archive dependency for this feature. Its `files` array exposes virtual files:

| Virtual file | Purpose |
|---|---|
| `reference/manifest.json` | Coordinate system, stage, timeline, bounded counts, optics sets, and interpolation/cut semantics. |
| `reference/subjects.json` | Placed asset identities, categories, editable labels, colors, transforms, and static positions. |
| `reference/cast-tracks.json` | Source-backed cast identities, animation assignments, and timed spatial marks. |
| `reference/camera-track.json` | Timed shared-camera settings, sensor ids, focal lengths, focus distances, aspect masks, typed move ids, rigs, anchors, and independently derived poses. |
| `reference/frame-samples.json` | Deterministic subject-bound camera/move samples with sensor dimensions, focal length, horizontal Full Frame equivalent, focus distance, aspect mask, and horizontal/vertical FOV; plus cast samples, action paths, procedural character poses, prop cues, and event cues for every inclusive frame. |
| `reference/stage-map.svg` | Original top-down grey-box map with cast and camera cues. |
| `handoff/video-generator-brief.txt` | Provider-neutral instruction compiled from the actual plan. |
| `README.txt` | Consumer guidance and the grey-box/non-final-art boundary. |

Separate graph-topology and normalized-motion fingerprints, stable property order, bounded samples, and absence of wall-clock fields make repeat exports byte-identical for the same graph and plan while distinguishing choreography revisions.

## Mutation and Cost Boundaries

- Timeline stage and mark edits remain in the local draft runtime until **Save**; the canonical Timeline transport is the only playhead.
- Pointer drag and selected-cast WASD/arrow motion update the same bounded draft and never invoke Camera framing, SHOOT, or camera-mark mutation; stage bounds clamp X/Z and preserve Y.
- A selected Camera mark routes WASD/arrows only to that mark's Camera settings; with no selected mark, the open Camera panel routes them only to the live framing draft. Active Camera playback blocks both paths so Timeline camera authority cannot be overwritten.
- Media → 3D environment, placement, label, and removal actions persist immediately through `updateGraphMetadata`, then activate XR Mode and open the canonical Timeline.
- Animation apply/clear and keyboard `move-object` actions persist through the same graph metadata owner; `/animation.control #action-path @selected-actor operation=move-object keys=w+d distance=0.25` and structured WebMCP reuse the headless browser-key utility. Play/pause/scrub reuse the canonical Timeline transport, and export reads the current native plan.
- Camera keyboard control reuses the same headless key/direction/profile owner. `/camera.frame @camera #camera-shot keys=w+d amount=0.08` updates live framing; `/camera.animate @camera #camera-motion keys=d fine=true markId=<typed-id>` atomically updates and persists one Camera mark through the existing Camera WebMCP tool.
- Camera optics control uses the same owner: `/camera.animate @selected-actor #camera-motion sensor=super-35 lens=35 focus=2 aspect=2.39:1 rig=dolly time=2.5` writes one normalized Camera mark. BottomPanel Timeline exposes retime/easing and read-only optics labels, never a competing optics form.
- Save writes only the canonical graph metadata field and schedules normal graph history.
- Export reads current graph and draft state, creates one local blob, and invokes the shared browser download helper.
- No model, paid API, provider profile, network egress, asset upload, Prod mirror, or Cloudflare mutation occurs.
- A future rendered-video or depth-pass exporter must be a separate source-owned slice with its own capability, codec, performance, and licensing proof.

## VCC

Given an active graph, when the operator opens Media → 3D, chooses an environment kit, places and labels mobile and static subjects, selects Camera-owned sensor/lens/focus/aspect values, links SHOOT through the Scene bar or a 3D Object lane/bar, adds camera/cast marks, moves a selected cast or Camera mark with WASD/arrows and the Shift fine step or invokes the equivalent source-backed `/ @ #`/WebMCP control, applies a target-bound Camera move, moves the canonical Timeline playhead, and exports, then XR Mode shows the selected grey-box stage, procedural choreography, and delivery mask; Timeline shows read-only optics keyframes without a competing editor; focal length and focus distance sample deterministically; sensor-aware FOV remains aimed at the linked target; invalid MCP optics fail closed; graph metadata contains one normalized plan; and the downloaded package contains the nine virtual files with exact inclusive frame count `floor(duration × fps) + 1`.

## Sensor-dimension evidence

The optics constants are independently authored numerical presets derived from primary manufacturer documentation: [ARRI ALEXA 35](https://www.arri.com/en/camera-systems/cameras/legacy-camera-systems/alexa-35) and its user manual for the Super 35/Super 16 active gates, [Sony VENICE](https://www.sony.com/en/SonyInfo/design/gallery/CineAltaVENICE/) for 36 × 24mm Full Frame, and [ARRI ALEXA 65 technical history](https://www.arri.com/resource/blob/227838/99e14a680bd1169f68e7ae204eabca05/alexa-10-years-fdt-special-edition-data.pdf) for 54.12 × 25.58mm 65mm. No manufacturer code, asset, schema, or runtime service is used.

VCC: Verify the focused XR package test, Canvas TypeScript check, dependency/source scan, and local browser flow; stop without deployment or external runtime installation.
