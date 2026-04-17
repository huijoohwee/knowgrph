import { useGraphStore } from '@/hooks/useGraphStore'

export const testDocumentStructureBaselineLockSkipsStaleSnapshotRestore = () => {
  const api = useGraphStore.getState()
  api.resetAll()
  api.setDocumentStructureBaselineLock(false)
  api.setCanvas2dRenderer('flowEditor')
  api.setDocumentSemanticMode('document')
  api.setFrontmatterModeEnabled(true)

  api.setDocumentStructureBaselineLock(true)
  const locked = useGraphStore.getState()
  if (locked.documentStructureBaselineLock !== true) throw new Error('expected baseline lock enabled')
  if (locked.canvas2dRenderer !== 'flowEditor') throw new Error('expected lock toggle to preserve flowEditor renderer')
  if (locked.documentStructureBaselineSnapshot !== null) {
    throw new Error('expected view lock to avoid baseline snapshot mutation state')
  }

  useGraphStore.setState(state => ({ graphDataRevision: (state.graphDataRevision || 0) + 1 }))

  api.setDocumentStructureBaselineLock(false)
  const restored = useGraphStore.getState()
  if (restored.documentStructureBaselineLock !== false) throw new Error('expected baseline lock disabled')
  if (restored.documentStructureBaselineSnapshot !== null) throw new Error('expected baseline snapshot to remain unused')
  if (restored.canvas2dRenderer !== 'flowEditor') {
    throw new Error('expected stale baseline unlock to preserve active flowEditor renderer')
  }
  if (restored.documentSemanticMode !== 'document') {
    throw new Error('expected stale baseline unlock to preserve active document semantic mode')
  }
}
