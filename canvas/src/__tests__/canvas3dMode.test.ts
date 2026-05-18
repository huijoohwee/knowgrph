import { getVoxelModeInapplicableReason, isVoxelModeApplicable, normalizeCanvas3dMode, resolveCanvas3dMode } from '@/lib/canvas/canvas3dMode'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage } from '@/lib/persistence'
import { readGeospatialOverlayEnabledPreference, writeGeospatialOverlayEnabledPreference } from '@/lib/geospatial/geospatialModePreference'
import { parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { loadModelAssetRenderPayload } from '@/lib/assets/modelAssetPayload'
import { buildGltfAssetMarkdown } from '@/features/markdown-workspace/workspaceImport/glbAsset'
import type { GraphSchema } from '@/lib/graph/schema'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BLOCK_SCHEMA = {
  layout: { mode: 'block' },
  behavior: {
    allowEdgeCreation: true,
    allowNodeDrag: true,
  },
  nodeStyles: {},
  edgeStyles: {},
  rules: [],
} as unknown as GraphSchema

export function testVoxelModeRejectsGeospatialMode() {
  const args = {
    canvas2dRenderer: 'flowchart' as const,
    documentSemanticMode: 'document' as const,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    geospatialEnabled: true,
    schema: BLOCK_SCHEMA,
  }
  const reason = getVoxelModeInapplicableReason(args)
  if (reason !== 'geospatial') {
    throw new Error(`Expected Voxel Mode to report geospatial inapplicable reason, got ${String(reason)}`)
  }
  if (isVoxelModeApplicable(args)) {
    throw new Error('Expected Voxel Mode to be inapplicable while Geospatial Mode is enabled')
  }
  const resolved = resolveCanvas3dMode({ ...args, requested: 'voxel' })
  if (resolved !== '3d') {
    throw new Error(`Expected Voxel Mode request to fall back to 3D in Geospatial Mode, got ${resolved}`)
  }
}

export function testXrModeNormalizesAndCanvasViewSelectionActivatesSurface() {
  if (normalizeCanvas3dMode('xr') !== 'xr') {
    throw new Error('Expected XR Mode to normalize as a first-class 3D canvas mode')
  }

  let selectedRenderMode: '2d' | '3d' | null = null
  let canvas3dMode: string | null = null

  applyCanvasViewSelection({
    id: 'surface:xr',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => {
      throw new Error('Expected XR Mode selection to avoid opening Geospatial Mode when geospatial is disabled')
    },
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: () => {},
    setCanvasRenderMode: mode => { selectedRenderMode = mode },
    setCanvas3dMode: mode => { canvas3dMode = mode },
    setSchema: () => {},
    setRenderMediaAsNodes: () => {},
    setDocumentSemanticMode: () => {},
    setFrontmatterModeEnabled: () => {},
    setMultiDimTableModeEnabled: () => {},
  })

  if (selectedRenderMode !== '3d') {
    throw new Error(`Expected XR Mode selection to activate 3D canvas rendering, got ${String(selectedRenderMode)}`)
  }
  if (canvas3dMode !== 'xr') {
    throw new Error(`Expected XR Mode selection to set canvas3dMode=xr, got ${String(canvas3dMode)}`)
  }
}

export function testRenderSettings3dModeSelectPreservesXrMode() {
  const text = readFileSync(resolve(process.cwd(), 'src/lib/panels/views/RenderSettingsSection.impl.tsx'), 'utf8')
  if (!text.includes('<option value="xr">xr</option>')) {
    throw new Error('Expected Render Settings 3D Mode select to expose XR as a selectable value')
  }
  if (!text.includes(`raw === 'xr' ? 'xr' : '3d'`)) {
    throw new Error('Expected Render Settings 3D Mode onChange to preserve XR instead of coercing it to 3D')
  }
}

export function testXrModeRendersGlbAssetDocumentsWithoutWebxrSessionGate() {
  const threeGraph = readFileSync(resolve(process.cwd(), 'src/lib/three/ThreeGraph.impl.tsx'), 'utf8')
  if (!threeGraph.includes('parseGlbAssetDocument(markdownDocumentText)')) {
    throw new Error('Expected ThreeGraph to detect active model asset documents from markdown document text')
  }
  if (!threeGraph.includes('const hasRenderableScene = hasGraph || hasGlbAsset')) {
    throw new Error('Expected ThreeGraph to keep the canvas mounted for model asset documents without graph nodes')
  }
  if (!threeGraph.includes('<GlbAssetModel')) {
    throw new Error('Expected XR/3D canvas to render active model asset documents with the shared model component')
  }
  const unavailableLabel = ['XR', 'unavailable'].join(' ')
  if (threeGraph.includes(unavailableLabel)) {
    throw new Error('Expected XR Mode to avoid surfacing the unavailable XR label as the model-rendering state')
  }
  const glbModel = readFileSync(resolve(process.cwd(), 'src/lib/three/GlbAssetModel.tsx'), 'utf8')
  const payloadHelper = readFileSync(resolve(process.cwd(), 'src/lib/assets/modelAssetPayload.ts'), 'utf8')
  if (!payloadHelper.includes('asset.validMagic === false')) {
    throw new Error('Expected GLB rendering to honor ingest-time GLB magic validation through the shared payload helper')
  }
  if (!glbModel.includes('kg_model_xr_orientation_ring') || !glbModel.includes('kg_model_xr_perimeter_markers')) {
    throw new Error('Expected XR Mode model rendering to include a neutral spatial inspection stage')
  }
}

export function testXrModeRendersGltfAssetDocumentsWithoutWebxrSessionGate() {
  const glbModel = readFileSync(resolve(process.cwd(), 'src/lib/three/GlbAssetModel.tsx'), 'utf8')
  const payloadHelper = readFileSync(resolve(process.cwd(), 'src/lib/assets/modelAssetPayload.ts'), 'utf8')
  if (!payloadHelper.includes(`asset.format === 'gltf' && asset.validJson === false`)) {
    throw new Error('Expected GLTF rendering to honor ingest-time JSON validation')
  }
  if (!payloadHelper.includes(`asset.format === 'gltf'`) || !payloadHelper.includes('new TextDecoder().decode(bytes)')) {
    throw new Error('Expected GLTF rendering to parse JSON text payloads through the shared model payload helper')
  }
  if (!payloadHelper.includes('deriveModelAssetResourceBasePath(asset.sourceUrl)')) {
    throw new Error('Expected GLTF rendering to preserve a source-relative base path for external GLTF resources')
  }
  if (!glbModel.includes('loader.parse(') || !glbModel.includes('gltf.scene || gltf.scenes?.[0]')) {
    throw new Error('Expected GLTF rendering to add the loaded GLTF scene object')
  }
  if (!glbModel.includes('new THREE.AnimationMixer(scene)') || !glbModel.includes('mixerRef.current?.update(delta)')) {
    throw new Error('Expected GLTF rendering to play and advance embedded model animations')
  }
  if (!glbModel.includes('kg_model_xr_city_grid') || !glbModel.includes('kg_model_xr_city_block_')) {
    throw new Error('Expected XR model stage to expose an original city-grid inspection theme for GLTF assets')
  }
  if (!glbModel.includes('kg_model_xr_streaming_ring') || !glbModel.includes('kg_model_xr_focus_target')) {
    throw new Error('Expected XR model stage to expose streaming horizon and focus affordances for model inspection')
  }
  if (!glbModel.includes('kg_model_xr_lane_marker_') || !glbModel.includes('kg_model_xr_avenue_')) {
    throw new Error('Expected XR model stage to expose dense road and lane-marker visual structure')
  }
  if (!glbModel.includes('kg_model_xr_traffic_loop') || !glbModel.includes('kg_model_xr_traffic_')) {
    throw new Error('Expected XR model stage to expose animated traffic affordances for GLTF assets')
  }
}

export async function testXrModeGltfIngestParseRenderPipelineUsesNeutralPayload() {
  const sourceUrl = 'https://assets.example.invalid/scene-pack/neutral-city.gltf?rev=7#model'
  const gltfJson = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'neutral_city_probe' }],
  })
  const text = buildGltfAssetMarkdown({
    name: 'neutral-city.gltf',
    sourceKind: 'url',
    sourceUrl,
    text: gltfJson,
  })
  const asset = parseGlbAssetDocument(text)
  if (!asset) throw new Error('Expected imported GLTF manifest to parse as a model asset')
  const payload = await loadModelAssetRenderPayload(asset)
  if (payload.format !== 'gltf') throw new Error(`Expected render payload format gltf, got ${payload.format}`)
  if (payload.basePath !== 'https://assets.example.invalid/scene-pack/') {
    throw new Error(`Expected GLTF base path to preserve the source directory, got ${payload.basePath}`)
  }
  if (typeof payload.loaderInput !== 'string' || !payload.loaderInput.includes('neutral_city_probe')) {
    throw new Error('Expected GLTF payload helper to expose parseable JSON text for GLTFLoader')
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loaded = await new Promise<{ scene?: unknown; scenes?: unknown[] }>((resolveLoaded, rejectLoaded) => {
    new GLTFLoader().parse(
      payload.loaderInput,
      payload.basePath,
      gltf => resolveLoaded(gltf),
      err => rejectLoaded(err instanceof Error ? err : new Error(String(err || 'GLTF parse failed'))),
    )
  })
  const scene = loaded.scene || loaded.scenes?.[0]
  if (!scene) throw new Error('Expected GLTFLoader to parse the neutral GLTF payload into a renderable scene')
}

export function testCanvasViewSelectionBlocksVoxelDuringGeospatialMode() {
  let openedGeospatialMode = 0
  let setCanvas2dRendererCalls = 0
  let setCanvas3dModeCalls = 0
  let setCanvasRenderModeCalls = 0
  let setSchemaCalls = 0

  applyCanvasViewSelection({
    id: 'surface:voxel',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: true,
    onOpenGeospatialMode: () => { openedGeospatialMode += 1 },
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: () => { setCanvas2dRendererCalls += 1 },
    setCanvasRenderMode: () => { setCanvasRenderModeCalls += 1 },
    setCanvas3dMode: () => { setCanvas3dModeCalls += 1 },
    setSchema: () => { setSchemaCalls += 1 },
    setRenderMediaAsNodes: () => {},
    setDocumentSemanticMode: () => {},
    setFrontmatterModeEnabled: () => {},
    setMultiDimTableModeEnabled: () => {},
  })

  if (openedGeospatialMode !== 1) {
    throw new Error(`Expected Geospatial Mode opener to run once, got ${openedGeospatialMode}`)
  }
  if (setCanvas2dRendererCalls !== 0 || setCanvas3dModeCalls !== 0 || setCanvasRenderModeCalls !== 0 || setSchemaCalls !== 0) {
    throw new Error('Expected Voxel selection to avoid renderer or schema mutations while Geospatial Mode is enabled')
  }
}

export function testCanvas3dModeSetterRejectsVoxelWhileGeospatialModeIsPersisted() {
  const storage = getLocalStorage()
  const prev = storage?.getItem(LS_KEYS.geospatialOverlayEnabled) ?? null
  const prevVersion = storage?.getItem(LS_KEYS.geospatialOverlayPreferenceVersion) ?? null
  try {
    useGraphStore.getState().resetAll()
    useGraphStore.getState().setDocumentStructureBaselineLock(false)
    writeGeospatialOverlayEnabledPreference(true)
    useGraphStore.getState().setSchema(BLOCK_SCHEMA)
    useGraphStore.getState().setCanvas2dRenderer('flowchart')
    useGraphStore.getState().setDocumentSemanticMode('document')
    useGraphStore.getState().setCanvas3dMode('voxel')
    const next = useGraphStore.getState().canvas3dMode
    if (next !== '3d') {
      throw new Error(`Expected persisted geospatial guard to demote voxel request to 3d, got ${String(next)}`)
    }
  } finally {
    if (!storage) return
    if (prev == null) {
      storage.removeItem(LS_KEYS.geospatialOverlayEnabled)
    } else {
      storage.setItem(LS_KEYS.geospatialOverlayEnabled, prev)
    }
    if (prevVersion == null) {
      storage.removeItem(LS_KEYS.geospatialOverlayPreferenceVersion)
    } else {
      storage.setItem(LS_KEYS.geospatialOverlayPreferenceVersion, prevVersion)
    }
    useGraphStore.getState().resetAll()
  }
}

export function testGeospatialOverlayPreferenceIgnoresLegacyUnversionedTrue() {
  const storage = getLocalStorage()
  if (!storage) return
  const prev = storage.getItem(LS_KEYS.geospatialOverlayEnabled)
  const prevVersion = storage.getItem(LS_KEYS.geospatialOverlayPreferenceVersion)
  try {
    storage.setItem(LS_KEYS.geospatialOverlayEnabled, 'true')
    storage.removeItem(LS_KEYS.geospatialOverlayPreferenceVersion)
    if (readGeospatialOverlayEnabledPreference()) {
      throw new Error('Expected legacy unversioned geospatial=true storage to stay neutral on startup')
    }
    writeGeospatialOverlayEnabledPreference(true)
    if (!readGeospatialOverlayEnabledPreference()) {
      throw new Error('Expected current shared geospatial preference writer to persist intentional enabled state')
    }
  } finally {
    if (prev == null) storage.removeItem(LS_KEYS.geospatialOverlayEnabled)
    else storage.setItem(LS_KEYS.geospatialOverlayEnabled, prev)
    if (prevVersion == null) storage.removeItem(LS_KEYS.geospatialOverlayPreferenceVersion)
    else storage.setItem(LS_KEYS.geospatialOverlayPreferenceVersion, prevVersion)
  }
}
