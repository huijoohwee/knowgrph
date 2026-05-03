import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyInteractiveImportModes } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { resolveCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { materializeActiveWorkspaceEntryIntoSourceFiles } from '@/features/source-files/sourceFilesRuntimeShared'
import { LS_KEYS } from '@/lib/config'
import { readGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { lsBool } from '@/lib/persistence'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import fs from 'node:fs'
import path from 'node:path'

export function testFrontmatterFlowImportModeDoesNotForceFlowEditorRenderer() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setDocumentSemanticMode('document')
  useGraphStore.getState().setFrontmatterModeEnabled(true)

  const changed = applyFrontmatterFlowImportModes({
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [{ id: 'w1', type: 'TextGeneration', label: 'w1', properties: { 'flow:widgetFormId': 'textGeneration.openai' } }],
    edges: [],
  } as never)

  const st = useGraphStore.getState()
  if (st.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected import mode to prefer flowEditor renderer, got ${String(st.canvas2dRenderer)}`)
  }
  if (changed !== true) {
    throw new Error('expected import mode to report changed when renderer switched')
  }
}

export function testWorkspaceImportModesPreferFrontmatterFlowLandingContract() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setDocumentSemanticMode('keyword')
  useGraphStore.getState().setFrontmatterModeEnabled(false)
  useGraphStore.getState().setMultiDimTableModeEnabled(true)

  applyInteractiveImportModes({
    graphData: {
      type: 'Graph',
      context: 'frontmatter-flow',
      metadata: {
        kind: 'frontmatter-flow',
        frontmatterFlowSettings: {
          edgeType: 'smoothstep',
        },
      },
      nodes: [{ id: 'w1', type: 'TextGeneration', label: 'w1', properties: { 'flow:widgetFormId': 'textGeneration' } }],
      edges: [],
    } as never,
  })

  const st = useGraphStore.getState()
  if (st.canvasRenderMode !== '2d') throw new Error(`expected 2d canvas render mode, got ${String(st.canvasRenderMode)}`)
  if (st.canvas2dRenderer !== 'flowEditor') throw new Error(`expected flowEditor renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected document semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected frontmatter mode enabled for frontmatter-flow import landing')
  if (st.multiDimTableModeEnabled !== false) throw new Error('expected multidim table disabled for frontmatter-flow import landing')
  if (readGlobalEdgeType(st.schema) !== 'smoothstep') {
    throw new Error(`expected frontmatter-flow import landing to sync schema edge type, got ${readGlobalEdgeType(st.schema)}`)
  }
}

export function testWorkspaceImportModesPreferFrontmatterOnlyDocLandingContract() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvasRenderMode('3d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setDocumentSemanticMode('keyword')
  useGraphStore.getState().setFrontmatterModeEnabled(false)
  useGraphStore.getState().setMultiDimTableModeEnabled(true)

  applyInteractiveImportModes({ frontmatterOnlyDoc: true })

  const st = useGraphStore.getState()
  if (st.canvasRenderMode !== '2d') throw new Error(`expected frontmatter-only import to force 2d render mode, got ${String(st.canvasRenderMode)}`)
  if (st.canvas2dRenderer !== 'flowEditor') throw new Error(`expected frontmatter-only import to prefer flowEditor renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected frontmatter-only import to force document semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected frontmatter-only import to enable frontmatter mode')
  if (st.multiDimTableModeEnabled !== false) throw new Error('expected frontmatter-only import to disable multidim table mode')
}

export function testWorkspaceImportModesHonorExplicitMarkdownFrontmatterPreset() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(true)
  useGraphStore.getState().setCanvasRenderMode('3d')
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  useGraphStore.getState().setDocumentSemanticMode('keyword')
  useGraphStore.getState().setFrontmatterModeEnabled(false)

  const rawText = [
    '---',
    'title: "Knowgrph"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "d3"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Knowgrph',
  ].join('\n')

  const preset = resolveCanvasFrontmatterPreset({ rawText })
  if (!preset) throw new Error('expected explicit markdown frontmatter preset to resolve')
  if (preset.canvas2dRenderer !== 'd3') throw new Error(`expected preset renderer d3, got ${String(preset.canvas2dRenderer)}`)
  if (preset.documentStructureBaselineLock !== false) throw new Error('expected preset view lock to resolve OFF')

  applyInteractiveImportModes({ rawText })

  const st = useGraphStore.getState()
  if (st.canvasRenderMode !== '2d') throw new Error(`expected explicit preset to force 2d canvas render mode, got ${String(st.canvasRenderMode)}`)
  if (st.canvas2dRenderer !== 'd3') throw new Error(`expected explicit preset to force d3 renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected explicit preset to force document semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected explicit preset to enable frontmatter mode')
  if (st.documentStructureBaselineLock !== false) throw new Error('expected explicit preset to force View Lock OFF')
}

export function testWorkspaceImportModesNormalizeRendererAliasesAndExplicitTableMode() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(true)
  useGraphStore.getState().setCanvasRenderMode('3d')
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  useGraphStore.getState().setDocumentSemanticMode('document')
  useGraphStore.getState().setFrontmatterModeEnabled(true)
  useGraphStore.getState().setMultiDimTableModeEnabled(false)

  const rawText = [
    '---',
    'title: "Flowchart Alias"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "Flowchart"',
    'kgDocumentSemanticMode: "Keyword Mode"',
    'kgFrontmatterModeEnabled: false',
    'kgMultiDimTableModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Flowchart Alias',
  ].join('\n')

  const preset = resolveCanvasFrontmatterPreset({ rawText })
  if (!preset) throw new Error('expected flowchart alias preset to resolve')
  if (preset.canvas2dRenderer !== 'flowchart') throw new Error(`expected Flowchart alias to normalize to flowchart, got ${String(preset.canvas2dRenderer)}`)
  if (preset.documentSemanticMode !== 'keyword') throw new Error(`expected Keyword Mode alias to normalize to keyword, got ${String(preset.documentSemanticMode)}`)
  if (preset.frontmatterModeEnabled !== false) throw new Error('expected explicit frontmatter OFF to resolve')
  if (preset.multiDimTableModeEnabled !== true) throw new Error('expected explicit multi-dimensional table mode ON to resolve')

  applyInteractiveImportModes({ rawText })

  const st = useGraphStore.getState()
  if (st.canvasRenderMode !== '2d') throw new Error(`expected explicit preset to force 2d canvas render mode, got ${String(st.canvasRenderMode)}`)
  if (st.canvas2dRenderer !== 'flowchart') throw new Error(`expected Flowchart alias landing to use flowchart, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'keyword') throw new Error(`expected explicit keyword mode landing, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== false) throw new Error('expected explicit frontmatter OFF to be preserved')
  if (st.multiDimTableModeEnabled !== true) throw new Error('expected explicit multi-dimensional table mode ON to be preserved')
  if (st.documentStructureBaselineLock !== false) throw new Error('expected explicit preset to unlock baseline lock')
}

export function testWorkspaceImportModesNormalizeFlowCanvasAliasToFrontmatterOnlyLanding() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('flowchart')
  useGraphStore.getState().setDocumentSemanticMode('keyword')
  useGraphStore.getState().setFrontmatterModeEnabled(false)
  useGraphStore.getState().setMultiDimTableModeEnabled(true)

  const rawText = [
    '---',
    'title: "Flow Canvas Alias"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "Flow Canvas"',
    'kgDocumentSemanticMode: "Keyword Mode"',
    'kgFrontmatterModeEnabled: false',
    'kgMultiDimTableModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Flow Canvas Alias',
  ].join('\n')

  const preset = resolveCanvasFrontmatterPreset({ rawText })
  if (!preset) throw new Error('expected flow canvas alias preset to resolve')
  if (preset.canvas2dRenderer !== 'flow') throw new Error(`expected Flow Canvas alias to normalize to flow, got ${String(preset.canvas2dRenderer)}`)

  applyInteractiveImportModes({ rawText })

  const st = useGraphStore.getState()
  if (st.canvas2dRenderer !== 'flow') throw new Error(`expected Flow Canvas alias landing to use flow renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected frontmatter-only flow renderer to force document semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected frontmatter-only flow renderer to force frontmatter mode ON')
  if (st.multiDimTableModeEnabled !== false) throw new Error('expected frontmatter-only flow renderer to force multi-dimensional table mode OFF')
}

export function testCanvasFrontmatterPresetDisablesGeospatialOverlayFor2dDocuments() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    window.localStorage.setItem(LS_KEYS.geospatialOverlayEnabled, 'true')

    const rawText = [
      '---',
      'title: "Knowgrph"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "flowEditor"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: true',
      'kgDocumentStructureBaselineLock: false',
      '---',
      '',
      '# Knowgrph',
    ].join('\n')

    applyInteractiveImportModes({ rawText })

    const next = window.localStorage.getItem(LS_KEYS.geospatialOverlayEnabled)
    if (next !== '0' && next !== 'false') {
      throw new Error(`expected 2d frontmatter preset to disable geospatial overlay, got ${String(next)}`)
    }
  } finally {
    restore()
  }
}

export function testCanvasFrontmatterPresetEnablesGeospatialSurfaceMode() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    window.localStorage.setItem(LS_KEYS.geospatialOverlayEnabled, 'false')
    useGraphStore.getState().setCanvasRenderMode('3d')
    useGraphStore.getState().setCanvas2dRenderer('d3')
    useGraphStore.getState().setDocumentSemanticMode('keyword')
    useGraphStore.getState().setFrontmatterModeEnabled(false)
    useGraphStore.getState().setMultiDimTableModeEnabled(true)

    const rawText = [
      '---',
      'title: "GrabMaps Surface Preset"',
      'kgCanvasSurfaceMode: "geospatial"',
      'kgCanvas2dRenderer: "flowEditor"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: true',
      'kgMultiDimTableModeEnabled: false',
      'kgDocumentStructureBaselineLock: false',
      '---',
      '',
      '# GrabMaps Surface Preset',
    ].join('\n')

    const preset = resolveCanvasFrontmatterPreset({ rawText })
    if (!preset) throw new Error('expected geospatial surface preset to resolve')
    if (preset.canvasSurfaceMode !== 'geospatial') {
      throw new Error(`expected geospatial surface mode, got ${String(preset.canvasSurfaceMode || '')}`)
    }

    applyInteractiveImportModes({ rawText })

    const st = useGraphStore.getState()
    const next = window.localStorage.getItem(LS_KEYS.geospatialOverlayEnabled)
    if (next !== '1' && next !== 'true') {
      throw new Error(`expected geospatial surface preset to enable geospatial overlay, got ${String(next)}`)
    }
    if (st.canvasRenderMode !== '2d') throw new Error(`expected geospatial surface preset to normalize render mode to 2d, got ${String(st.canvasRenderMode)}`)
    if (st.canvas2dRenderer !== 'flowEditor') throw new Error(`expected geospatial surface preset to preserve flowEditor renderer, got ${String(st.canvas2dRenderer)}`)
    if (st.documentSemanticMode !== 'document') throw new Error(`expected geospatial surface preset to apply document semantic mode, got ${String(st.documentSemanticMode)}`)
    if (st.frontmatterModeEnabled !== true) throw new Error('expected geospatial surface preset to enable frontmatter mode')
    if (st.multiDimTableModeEnabled !== false) throw new Error('expected geospatial surface preset to disable multi-dimensional table mode')
  } finally {
    restore()
  }
}

export function testCanvasFrontmatterPresetEnables3dSurfaceModeAndVoxelMode() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    window.localStorage.setItem(LS_KEYS.geospatialOverlayEnabled, 'true')
    useGraphStore.getState().setCanvasRenderMode('2d')
    useGraphStore.getState().setCanvas3dMode('3d')
    useGraphStore.getState().setCanvas2dRenderer('flowchart')
    useGraphStore.getState().setDocumentSemanticMode('document')
    useGraphStore.getState().setFrontmatterModeEnabled(false)
    useGraphStore.getState().setMultiDimTableModeEnabled(false)

    const rawText = [
      '---',
      'title: "3D Surface Preset"',
      'kgCanvasSurfaceMode: "3d"',
      'kgCanvas3dMode: "voxel"',
      'kgCanvas2dRenderer: "flowchart"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: false',
      'kgMultiDimTableModeEnabled: false',
      'kgDocumentStructureBaselineLock: false',
      '---',
      '',
      '# 3D Surface Preset',
    ].join('\n')

    const preset = resolveCanvasFrontmatterPreset({ rawText })
    if (!preset) throw new Error('expected 3d surface preset to resolve')
    if (preset.canvasSurfaceMode !== '3d') throw new Error(`expected 3d surface mode, got ${String(preset.canvasSurfaceMode || '')}`)
    if (preset.canvas3dMode !== 'voxel') throw new Error(`expected voxel 3d mode, got ${String(preset.canvas3dMode || '')}`)

    applyInteractiveImportModes({ rawText })

    const st = useGraphStore.getState()
    const next = window.localStorage.getItem(LS_KEYS.geospatialOverlayEnabled)
    if (next !== '0' && next !== 'false') {
      throw new Error(`expected 3d surface preset to disable geospatial overlay, got ${String(next)}`)
    }
    if (st.canvasRenderMode !== '3d') throw new Error(`expected 3d surface preset to force 3d render mode, got ${String(st.canvasRenderMode)}`)
    if (st.canvas3dMode !== 'voxel') throw new Error(`expected 3d surface preset to force voxel mode, got ${String(st.canvas3dMode)}`)
    if (st.canvas2dRenderer !== 'flowchart') throw new Error(`expected 3d surface preset to preserve flowchart renderer, got ${String(st.canvas2dRenderer)}`)
  } finally {
    restore()
  }
}

export async function testActiveMarkdownDocumentSwitchReappliesExplicitFrontmatterPreset() {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setDocumentStructureBaselineLock(true)
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setDocumentSemanticMode('keyword')
  useGraphStore.getState().setFrontmatterModeEnabled(false)
  useGraphStore.getState().setMultiDimTableModeEnabled(true)

  const text = [
    '---',
    'title: "Video Demo"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Video Demo',
  ].join('\n')

  const ok = await useGraphStore.getState().setActiveMarkdownDocument({
    name: '/knowgrph-video-demo.md',
    text,
    normalizeMermaidMmd: false,
    autoEnableFrontmatter: false,
  })
  if (ok !== true) throw new Error('expected active markdown document switch to complete')

  const st = useGraphStore.getState()
  if (st.canvasRenderMode !== '2d') throw new Error(`expected active doc switch to preserve 2d canvas render mode, got ${String(st.canvasRenderMode)}`)
  if (st.canvas2dRenderer !== 'flowEditor') throw new Error(`expected active doc switch to reapply flowEditor renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected active doc switch to reapply document semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected active doc switch to re-enable frontmatter mode')
  if (st.documentStructureBaselineLock !== false) throw new Error('expected active doc switch to reapply unlocked baseline setting')
  if (st.multiDimTableModeEnabled !== false) throw new Error('expected active doc switch to disable multi-dimensional table mode when preset reapplies')
}

export async function testActiveMarkdownDocumentSwitchCanSkipExplicitFrontmatterPresetForPassiveSelection() {
  useGraphStore.getState().resetAll()
  useGraphStore.setState({
    graphData: null,
    graphDataRevision: 0,
    graphContentRevision: 0,
    docLocationRevision: 0,
  })

  const readmeText = [
    '---',
    'title: "Knowgrph"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "d3"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Knowgrph',
  ].join('\n')

  const seeded = await useGraphStore.getState().setActiveMarkdownDocument({
    name: '/README.md',
    text: readmeText,
    normalizeMermaidMmd: false,
    autoEnableFrontmatter: false,
  })
  if (seeded !== true) throw new Error('expected README setup switch to complete')

  {
    const before = useGraphStore.getState()
    if (before.canvas2dRenderer !== 'd3') throw new Error(`expected README setup to land on d3 renderer, got ${String(before.canvas2dRenderer)}`)
    if (before.documentSemanticMode !== 'document') throw new Error(`expected README setup to land on document semantic mode, got ${String(before.documentSemanticMode)}`)
    if (before.frontmatterModeEnabled !== true) throw new Error('expected README setup to enable frontmatter mode')
  }

  const text = [
    '---',
    'title: "Video Demo"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgDocumentStructureBaselineLock: false',
    '---',
    '',
    '# Video Demo',
  ].join('\n')

  const ok = await useGraphStore.getState().setActiveMarkdownDocument({
    name: '/knowgrph-video-demo.md',
    text,
    normalizeMermaidMmd: false,
    autoEnableFrontmatter: false,
    applyViewPreset: false,
  })
  if (ok !== true) throw new Error('expected passive active markdown document switch to complete')

  const st = useGraphStore.getState()
  if (st.markdownDocumentName !== '/knowgrph-video-demo.md') {
    throw new Error(`expected passive active doc switch to update markdown document name, got ${String(st.markdownDocumentName)}`)
  }
  if (st.markdownDocumentText !== text) {
    throw new Error('expected passive active doc switch to update markdown document text')
  }
  if (st.canvas2dRenderer !== 'd3') throw new Error(`expected passive active doc switch to preserve README renderer, got ${String(st.canvas2dRenderer)}`)
  if (st.documentSemanticMode !== 'document') throw new Error(`expected passive active doc switch to preserve README semantic mode, got ${String(st.documentSemanticMode)}`)
  if (st.frontmatterModeEnabled !== true) throw new Error('expected passive active doc switch to preserve README frontmatter mode')
  if (st.documentStructureBaselineLock !== false) throw new Error('expected passive active doc switch to preserve README baseline lock setting')
}

export function testPerDocumentUiRestorePrefersFrontmatterFlowLandingContract() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'features', 'canvas', 'GraphStoreRuntime.tsx')
  const text = fs.readFileSync(runtimePath, 'utf8')
  if (!text.includes('const shouldPreferFrontmatterFlowLanding = isFrontmatterFlowGraph(graphData)')) {
    throw new Error('expected per-document UI restore to detect frontmatter-flow graph landing contract')
  }
  if (!text.includes('applyFrontmatterFlowImportModes(graphData)')) {
    throw new Error('expected per-document UI restore to reuse shared frontmatter-flow landing helper')
  }
  if (!text.includes('const presetApplied = applyCanvasFrontmatterPreset({ graphData, rawText })')) {
    throw new Error('expected per-document UI restore to apply explicit frontmatter workspace presets before saved ui state')
  }
  if (!text.includes('if (!presetApplied) {')) {
    throw new Error('expected saved canvas/ui restore to be skipped when an explicit frontmatter workspace preset is present')
  }
}

export function testInitializationWorkspaceSelectionPromotesAtomicGraphAndPresetLanding() {
  const documentActionsPath = path.resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts')
  const indexingPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const runtimeIoPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntime.io.ts')

  const documentActionsText = fs.readFileSync(documentActionsPath, 'utf8')
  const indexingText = fs.readFileSync(indexingPath, 'utf8')
  const runtimeIoText = fs.readFileSync(runtimeIoPath, 'utf8')

  if (!documentActionsText.includes('args?.applyViewPreset !== false && !args?.applyToGraph && text.trim()')) {
    throw new Error('expected active markdown document switching to defer raw frontmatter preset replay when graph apply is requested')
  }
  if (!indexingText.includes('const shouldApplyInitializationDocumentLanding =')) {
    throw new Error('expected workspace indexing to centralize initialization-file landing behind an explicit switch contract')
  }
  if (!indexingText.includes('isInitializationWorkspacePath(path)')) {
    throw new Error('expected initialization-file landing contract to target the shared workspace seed path helper')
  }
  if (!indexingText.includes('applyViewPreset: true') || !indexingText.includes('applyToGraph: true') || !indexingText.includes('forceApplyToGraph: true')) {
    throw new Error('expected initialization-file landing to atomically reapply both graph payload and canvas/document preset state')
  }
  if (!indexingText.includes('} else {')) {
    throw new Error('expected initialization-file landing to skip only the passive preset-suppressed refresh branch')
  }
  if (indexingText.includes("rememberIndexedForPath(path, textHash)\n              args.setStatusWithAutoClear('Indexed')\n              return")) {
    throw new Error('expected initialization-file landing to continue through source-file indexing instead of returning before content/view sync completes')
  }
  if (!runtimeIoText.includes('applyViewPreset: args.applyViewPreset ?? false')) {
    throw new Error('expected shared workspace active-document refresh helper to remain passive unless callers opt into preset landing')
  }
}

export async function testInitializationWorkspaceMaterializationPreservesCanonicalDocumentGraph() {
  const { restore } = initJsdomHarness()
  const previousRaf = typeof window !== 'undefined' ? window.requestAnimationFrame : undefined
  try {
    useGraphStore.getState().resetAll()
    useGraphStore.getState().setDocumentStructureBaselineLock(false)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }) as typeof window.requestAnimationFrame
    }

    const readmeText = fs.readFileSync(path.resolve(process.cwd(), '..', 'README.md'), 'utf8')
    const videoText = fs.readFileSync(path.resolve(process.cwd(), '..', 'knowgrph-video-demo.md'), 'utf8')
    const geospatialText = fs.readFileSync(
      path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-maps-grabmap-multim-demo.md'),
      'utf8',
    )
    const workspaceFs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/README.md', parentPath: '/', kind: 'file', name: 'README.md', text: readmeText, updatedAtMs: 1 },
        {
          path: '/knowgrph-video-demo.md',
          parentPath: '/',
          kind: 'file',
          name: 'knowgrph-video-demo.md',
          text: videoText,
          updatedAtMs: 2,
        },
        {
          path: '/knowgrph-maps-grabmap-multim-demo.md',
          parentPath: '/',
          kind: 'file',
          name: 'knowgrph-maps-grabmap-multim-demo.md',
          text: geospatialText,
          updatedAtMs: 3,
        },
      ],
    })
    const workspaceEntries = await workspaceFs.listEntries()

    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: '/knowgrph-video-demo.md',
      fs: workspaceFs,
      workspaceEntries,
      sourcesByPath: {},
      applyToGraph: true,
    })

    const afterVideo = useGraphStore.getState()
    if (afterVideo.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video-demo initialization materialization to preserve flowEditor landing, got ${String(afterVideo.canvas2dRenderer)}`)
    }
    if ((afterVideo.graphData?.nodes || []).some(node => String(node?.id || '').includes('::'))) {
      throw new Error('expected video-demo initialization materialization to preserve canonical parsed graph ids instead of composed source-layer ids')
    }

    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: '/README.md',
      fs: workspaceFs,
      workspaceEntries,
      sourcesByPath: {},
      applyToGraph: true,
    })

    const afterReadme = useGraphStore.getState()
    if (afterReadme.canvas2dRenderer !== 'd3') {
      throw new Error(`expected README initialization materialization to preserve d3 landing, got ${String(afterReadme.canvas2dRenderer)}`)
    }
    if ((afterReadme.graphData?.nodes || []).some(node => String(node?.id || '').includes('::'))) {
      throw new Error('expected README initialization materialization to preserve canonical parsed graph ids instead of composed source-layer ids')
    }

    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: '/knowgrph-maps-grabmap-multim-demo.md',
      fs: workspaceFs,
      workspaceEntries,
      sourcesByPath: {},
      applyToGraph: true,
    })

    const afterGeospatial = useGraphStore.getState()
    if (afterGeospatial.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected geospatial initialization materialization to preserve flowEditor landing, got ${String(afterGeospatial.canvas2dRenderer)}`)
    }
    if (afterGeospatial.canvasRenderMode !== '2d') {
      throw new Error(`expected geospatial initialization materialization to preserve 2d surface mode, got ${String(afterGeospatial.canvasRenderMode)}`)
    }
    if (afterGeospatial.frontmatterModeEnabled !== true) {
      throw new Error('expected geospatial initialization materialization to preserve frontmatter mode')
    }
    if (!lsBool(LS_KEYS.geospatialOverlayEnabled, false)) {
      throw new Error('expected geospatial initialization materialization to enable geospatial surface mode')
    }
  } finally {
    if (typeof window !== 'undefined' && previousRaf) {
      window.requestAnimationFrame = previousRaf
    }
    restore()
  }
}

export function testFrontmatterIngestPipelineDefersPresetReplayUntilGraphApply() {
  const loaderPath = path.resolve(process.cwd(), 'src', 'features', 'parsers', 'loader.ts')
  const importModesPath = path.resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'applyWorkspaceImportToCanvas.ts')
  const loaderText = fs.readFileSync(loaderPath, 'utf8')
  const importModesText = fs.readFileSync(importModesPath, 'utf8')

  if (!loaderText.includes('applyViewPreset: false')) {
    throw new Error('expected parser loader markdown sync to stay passive before graph hydration')
  }
  if (!loaderText.includes('const appliedGraphPreset = applyFrontmatterFlowImportModes(graphData)')) {
    throw new Error('expected parser loader to centralize post-graph preset application behind the frontmatter-flow landing helper')
  }
  if (!loaderText.includes('applyCanvasFrontmatterPreset({')) {
    throw new Error('expected parser loader to replay explicit raw frontmatter presets only after graph hydration')
  }
  if (importModesText.includes('const presetApplied = applyCanvasFrontmatterPreset({ rawText })')) {
    throw new Error('expected interactive import modes to stop replaying raw frontmatter presets before graph-aware import landing runs')
  }
  if (!importModesText.includes('const hasCanvasFrontmatterPreset = !!parseCanvasWorkspaceFrontmatterPreset(text)')) {
    throw new Error('expected workspace import pipeline to detect explicit canvas frontmatter presets even when the parsed graph is not tagged as frontmatter-flow')
  }
  if (!importModesText.includes("} else if (!preferredInteractiveImportGraphData && graphData && hasCanvasFrontmatterPreset) {")) {
    throw new Error('expected workspace import pipeline to preserve frontmatter-driven canvas landing for parsed non-frontmatter-flow graphs')
  }
}
