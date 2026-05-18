import { getVoxelModeInapplicableReason, isVoxelModeApplicable, normalizeCanvas3dMode, resolveCanvas3dMode } from '@/lib/canvas/canvas3dMode'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage } from '@/lib/persistence'
import { readGeospatialOverlayEnabledPreference, writeGeospatialOverlayEnabledPreference } from '@/lib/geospatial/geospatialModePreference'
import type { GraphSchema } from '@/lib/graph/schema'

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
