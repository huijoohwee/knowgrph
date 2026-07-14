import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import {
  IMAGE_TO_THREEJS_RENDER_MODE,
  IMAGE_TO_THREEJS_SCHEMA,
  IMAGE_TO_THREEJS_SKILL_FORM_ID,
  IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID,
  buildImageToThreeJsConversion,
  isImageToThreeJsSkillNode,
  resolveImageToThreeJsSourceKind,
  resolveImageToThreeJsSourceUrl,
} from '@/features/image-to-threejs/imageToThreeJsContract'
import { buildImageToThreeJsSkillRegistryDraft } from '@/features/image-to-threejs/imageToThreeJsWidget'
import {
  buildImageThreeJsSvgGroup,
  disposeImageThreeJsObject,
} from '@/features/image-to-threejs/ImageThreeJsSurface'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { buildWidgetCompactPreviewViewModel } from '@/features/storyboard-widget-manager/widgetCompactPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testImageToThreeJsSupportsPngJpgAndSvgIncludingProxyUrls() {
  const cases = [
    ['https://assets.example/object.png', 'raster'],
    ['https://assets.example/object.JPG?rev=1', 'raster'],
    ['data:image/jpeg;base64,AA==', 'raster'],
    ['data:image/svg+xml,%3Csvg%2F%3E', 'svg'],
    ['/__fetch_remote?url=https%3A%2F%2Fassets.example%2Fobject.svg', 'svg'],
  ] as const
  for (const [url, expected] of cases) {
    const actual = resolveImageToThreeJsSourceKind(url)
    if (actual !== expected) throw new Error(`expected ${url} to resolve as ${expected}, got ${String(actual)}`)
  }
  if (resolveImageToThreeJsSourceKind('https://assets.example/object.webp') !== null) {
    throw new Error('expected unsupported image extensions to fail closed')
  }
}

export function testImageToThreeJsBuildsTypedZeroCostRenderPatch() {
  const result = buildImageToThreeJsConversion('https://assets.example/object.svg')
  if (result.ok === false) throw new Error(result.reason)
  if (result.manifest.schema !== IMAGE_TO_THREEJS_SCHEMA) throw new Error('expected the image-to-threejs schema')
  if (result.manifest.render.primitive !== 'shape-geometry') throw new Error('expected SVG shape geometry')
  if (result.manifest.cost.estimated_cost_usd !== 0) throw new Error('expected a zero-cost local conversion')
  if (result.patch.mediaRenderMode !== IMAGE_TO_THREEJS_RENDER_MODE) throw new Error('expected Three.js render mode')
  if (result.patch.richMediaActiveTab !== 'image') throw new Error('expected Rich Media image tab projection')
}

export function testImageToThreeJsRejectsMissingAndUnsupportedSources() {
  const missing = buildImageToThreeJsConversion('')
  const unsupported = buildImageToThreeJsConversion('workspace:/media/object.webp')
  if (missing.ok !== false || missing.errorCode !== 'missing-source') throw new Error('expected missing source failure')
  if (unsupported.ok !== false || unsupported.errorCode !== 'unsupported-format') throw new Error('expected unsupported format failure')
}

export function testImageToThreeJsSkillUsesConnectedImageBeforeLocalFallback() {
  const sourceUrl = resolveImageToThreeJsSourceUrl({
    node: { properties: { sourceImageUrl: 'workspace:/media/local.png' } },
    connectedValuesBySchemaPath: {
      'properties.sourceImageUrl': {
        value: 'workspace:/media/connected.jpg',
        sources: [{ edgeId: 'edge-image', nodeId: 'source-image', portKey: 'imageUrl' }],
      },
    },
  })
  if (sourceUrl !== 'workspace:/media/connected.jpg') throw new Error(`expected connected source, got ${sourceUrl}`)
}

export function testImageToThreeJsSkillRegistryAndMediaProjectionShareCanonicalMode() {
  const draft = buildImageToThreeJsSkillRegistryDraft()
  if (draft.nodeTypeId !== IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID || draft.formId !== IMAGE_TO_THREEJS_SKILL_FORM_ID) {
    throw new Error('expected canonical image-to-threejs skill registry identity')
  }
  const node = {
    id: 'image-threejs',
    type: IMAGE_TO_THREEJS_SKILL_NODE_TYPE_ID,
    label: 'Three.js image',
    properties: {
      'flow:widgetFormId': IMAGE_TO_THREEJS_SKILL_FORM_ID,
      imageUrl: 'https://assets.example/object.png',
      mediaRenderMode: IMAGE_TO_THREEJS_RENDER_MODE,
    },
  } as const
  if (!isImageToThreeJsSkillNode(node as never)) throw new Error('expected skill-node detection')
  const media = getNodeMediaSpec(node as never)
  if (!media || media.kind !== 'image' || media.renderMode !== IMAGE_TO_THREEJS_RENDER_MODE) {
    throw new Error(`expected Three.js node media projection, got ${JSON.stringify(media)}`)
  }
  const view = buildWidgetCompactPreviewViewModel({
    preview: {
      kind: 'image',
      schemaPath: 'properties.imageUrl',
      portKey: 'imageUrl',
      source: 'local',
      editable: false,
      url: 'https://assets.example/object.png',
    },
    node: node as never,
  })
  if (!view || view.kind !== 'image' || view.renderMode !== IMAGE_TO_THREEJS_RENDER_MODE) {
    throw new Error(`expected Widget preview to preserve Three.js mode, got ${JSON.stringify(view)}`)
  }
}

export function testImageToThreeJsSurfaceUsesNativeThreeLoadersAndExplicitDisposal() {
  const source = readFileSync(new URL('../features/image-to-threejs/ImageThreeJsSurface.tsx', import.meta.url), 'utf8')
  const required = [
    'new THREE.TextureLoader()',
    'loaded.colorSpace = THREE.SRGBColorSpace',
    'new SVGLoader().parse(text)',
    'SVGLoader.createShapes(path)',
    'SVGLoader.pointsToStroke(',
    'ownedTexture?.dispose()',
    'disposeImageThreeJsObject(ownedGroup)',
    'frameloop="demand"',
    'key={`svg:${sourceUrl}`}',
    'key={`raster:${sourceUrl}`}',
  ]
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`missing native Three.js lifecycle contract: ${token}`)
  }
  if (source.includes('Three.js-Object-Sculptor-Codex-Plugin')) {
    throw new Error('forbid copied or runtime-dependent external plugin source')
  }
  const workflowSource = readFileSync(new URL('../components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowMediaRunHandlers.ts', import.meta.url), 'utf8')
  for (const token of [
    'isImageToThreeJsSkillNode(args.node)',
    'buildImageToThreeJsConversion(sourceUrl)',
    'publishMediaRunOutputToRichMediaPanel({ anchorNode: args.node, patch: result.patch })',
  ]) {
    if (!workflowSource.includes(token)) throw new Error(`missing image-to-threejs workflow projection: ${token}`)
  }
  const cardSource = readFileSync(new URL('../lib/cards/CardMediaPreview.tsx', import.meta.url), 'utf8')
  if (!cardSource.includes('<ImageThreeJsSurface')) throw new Error('expected shared Card media projection to own the Three.js surface')
}

export function testImageToThreeJsBuildsAndDisposesRealSvgGeometry() {
  const harness = initJsdomHarness()
  try {
    const group = buildImageThreeJsSvgGroup([
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">',
      '<rect x="4" y="4" width="112" height="72" rx="8" fill="#2563eb"/>',
      '<path d="M16 58 L52 20 L104 60" fill="none" stroke="#f8fafc" stroke-width="6"/>',
      '</svg>',
    ].join(''))
    const meshes: THREE.Mesh[] = []
    group.traverse(object => {
      if (object instanceof THREE.Mesh) meshes.push(object)
    })
    if (meshes.length < 2) throw new Error(`expected SVG fill and stroke meshes, got ${meshes.length}`)

    const renderedBounds = new THREE.Box3().setFromObject(group)
    const renderedSize = renderedBounds.getSize(new THREE.Vector3())
    const largestDimension = Math.max(renderedSize.x, renderedSize.y)
    if (!Number.isFinite(largestDimension) || Math.abs(largestDimension - 2.2) > 0.001) {
      throw new Error(`expected bounded SVG fit at 2.2 units, got ${largestDimension}`)
    }

    let disposedGeometryCount = 0
    let disposedMaterialCount = 0
    for (const mesh of meshes) {
      mesh.geometry.addEventListener('dispose', () => { disposedGeometryCount += 1 })
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(material => material.addEventListener('dispose', () => { disposedMaterialCount += 1 }))
    }
    disposeImageThreeJsObject(group)
    if (disposedGeometryCount !== meshes.length || disposedMaterialCount !== meshes.length) {
      throw new Error(`expected every SVG mesh resource to dispose, got geometry=${disposedGeometryCount} material=${disposedMaterialCount}`)
    }
  } finally {
    harness.restore()
  }
}

export function testImageToThreeJsForbidsExternalPluginRuntimeDependency() {
  const packageJson = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
  const contractSource = readFileSync(new URL('../features/image-to-threejs/imageToThreeJsContract.ts', import.meta.url), 'utf8')
  const surfaceSource = readFileSync(new URL('../features/image-to-threejs/ImageThreeJsSurface.tsx', import.meta.url), 'utf8')
  const combinedRuntimeSource = [packageJson, contractSource, surfaceSource].join('\n')
  for (const forbidden of ['Three.js-Object-Sculptor-Codex-Plugin', 'object-to-threejs-procedural']) {
    if (combinedRuntimeSource.includes(forbidden)) {
      throw new Error(`forbid external Object Sculptor runtime dependency: ${forbidden}`)
    }
  }
}
