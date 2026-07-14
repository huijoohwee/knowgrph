---
title: "Knowgrph Artifact & Media Storage Architecture"
id: "md:knowgrph-artifact-media-storage-architecture"
author: "airvio / joohwee"
date: "2026-06-11"
updated: "2026-06-18"
version: "1.2.0"
status: "canonical"
doc_type: "Technical Architecture Documentation"
lang: "en-US"
frontmatter_contract: "required"
domain: "knowgrph"
orientation:
  - "solo-dev"
  - "AI-native"
  - "TCO-zero"
  - "FOSS-first"
constraints:
  - "universal"
  - "neutral"
  - "agnostic"
  - "modular"
  - "no hardcoded credentials, workspace IDs, or route paths"
owner: "Knowgrph canonical docs"
traceability:
  prd: "PRD-STORAGE-SYNC-S7"
  tad: "TAD-STORAGE-SYNC-GeneratedBinaryArtifact"
  canonical_storage_doc: "docs/documents/knowgrph-storage-sync-document.md"
---

# Knowgrph — Artifact & Media Storage Architecture

**Version**: 1.2.0
**Date**: 2026-06-18
**Status**: Canonical — supersedes any inline architecture notes in demo docs
**Owner**: Knowgrph canonical docs
**Scope**: Artifact and media storage, access, auto-save, replay, and infrastructure constraints for all agentic canvas runs

---

## Infrastructure Constraint: Cloudflare + BytePlus + Stripe Only

**Vercel and AWS are FORBIDDEN** in this architecture. All compute, storage, and delivery runs on:

| Layer | Provider | Service |
|---|---|---|
| UI + static | Cloudflare Pages | `airvio.co/knowgrph` |
| Agent compute | Cloudflare Workers | `McpAgent` at `airvio.co/knowgrph/control-plane/mcp` |
| AI routing + cache | Cloudflare AI Gateway | unified billing, fallback, token count |
| Document store | Cloudflare D1 | run manifests, node metadata, media metadata/provenance, auto-save revisions |
| Durable state | Cloudflare Durable Objects | per-run `RunManifest DO` and room-level canvas sync notifications |
| Access cache | Cloudflare KV | short-lived media access URL cache when a namespace is bound |
| Media bytes | Cloudflare R2 | image, audio, and video binary blobs |
| Text / image / video models | BytePlus OpenArk | `agnes`, `seed`, `seedream-*`, `seedance-*`, `dreamina-*` |
| Payments | Stripe | Checkout, payout |

No Vercel edge functions, Lambda, S3, CloudFront, SQS, or any other AWS or Vercel resource is permitted. Control-plane keys live in the Worker; the canvas product surface holds none.

---

## Architecture Flow Diagram

Rendered in the **BottomPanel** (`architecture` tab), **not** in a floating Rich Media Panel.

```
architecture-beta
  group user(cloud)[User surface]
  group cloudflare(cloud)[Cloudflare]
  group providers(cloud)[Default provider BytePlus plus Stripe]
  service web(internet)[Cloudflare UI airvio.co knowgrph] in cloudflare
  service mcp(server)[McpAgent Worker] in cloudflare
  service gateway(server)[Cloudflare AI Gateway] in cloudflare
  service manifest(database)[Run Manifest DO] in cloudflare
  service r2(database)[R2 image audio and video assets] in cloudflare
  service byteplus(server)[BytePlus seedream and seedance] in providers
  service stripe(database)[Stripe] in providers
  web:R --> L:mcp
  mcp:B --> T:manifest
  mcp:R --> L:gateway
  gateway:R --> L:byteplus
  mcp:B --> T:r2
  mcp:R --> L:stripe
```

**Frontmatter contract** for any `flow_diagrams` entry that carries an architecture diagram:

```yaml
agentic_canvas_architecture:
  type: mermaid_architecture
  floatingPanelView: "architecture"   # FloatingPanel: row list (renderMode=split)
  floatingPanelOpen: true             # open FloatingPanel on load
  bottomPanelTab: "architecture"      # BottomPanel: chart only (renderMode=diagram)
  bottomPanelOpen: true               # open BottomPanel on load
  forbidPlatform: ["vercel", "aws"]
```

---

## Event Model Flow Diagram

Rendered in the **BottomPanel** (`eventModeling` tab), **not** in a floating Rich Media Panel.

```
eventmodeling
tf 01 ui UserBrief
tf 02 cmd StartVideoRemixRun
tf 03 evt RunManifestCreated
tf 04 pcr DirectorAgent
tf 05 cmd RequestStoryboard
tf 06 evt StoryboardReady
tf 07 cmd RequestApprovalToken
tf 08 evt ApprovalGranted
tf 09 cmd GenerateImage
tf 10 evt ImageAssetReady
tf 11 cmd GenerateVideo
tf 12 evt VideoAssetReady
tf 13 cmd CreateCheckout
tf 14 evt PaymentSessionCreated
tf 15 ui DemoPackReady
```

**Frontmatter contract** for any `flow_diagrams` entry that carries an event model:

```yaml
agent_run_event_model:
  type: mermaid_eventmodeling
  floatingPanelView: "eventModeling"  # FloatingPanel: row list (renderMode=split)
  floatingPanelOpen: true             # open FloatingPanel on load
  bottomPanelTab: "eventModeling"     # BottomPanel: chart only (renderMode=diagram)
  bottomPanelOpen: true               # open BottomPanel on load
```

---

## Image and Video as Distinct Rich Media Panels

Image and video outputs are **separate canvas nodes** — never merged into one panel, never routed through a generic `output` / `outputSrcDoc` handle when a typed media URL is available.

| Panel node id | Node type | Typed field | Field type | Provider |
|---|---|---|---|---|
| `panel_image_output` | `RichMediaPanel` | `imageAssetUrl` | `image_url` | BytePlus seedream-* |
| `panel_video_output` | `RichMediaPanel` | `videoUrl` | `video_url` | BytePlus seedance-* |

**Required node fields:**

```yaml
- id: panel_image_output
  type: RichMediaPanel
  label: "Rich Media Panel - Image (seedream)"
  handles:
    target: [imageAssetUrl]
    source: [imageAssetUrl]
  flow:portTypes:
    in:  {imageAssetUrl: artifact_signal}
    out: {imageAssetUrl: artifact_signal}
  media_type: image
  replayWithoutLlm: true
  imageAssetUrl:
    type: image_url
    value: "https://airvio.co/api/storage/blob/{workspaceId}/{canonicalImagePath}"

- id: panel_video_output
  type: RichMediaPanel
  label: "Rich Media Panel - Video (seedance)"
  handles:
    target: [videoUrl]
    source: [videoUrl]
  flow:portTypes:
    in:  {videoUrl: artifact_signal}
    out: {videoUrl: artifact_signal}
  media_type: video
  replayWithoutLlm: true
  videoUrl:
    type: video_url
    value: "https://airvio.co/api/storage/blob/{workspaceId}/{canonicalVideoPath}"
```

---

## Media Storage — Persist on Generate

Generated or uploaded media is durable only after the Cloudflare storage path confirms both bytes and metadata. Browser object URLs, provider-hosted URLs, local previews, and embedded `srcdoc` are transient render evidence and must not be treated as synced collaboration state.

| Layer | Owner | Runtime contract |
|---|---|---|
| FloatingPanel Media | Media browser/catalog | Lists uploaded and generated image/audio/video records, previews uploaded media through the shared Rich Media Panel, downloads media through the shared download helper, and inserts selected media into active card fields as inline mention chips. Thumbnail clicks portal that direct Rich Media Panel to the previous centered lightbox geometry and player size while keeping parent-owned placement so Canvas Storyboard/frontmatter positioning cannot collapse image, video, or audio rendering; the uploaded-media path does not instantiate `MediaLightbox`. The expanded panel retains the shared native fullscreen action, which follows `fullscreenchange` and switches between Enter and Exit fullscreen states. While it is open, Left/Up selects the previous image or video and Right/Down selects the next, wrapping within the currently visible image/video catalog sequence. Its thumbnails share hover/focus-appearing kind, info, open-link, and download overlays with Storyboard card media and reference thumbnails. |
| `@ Upload Media` command | Shared Media upload helper | Reuses the FloatingPanel Media upload utility and inventory builder; no second uploader, no panel-local storage config. |
| R2 | Blob persistence | Stores image/audio/video binary objects under configured workspace/object prefixes. |
| D1 | Metadata and provenance | Stores media asset metadata, content type, object key, source/provenance, workspace/run/card context, and persistence status. |
| KV | Access URL cache | Stores short-lived browser-openable access URLs only when a real namespace is bound; it is not canonical metadata. |
| Durable Objects | Collaboration sync state | Holds room-level canvas sync state and latest media notification for connected collaborators; it is not the blob or provenance store. |

Inline media chips in card text are display references. Inserting a chip through `@` or by clicking FloatingPanel Media must preserve the existing field text typography, line height, and source string order while attaching the selected media reference as structured inline content.

BytePlus media URLs are **ephemeral** (short-lived signed URLs). On generation success the `McpAgent` Worker:

1. Downloads the media bytes from the BytePlus response URL.
2. Computes a SHA-256 content hash for deduplication.
3. Uploads to **Cloudflare R2** through the Storage Worker blob route:
   ```
   POST /api/storage/blob/{workspaceId}/{canonicalArtifactPath}
   ```
4. Records the Worker blob URL and R2 object key in the sibling Markdown manifest stored in D1.
5. Returns only the Worker blob URL to the canvas node — the ephemeral provider URL is discarded.

Durable read URL template: `https://airvio.co/api/storage/blob/{workspaceId}/{canonicalArtifactPath}`

**Key scheme examples:**

| Asset | R2 key |
|---|---|
| Shot 1 image | Storage Worker-derived object key for `{workspaceId}/{canonicalImagePath}` |
| Shot 2 video | Storage Worker-derived object key for `{workspaceId}/{canonicalVideoPath}` |

---

## Auto-Save

Auto-save is debounced and fires on:

```yaml
kgAutoSaveEnabled: true
kgAutoSaveDebounceMs: 1500
kgAutoSaveOn: ["nodeEdit", "runComplete", "approval", "assetReady"]
```

Each save is:
- **Idempotent** — keyed by `runId` + content hash; duplicate saves are no-ops.
- **Revision-guarded** — the Worker checks the current revision before writing to D1; a stale write returns a conflict and the client retries with the latest revision.
- **Dual-target** — document/manifest rows go to D1; media bytes go to R2.

Storage frontmatter keys (all `kgStorage*` / `kgMedia*` / `kgReplay*` keys are required on any document that triggers media generation):

```yaml
kgAutoSaveEnabled: true
kgAutoSaveDebounceMs: 1500
kgAutoSaveOn: ["nodeEdit", "runComplete", "approval", "assetReady"]
kgStorageTarget: "cloudflare"
kgStorageAccountId: "<cloudflare-account-id>"
kgStorageWorkspaceId: "<workspace-id>"
kgStorageDocPath: "<canonical-document-path>"
kgStorageDocTarget: "cloudflare-d1"
kgStorageMediaBucketBinding: "KNOWGRPH_STORAGE_BLOB_BUCKET"
kgStorageMediaBaseUrl: "https://airvio.co/api/storage/blob"
kgStorageMediaKeyScheme: "{workspaceId}/{canonicalArtifactPath}"
kgMediaPersistPolicy: "copy-on-generate"
kgProviderUrlEphemeral: true
kgMediaDedupeBy: "sha256"
kgForbidPlatform: ["vercel", "aws"]
```

---

## Replay Without Calling the LLM

Once assets exist in R2, panels **replay by embedding the durable Worker blob URL directly** — no provider call, no AI Gateway request, no LLM invocation.

```yaml
kgReplayEnabled: true
kgReplayFromStorageWithoutLlm: true
kgReplayMediaFields: ["imageAssetUrl", "videoUrl"]
kgReplayAccessScope: "run-entitled"
```

**Replay access contract:**

- R2 assets are served through the Storage Worker blob route or a run-entitled media route; buckets remain private.
- The bucket is **not public**.
- Re-opening a panel, sharing a run link, or returning after days all read from R2 — zero BytePlus or LLM cost.
- Replay is deterministic: the same workspace id and canonical artifact path resolve the same blob route and R2 object.

**Panel behaviour on replay:**

| Panel type | On first run | On replay |
|---|---|---|
| Image (`imageAssetUrl`) | Receives R2 URL from Worker, renders `<img>` | Reads saved R2 URL from D1/manifest, renders `<img>` — no model call |
| Video (`videoUrl`) | Receives R2 URL from Worker, renders `<video>` | Reads saved R2 URL from D1/manifest, renders `<video>` — no model call |
| Text / srcdoc | Rendered from saved markdown / HTML in D1 | Re-renders from D1 row — no model call |

**Persistence claim boundary**: Local artifact paths, browser object URLs, provider URLs, and embedded `srcdoc` prove only that Dev generated an output. A generated artifact is persisted across Dev, Prod, and Cloudflare only after both the D1 manifest route and the Worker blob route are readable for the same artifact.

---

## Run-Scoped Access

```
R2 asset access
  → Worker receives request with runId + entitlement token
  → Worker verifies token against RunManifest DO
  → if verified: stream R2 object to client (zero-egress path)
  → if not verified: 403
  → bucket policy: private; no public-read ACL
```

No CDN cache-poisoning risk because R2 keys include `runId` and assets are immutable once written (deduped by SHA-256).

---

## Companion References

| Document | Scope |
|---|---|
| `knowgrph-storage-sync-document.md` | Full storage ladder, D1 schema, Yjs collaboration, conflict resolution |
| `knowgrph-storage-schemas-document.md` | D1 SQL, browser cache shapes, route contracts |
| `knowgrph-cloudflare-document.md` | Cloudflare Workers, Pages, D1, R2, AI Gateway setup |
| `knowgrph-byteplus-openark-image-generation-api-reference.md` | seedream model reference |
| `knowgrph-byteplus-openark-video-generation-api-reference.md` | seedance model reference |
| `knowgrph-agentic-commerce-prd-tad.md` | Stripe checkout / payout contract |
| `huijoohwee/docs/knowgrph-mcp-agentic-canvas-os-demo.md` | Live MCP demo with full flow, storage keys, replay |
| `huijoohwee/docs/knowgrph-agentic-canvas-os-demo.md` | Market-radar-to-rich-media demo with storage keys, replay |
