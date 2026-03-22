import { useGraphStore } from '@/hooks/useGraphStore'

export const testDocumentStructureBaselineLockGuardsModeSwitches = () => {
  const api = useGraphStore.getState()
  api.resetAll()

  api.setFrontmatterModeEnabled(false)
  api.setDocumentStructureBaselineLock(true)
  if (useGraphStore.getState().documentStructureBaselineLock !== true) {
    throw new Error('expected baseline lock to be enabled')
  }

  const beforeSemantic = useGraphStore.getState().documentSemanticMode
  api.setDocumentSemanticMode('keyword')
  if (useGraphStore.getState().documentSemanticMode !== beforeSemantic) {
    throw new Error('expected semantic mode switch to be blocked under baseline lock')
  }

  const beforeFrontmatter = useGraphStore.getState().frontmatterModeEnabled
  api.setFrontmatterModeEnabled(true)
  if (useGraphStore.getState().frontmatterModeEnabled === beforeFrontmatter) {
    throw new Error('expected frontmatter mode switch to be allowed under baseline lock')
  }

  const beforeRenderer = useGraphStore.getState().canvas2dRenderer
  const requested = beforeRenderer === 'flowEditor' ? 'd3' : 'flowEditor'
  api.setCanvas2dRenderer(requested)
  if (useGraphStore.getState().canvas2dRenderer !== beforeRenderer) {
    throw new Error('expected 2d renderer switch to be blocked under baseline lock')
  }
}
