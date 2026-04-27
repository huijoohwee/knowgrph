import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyInteractiveImportModes } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
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

export function testPerDocumentUiRestorePrefersFrontmatterFlowLandingContract() {
  const runtimePath = path.resolve(process.cwd(), 'src', 'features', 'canvas', 'GraphStoreRuntime.tsx')
  const text = fs.readFileSync(runtimePath, 'utf8')
  if (!text.includes('const shouldPreferFrontmatterFlowLanding = isFrontmatterFlowGraph(graphData)')) {
    throw new Error('expected per-document UI restore to detect frontmatter-flow graph landing contract')
  }
  if (!text.includes('applyFrontmatterFlowImportModes(graphData)')) {
    throw new Error('expected per-document UI restore to reuse shared frontmatter-flow landing helper')
  }
  if (!text.includes('} else {\n            if (saved.documentSemanticMode) api.setDocumentSemanticMode(saved.documentSemanticMode)')) {
    throw new Error('expected saved canvas/ui restore to be skipped when frontmatter-flow landing must stay canonical')
  }
}
