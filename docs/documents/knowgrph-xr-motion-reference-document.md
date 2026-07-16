---
title: "Knowgrph XR Motion Reference"
doc_type: "Runtime Design and Clean-Room Boundary"
status: "runtime-ready"
lang: "en-US"
frontmatter_contract: "required"
runtime_scope: "Toolbar Surface Mode XR with BottomPanel Timeline stage blocking, camera choreography, cast marks, and generator handoff"
deploy_boundary: "Dev-only"
---

# Knowgrph XR Motion Reference

## Scope

Toolbar → Surface Mode → XR Mode opens one graph-native previs workflow in the existing BottomPanel Timeline player:

1. Select an original procedural grey-box stage.
2. Treat bounded graph nodes as cast identities.
3. Place timed cast marks in right-handed, Y-up meter coordinates.
4. Capture timed camera marks from the shared Camera Framing owner.
5. Preview any deterministic playhead instant in the ThreeGraph XR stage.
6. Save the normalized plan to `graphData.metadata.kgXrMotionReference`.
7. Export one deterministic `.xr-motion-reference.<fingerprint>.json` package for a video-generation workflow.

The fidelity target is clear motion and spatial intent. This feature does not become a general 3D asset editor, video renderer, or provider-specific prompt surface.

## Clean-Room Reference Boundary

[wassermanproductions/blockout](https://github.com/wassermanproductions/blockout) is product-level inspiration only for the broad idea that grey-box staging, timed cast/camera cues, and structured generator handoff can reduce motion ambiguity.

The Knowgrph implementation is independently authored and must not copy or import upstream code, algorithms, assets, screenshots, prompts, schemas, presets, camera-move catalogs, tests, CSS, icons, keyboard mappings, filenames, export directory layout, or documentation prose. It must not add a Git dependency, package dependency, submodule, binary, local bridge, API call, MCP call, or runtime fetch tied to that repository. The upstream Apache-2.0 license does not relax this stricter operator boundary.

Reference evidence remains documentation-only. Runtime modules and dependency manifests must not contain the repository identifier or depend on its Electron/FFmpeg stack.

## Native Owners

| Concern | Owner | Contract |
|---|---|---|
| Surface activation | `canvas3dMode` and `activateCanvasGraphSurfaceMode` | XR remains the existing 3D Surface Mode. |
| Plan model | `xrMotionReferenceModel.ts` | Normalizes stages, tracks, marks, frame samples, graph metadata, and package bytes. |
| Draft runtime | `xrMotionReferenceRuntime.ts` | One bounded external-store snapshot shared by panel and ThreeGraph stage. |
| Timeline projection | `TimelineBottomPanelView.tsx`, `XrTimelineSceneLane.tsx`, `xrMotionReferenceTimeline.ts`, and `GanttTimelineTransportPanel.tsx` | XR reuses the canonical Timeline player, shared playhead, and Scene/Effect lane renderer. A compact control strip authors stage/cast/camera cues while generated fractional-minute tasks project native seconds into the player without mutating Markdown source. |
| Stage projection | `XrMotionReferenceStage.tsx` | Renders original procedural boxes, cast paths, marks, and camera path. |
| Scene isolation | `Scene.impl.tsx` and `ThreeGraph.impl.tsx` | Graph XR renders the motion stage exclusively; standard node/edge meshes, graph fog/starfield, Rich Media overlays, and hover UI remain unmounted. |
| Empty-world bootstrap | `ThreeGraph.impl.tsx`, `XrEmptyWorldStage.tsx`, and `XrEmptyWorldHud.tsx` | No-file XR rejects retained graph data and mounts a source-free navy world grid, center target, XYZ axes/HUD, camera prop, and zero cast; grey-box set geometry remains document-only. |
| Camera authority | `cameraFramingRuntime.ts`, `cameraFramingControlsRuntime.ts`, `cameraFramingPose.ts`, and `Controls.tsx` | Canvas 3D and XR publish one shared framing draft to the sole editor in FloatingPanel Camera; BottomPanel Timeline consumes captured camera marks, FloatingPanel XR mounts no camera or motion editor, and the retired 3D ellipse path never becomes a competing writer. |
| Persistence | `updateGraphMetadata` | Writes one versioned `kgXrMotionReference` value through the canonical graph owner. |
| Download | `downloadBlob` | Reuses the repository-owned delayed-revoke browser download path. |

## Bounded Runtime Contract

| Input | Normalization |
|---|---|
| Graph nodes | At most 12 cast tracks; source ids and labels remain authoritative. |
| Cast marks | At most 32 per actor; duplicate times replace; coordinates clamp to ±50 m and nonnegative Y. |
| Camera marks | At most 32; shared semantic framing maps around the timed cast anchor on an 8 m stage-meter baseline, with stage origin as the explicit missing-anchor fallback. |
| Timeline | Duration clamps to 1–30 seconds; FPS clamps to 6–30; export emits at most 901 inclusive frame samples. |
| Stage | One of three original Knowgrph presets: Neutral Volume, Street Grid, or Loading Bay. |

Malformed or missing persisted values normalize to a neutral stage, a six-second/12-fps timeline, graph-derived cast tracks, one starting mark per actor, and no camera marks. The workflow performs no network call or model call.

## Package Contract

The download is a single versioned JSON envelope because Knowgrph has no first-party ZIP writer and must not add an archive dependency for this feature. Its `files` array exposes virtual files:

| Virtual file | Purpose |
|---|---|
| `reference/manifest.json` | Coordinate system, stage, timeline, and bounded counts. |
| `reference/cast-tracks.json` | Source-backed cast identities and timed spatial marks. |
| `reference/camera-track.json` | Timed shared-camera settings and independently derived poses. |
| `reference/frame-samples.json` | Deterministic piecewise-linear camera/cast samples for every inclusive frame. |
| `reference/stage-map.svg` | Original top-down grey-box map with cast and camera cues. |
| `handoff/video-generator-brief.txt` | Provider-neutral instruction compiled from the actual plan. |
| `README.txt` | Consumer guidance and the grey-box/non-final-art boundary. |

Separate graph-topology and normalized-motion fingerprints, stable property order, bounded samples, and absence of wall-clock fields make repeat exports byte-identical for the same graph and plan while distinguishing choreography revisions.

## Mutation and Cost Boundaries

- Stage and mark edits remain in the local draft runtime until **Save**; the canonical Timeline transport is the only playhead.
- Save writes only the canonical graph metadata field and schedules normal graph history.
- Export reads current graph and draft state, creates one local blob, and invokes the shared browser download helper.
- No model, paid API, provider profile, network egress, asset upload, Prod mirror, or Cloudflare mutation occurs.
- A future rendered-video or depth-pass exporter must be a separate source-owned slice with its own capability, codec, performance, and licensing proof.

## VCC

Given an active graph in XR Mode, when the operator chooses a stage, places at least two cast marks, captures at least two shared-camera marks, saves, moves the playhead, and exports, then the ThreeGraph scene shows the selected grey-box stage and sampled cast/camera paths; graph metadata contains one normalized plan; and the downloaded package contains the seven virtual files with exact inclusive frame count `floor(duration × fps) + 1`.

VCC: Verify the focused XR package test, Canvas TypeScript check, dependency/source scan, and local browser flow; stop without deployment or external runtime installation.
