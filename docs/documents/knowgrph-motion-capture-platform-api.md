---
title: "Knowgrph Motion Capture Platform API"
doc_type: "Runtime and Invocation Contract"
status: "runtime-ready"
lang: "en-US"
frontmatter_contract: "required"
runtime_scope: "XR Mode, Motion Control, Skills & Commands, and Media"
deploy_boundary: "Dev-only"
---

# Knowgrph Motion Capture Platform API

## Product boundary

Knowgrph provides a browser-local, provider-neutral motion-capture session behind **FloatingPanel → Motion Control**. The same canonical session is projected into **Skills & Commands** and **Media** while **Surface Mode → XR Mode** owns the Canvas. A built-in browser camera is the lowest-cost source, but the platform contract also admits derived landmarks from video, depth, landmark-stream, and explicitly shared peer sources without binding the session to a camera vendor, operating system, inference package, or hosted coordinator.

The platform is evidence graded. A built-in monocular pose is useful for `single-view-control`; it is never labeled research-ready. `time-aligned-multi-source` requires at least two aligned and synchronized sources. `calibrated-metric-reconstruction` and `researchReady=true` additionally require metric-world coordinates, canonical session-clock alignment or measured source-local alignment, measured per-source calibration provenance, explicit measured shared-reconstruction evidence binding those source calibrations into one metric session frame, bounded reprojection error, bounded clock uncertainty, bounded skew and jitter, monotonic sequence evidence, enough samples per source, an acceptable combined missing/drop/low-evidence failure rate, observation confidence of at least `0.5`, and visibility plus presence of at least `0.5` on at least half of each observation's landmarks. These default minimums may be tightened per session but never relaxed. Unrelated metric streams and low-evidence observations never qualify; a failed condition produces a warning instead of a stronger claim.

## Canonical runtime owners

| Concern | Owner | Contract |
|---|---|---|
| Provider contract | `motionCapturePlatformContract.ts` | Finite source, clock, calibration, observation, quality, recording, and export schemas. Source IDs and session IDs are generated locally and remain opaque. |
| Session and evidence | `motionCaptureSessionRuntime.ts` | One browser singleton strictly registers sources, ingests derived observations with capture-time timestamps, calculates quality/evidence, bounds recording memory, publishes immutable snapshots, and emits a bounded revision when the latest source crosses its staleness deadline. |
| Deterministic export | `motionCaptureExport.ts` | Canonical JSON and tidy CSV from the same stopped recording; stable ordering and SHA-256 metadata; no frame or tensor export. |
| Built-in pose bridge | `motionControlCapturePlatformBridge.ts` | Registers the existing LiteRT pose runtime as a model-relative source and forwards accepted or missing derived samples using the timestamp taken before inference. |
| Decentralized transport | `p2pCollaborationExtensionRuntime.ts` and `motionCapturePeerRuntime.ts` | Explicit opt-in, bounded namespaced messages over the existing WebRTC data channels. Only derived pose observations are shared; invalid or unregistered messages fail closed. |
| Invocation and WebMCP | `motionControlMcpRuntime.ts`, `motionControlAgentReadyContract.mjs`, and `motionControlWebMcpTools.ts` | The existing inspect/control tool pair and `/motion.control @canvas #pose` grammar remain the sole agent mutation path. |
| Surface projections | `MotionCapturePlatformProjection.tsx` | Motion Control owns full controls; Skills & Commands and Media render compact projections over the same runtime rather than parallel stores. |

Provider integrations call `registerSource`, retain the returned opaque `sourceId`, optionally call `setSourceClockAlignment` and `setSourceCalibration`, and then call `ingestObservation`. A measured multi-source reconstruction provider may call `setSharedReconstructionEvidence` with at least two source IDs plus a distinct SHA-256 evidence digest; changing or removing a bound source invalidates that private session evidence, and `clearSharedReconstructionEvidence` removes it explicitly. Providers keep ownership of hardware handles and subscribe to the session: disappearance of their opaque source ID is the provider-neutral revocation signal to dispose those handles, while Knowgrph never executes provider callbacks. Every provider input and nested evidence/landmark record rejects unknown own keys and sparse arrays; public state is reconstructed from admitted fields instead of spreading caller objects. Registration accepts finite capabilities and dimensions only. Capture, clock-offset, and aligned timestamps are bounded to a precision-safe range before evidence grading. No method accepts a device serial, stable peer identity, executable, model URL, source URL, network endpoint, invitation token, or storage path.

## Invocation contract

The canonical tokens are `/motion.control`, `@canvas`, and `#pose`. Structured WebMCP input and native text invocations converge on the same strict parser.

| Operation | Native invocation | Result |
|---|---|---|
| Open | `/motion.control @canvas #pose operation=open` | Activate XR and open Motion Control without camera permission. Optional `boundingBox=true|false` changes only the existing page-session projection preference. |
| Start | `/motion.control @canvas #pose operation=start backend=auto` | Request the local camera and start the existing LiteRT pose source after XR activation succeeds. Backend is exactly `auto`, `webgpu`, or `wasm`. |
| Stop | `/motion.control @canvas #pose operation=stop` | Release camera/inference, peer sharing, and every registered transient source. An active bounded recording is finished and retained for explicit Export or Clear. A built-in camera restart releases only its own source so independently registered providers can coexist. |
| Record | `/motion.control @canvas #pose operation=record` | Begin an explicit bounded local recording of derived observations. |
| Finish | `/motion.control @canvas #pose operation=finish` | Stop appending while retaining the bounded recording for inspection/export. |
| Clear | `/motion.control @canvas #pose operation=clear` | Release the local recording and prepared export state. |
| Export | `/motion.control @canvas #pose operation=export format=json` | Build deterministic `json` or `csv`; WebMCP returns metadata only, while the Media projection performs the operator-initiated local download. |
| Share | `/motion.control @canvas #pose operation=share enabled=true` | Explicitly enable or disable derived-observation sharing over the current peer session. It never creates a peer invitation or endpoint. |

Unknown keys, duplicate pairs, wrong casing, conflicting structured/text input, a format outside `json|csv`, an `enabled` value outside `true|false`, or a field on the wrong operation fails closed. `backend` is valid only for Start, `boundingBox` only for Open, `format` only for Export, and `enabled` only for Share.

Browser WebMCP continues to expose exactly:

- `knowgrph.inspect_local_motion_control`
- `knowgrph.control_local_motion_control`

Inspection includes opaque source/session IDs, source capabilities, dimensions/FPS declarations, calibration status and error, aggregate aligned/synchronized source counts, skew, jitter, drops, missing samples, evidence warnings, recording counts, export readiness, and peer-sharing state. It excludes camera frames, tensors, landmark arrays, box coordinates, device serials, stable peer identities, invitations, network endpoints, reconstruction evidence content, recording bytes, and export content. Export control returns only format, MIME type, suggested file name, digest, byte length, aggregate counts, and the number of synchronized research-ready observation groups.

## Recording, export, and privacy

Recording is opt-in, memory-bounded, browser-local, and composed only of derived landmarks plus quality/evidence metadata. Additional samples are rejected when the declared budget is reached and `droppedByBudget` makes that loss visible and blocks a research-ready export. In-window rejected order evidence is retained per source even though the invalid observation is not admitted. Export independently recomputes usable, research-usable, low-evidence, missing, sequence-loss, order, and jitter evidence from recording-local accepted and rejected evidence under the session owner's effective limits, and earns `researchReady=true` only from the deterministic maximum set of disjoint synchronized observation pairs inside one stable reconstruction/source/evidence epoch with at least two locally qualified sources. High clock uncertainty is excluded at admission; changing source-local alignment or calibration, or replacing shared reconstruction evidence, starts a new research-quality epoch and invalidates the previous latest observation and counters so old samples cannot be laundered through new evidence. Pre-recording session quality, optional unqualified sources, and groups accumulated across changed cohorts cannot distort the artifact grade. Finish preserves a frozen recording while capture sources can continue; Stop preserves that recording and releases every transient provider source. Clear and page/session disposal release the recording. JSON and CSV are deterministic projections of the same recording and are not written to graph, workspace, D1, Cloudflare, or another host by the runtime.

Peer sharing is independently opt-in per collaboration session. A session reset disables it and requires fresh explicit consent. The transport reuses the active collaboration session and WebRTC data channels; it neither opens a signaling endpoint nor silently publishes a document. Payload size, namespace, landmark count, numeric finiteness, and message shape are bounded before send and after receipt. Extension observations are limited to 30 publications per second per namespace and dropped with an explicit `throttled` or `backpressure` status before the ordered collaboration channel would exceed a 256 KiB buffered ceiling. The inbound connection/namespace clock survives source-revocation and source-token churn, while the outbound namespace clock survives extension registration churn; both reset only with their owning connection/session. Source-revocation controls receive one immediate priority send without creating a retry queue; host disable also revokes every connection-scoped relay from the other guests before deleting its mapping. Connected-peer counts reconcile when topology opens or closes. Hosts replace each direct guest source token with a connection-scoped opaque relay token, preventing one guest from colliding with the host or another guest. A received peer becomes a session-local `peer-derived` source. Without canonical session-clock or measured source-local alignment, measured metric calibration, monotonic sequence evidence, and shared reconstruction evidence it remains below research-ready regardless of how many peer samples arrive.

## Reference-only inspiration boundary

[FreeMoCap](https://github.com/freemocap/freemocap), its [multi-camera calibration documentation](https://docs.freemocap.org/documentation/multi-camera-calibration.html), [triangulation documentation](https://docs.freemocap.org/documentation/triangulation.html), and [camera-system architecture documentation](https://docs.freemocap.org/skellycam/docs/technical/architecture/) were consulted only for neutral product principles: accessible capture, separable source/capture/processing concerns, multi-camera time alignment, explicit calibration, reconstruction-quality evidence, and open data portability.

FreeMoCap is not a package, service, subprocess, model source, schema source, or runtime/build dependency. Knowgrph does not copy or adapt its code, algorithms' expression, prose, schemas, file layout, configuration, tests, fixtures, UI, assets, or examples. Repository-wide relevant text and dependency manifests are scanned for forbidden project/owner markers with a narrow attribution/enforcement allowlist. That automated check is a guardrail, not proof of authorship; documentation attribution is the only permitted reference.

## Proof boundary

Focused source tests prove strict source registration, calibration/alignment validation, quality-tier downgrades, bounded memory, deterministic exports, no-copy/no-dependency enforcement, strict invocation convergence, WebMCP redaction, peer-message rejection, lifecycle teardown, and shared UI ownership across Motion Control, Skills & Commands, and Media. Browser proof must separately verify permission prompts, capture timestamps, Start/Stop cleanup, recording/download controls, two-peer opt-in sharing, XR view switching, and the absence of frame/network persistence.

Source and simulated runtime proof do not establish camera quality, calibrated metric reconstruction, effective WebGPU delegation, multi-device synchronization, Prod, or Cloudflare deployment. Those claims require measured evidence from the specific hardware/session and a separately authorized release.
