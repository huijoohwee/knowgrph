---
title: "Knowgrph Image To Three.js Skill API"
graphId: "md:knowgrph-image-to-threejs-api"
doc_type: "API Contract"
date: "2026-07-14"
lang: "en-US"
schema: "knowgrph-image-to-threejs-api/v1"
frontmatter_contract: "required"
status: "runtime-ready-dev"
runtime_scope: "Knowgrph Canvas Card, Widget, Storyboard, overlay, and Rich Media Panel surfaces"
runtime_claim: "provider-free Dev conversion and browser render proof only"
publish_policy: "Dev-only until explicit operator approval"
source_owner: "canvas/src/features/image-to-threejs"
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

No skill-specific command parser, alias registry, provider route, or agent definition is added.

## Input

```ts
type ImageToThreeJsInput = {
  sourceUrl: string
}
```

`sourceUrl` must identify `.png`, `.jpg`, `.jpeg`, or `.svg`, or an equivalent supported image data URL. A connected Widget input takes precedence over the local property fallback.

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
- A loader failure returns visibly to the original image surface without provider calls, retry loops, or generated-media backfill.

## Shared Surface Projection

The Storyboard workflow runner validates and patches the source-backed skill node, then publishes the same result through the existing Rich Media Panel output owner. Shared media specs preserve `mediaRenderMode: threejs` through Card, Widget, Storyboard, 2D overlay, Three overlay, and Rich Media Panel call sites.

## External Boundary

The named Object Sculptor repository is a behavioral reference for code-first staged modeling only. Knowgrph copies none of its code, prompts, schema, fixtures, tests, prose, package metadata, plugin layout, or runtime dependencies. The skill uses Three.js and React Three Fiber versions already owned by Canvas.

## Dev Proof

| Gate | Proof |
|---|---|
| Typed conversion | Six focused `imageToThreeJs` unit selectors pass. |
| Compile | Canvas TypeScript exits zero. |
| Raster render | The Rich Media browser smoke proves a non-fallback WebGL PNG surface. |
| SVG render | The same smoke proves a non-fallback WebGL SVG geometry surface. |
| Deployment | Prod mirror and Cloudflare remain untouched. |
