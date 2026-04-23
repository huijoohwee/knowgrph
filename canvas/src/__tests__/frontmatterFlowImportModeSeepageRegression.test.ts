import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'

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
