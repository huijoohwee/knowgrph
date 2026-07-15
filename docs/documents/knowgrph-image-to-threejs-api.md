---
title: "Knowgrph Image To Three.js Skill API"
graphId: "md:knowgrph-image-to-threejs-api"
doc_type: "API Contract"
date: "2026-07-15"
lang: "en-US"
schema: "knowgrph-image-to-threejs-api/v1"
frontmatter_contract: "required"
status: "runtime-ready-dev"
runtime_scope: "Knowgrph Canvas Card, Widget, Storyboard, overlay, and Rich Media Panel surfaces"
runtime_claim: "provider-free Dev conversion and browser render proof only"
publish_policy: "Dev-only until explicit operator approval"
source_owner: "canvas/src/features/image-to-threejs and canvas/src/features/image-to-glb"
external_pattern_source: "https://github.com/vinhhien112/Three.js-Object-Sculptor-Codex-Plugin"
copy_policy: "behavioral reference only; forbid copied code, prompt, schema, fixture, test, prose, package, plugin layout, or runtime dependency"
---

# Image To Three.js Skill API

`image.to-threejs` is a model-free skill, not an agent variant. It converts supported image sources into one typed Three.js projection that existing Card, Widget, Storyboard, overlay, and Rich Media Panel owners can render.

## Invocation

Use the shared route grammar:

```text
/skill.load image.to-threejs #skill-system @image @runtime-proof
```

`/image.to-threejs` in a Card or Widget resolves through the same native contract before the generic text/provider route. `#image-to-threejs` describes the capability and an inline `@` image supplies source context; neither tag executes by itself. No skill-specific command parser, alias registry, provider route, or agent definition is added.

## Input

```ts
type ImageToThreeJsInput = {
  sourceUrl: string
}
```

`sourceUrl` must identify `.png`, `.jpg`, `.jpeg`, or `.svg`, or an equivalent supported image data URL. A connected Widget input takes precedence over the local property fallback as the conversion source; it does not redirect a manual inline `/image.to-threejs` Card Run away from its invoking Widget Card.

## Output

```ts
type ImageToThreeJsManifest = {
  schema: 'knowgrph-image-to-threejs/v1'
  source: {
    url: string
    kind: 'raster' | 'svg'
    extension: 'jpg' | 'png' | 'svg'
  }
  render: {
    engine: 'three'
    primitive: 'textured-plane' | 'shape-geometry'
  }
  cost: {
    model: 'local-threejs'
    prompt_tokens: 0
    completion_tokens: 0
    cache_hits: 0
    estimated_cost_usd: 0
  }
}
```

The success patch carries `mediaRenderMode: threejs`, the manifest, output MIME, source URL, image tab selection, and run timestamp. Missing and unsupported inputs return typed `missing-source` or `unsupported-format` errors before render work or spend.

## Native Render Lifecycle

- Raster images use `THREE.TextureLoader`, `THREE.SRGBColorSpace`, a textured plane, and explicit texture disposal.
- SVG images use `SVGLoader`, fill `ShapeGeometry`, stroke geometry, bounded group fitting, abortable fetch, and explicit geometry/material disposal.
- The shared `frameloop="demand"` renderer invalidates after asynchronous raster or SVG state becomes renderable.
- Source replacement remounts the keyed raster or SVG loader, disposing the prior resource before the next conversion can render.
- A loader failure returns visibly to the original image surface without provider calls, retry loops, or generated-media backfill.

## Shared Surface Projection

The Storyboard workflow runner resolves either a source-backed skill node or an inline `/image.to-threejs` Card/Widget command before generic text/provider execution. A manual inline Card Run remains scoped to that Widget Card even when it has a connected input Rich Media Panel. Attached album media, inline Markdown image media, and connected inputs share the same source resolver.

For an inline Card invocation, publication creates or reuses a marker-scoped `Three.js Rich Media Panel` owned by the invoking Card. The output panel is identified by its owner anchor and Three.js-output marker; its generated `mediaRenderMode: threejs` patch, manifest, output MIME, source URL, image tab selection, and timestamp live there. Fresh runs never mutate the input Widget Card or its input Rich Media Panel. An explicit rerun can repair only the prior legacy derived-output signature, preserving the Card prompt and raw input media while leaving marker-owned and authored Three.js panels untouched. Shared media specs preserve `mediaRenderMode: threejs` through Card, Widget, Storyboard, 2D overlay, Three overlay, and Rich Media Panel call sites.

The public Card chrome suppresses the legacy `Text Generation` metadata rail for this default Widget Card projection, leaving the visible card identity as `Widget Card` while preserving `/`, `#`, and `@` invocation chips.

## External Boundary

The named Object Sculptor repository is a behavioral reference for code-first staged modeling only. Knowgrph copies none of its code, prompts, schema, fixtures, tests, prose, package metadata, plugin layout, or runtime dependencies. The skill uses Three.js and React Three Fiber versions already owned by Canvas.

## Reference-driven GLB and glTF fidelity

`/image.to-glb`, `@image-to-glb`, and `#image-to-glb` reuse the same source resolver and bounded reference-pixel reader. The native reconstruction owner isolates the foreground, measures its silhouette spans, central gap, symmetry, aspect ratio, dominant palette, shell height, and lower width, then derives one scalar construction plan. Ring-frame references produce a flattened lathed annular shell, recessed aperture lip, eight aperture-safe rounded ribs, four curved supports, and a rounded lower tray; other references produce a bounded, colored silhouette relief from procedural `BoxGeometry` parts. The source image remains attached to the invoking Widget Card and its input Rich Media Panel.

One reconstruction result owns the reviewable TypeScript, Three.js scene, program digest, reference digest, named-part manifest, and structured projection-review evidence. Review evidence traverses actual native meshes, material values, world transforms, geometry primitives, and bounds instead of copying expected part names into the result. Export recomputes that structural fingerprint and rejects either provenance drift or post-review geometry tampering. The same trusted scene is then serialized as a binary GLB and as editable glTF JSON with an external `.bin` buffer; no LLM-authored serialized vertices, accessors, buffers, embedded geometry, copied plugin runtime, or provider-free synthetic approval is accepted.

The GLB Rich Media surface reports `ready` only after the installed Three.js `GLTFLoader` parses a renderable scene. Reference colors enter Three.js as sRGB, then use the renderer's explicit sRGB/ACES output policy and a scoped neutral-warm studio rig. A bounds-driven camera recomputes distance after load and resize so landscape, square, and portrait panels keep the model inside the viewport without reducing it to a thumbnail. Native in-repo `OrbitControls` then own left-drag orbit, right-drag pan, wheel/pinch zoom, damping, and cursor-centred dolly inside the selected or otherwise interactive GLB panel. Bounds-derived clipping and distance limits preserve close inspection, while shared pointer, wheel, and gesture guards keep those model-local actions from moving or zooming the Storyboard canvas. Model-payload caching hashes artifact content, preventing a same-length rerun from reusing stale GLB or glTF bytes. Export uses only options supported by the in-repo Three.js r170 `GLTFExporter`, so GLB and external-buffer glTF retain the same transforms, PBR materials, geometry, and named part structure.

## Dev Proof

| Gate | Proof |
|---|---|
| Typed conversion | Thirteen focused `imageToThreeJs` unit selectors pass for format bounds, zero-cost manifests, inline Card/Widget invocation, Card-owned `Three.js Rich Media Panel` publication without input mutation, legacy derived-output recovery, connected input precedence, shared render mode, real SVG geometry, disposal, and the no-dependency boundary. |
| Compile | Canvas TypeScript exits zero. |
| PNG render | The Rich Media browser smoke derives a typed conversion and proves a non-fallback WebGL Rich Media Panel surface. |
| JPG render | The same smoke generates a real JPEG image in-browser, derives the typed conversion, and proves a non-fallback shared Card WebGL surface. |
| SVG render | The same smoke derives the typed conversion and proves non-fallback SVG geometry in both the Rich Media Panel and Storyboard Widget panel owner. |
| Fallback render | A text-only SVG fixture intentionally yields no Three.js shape or stroke geometry; browser proof observes the original SVG image fallback and no remaining Three.js canvas surface. |
| Resource lifecycle | Focused unit proof creates real SVG fill and stroke meshes, verifies bounded fitting, and observes every geometry and material disposal event. |
| GLB and glTF fidelity | Twenty-three focused `imageToGlb` selectors prove reference-pixel-dependent reconstruction, wide/low ring-frame proportions, lathed shell/tray profiles, aperture-safe ribs, exact part-manifest coverage, filename invariance, responsive bounds-safe camera fitting, native orbit/pan/zoom ownership, Storyboard gesture isolation, program/scene digest parity, provenance and geometry-tamper rejection, native GLB loading, external-buffer glTF structure, source-card immutability, and idempotent output publication. A separate schema regression proves same-length model revisions cannot collide in the loader cache. |
| Deployment | Prod mirror and Cloudflare remain untouched. |
