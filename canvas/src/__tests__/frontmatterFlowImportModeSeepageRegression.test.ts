import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyInteractiveImportModes } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { resolveCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
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
      metadata: { kind: 'frontmatter-flow' },
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
