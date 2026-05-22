import { useGraphStore } from '@/hooks/useGraphStore'
import { buildDocumentKey, buildDocumentRef, writePerDocumentUiState } from '@/lib/persistence/perDocumentUiState'
import { hashSignatureParts, hashStringArraySignature } from '@/lib/hash/signature'

type PerDocumentUiRuntimeState = Parameters<typeof writePerDocumentUiState>[0]['state']
type GraphStoreApi = ReturnType<typeof useGraphStore.getState>

export type PendingDocumentUiPersistState = {
  key: string
  ref: string
  state: PerDocumentUiRuntimeState
}

export type GraphStoreDocumentUiPersistSnapshot = {
  docKey: string
  docRef: string
  documentStructureBaselineLock: boolean
  canvasRenderMode: GraphStoreApi['canvasRenderMode']
  canvas3dMode: GraphStoreApi['canvas3dMode']
  canvas2dRenderer: GraphStoreApi['canvas2dRenderer']
  documentSemanticMode: GraphStoreApi['documentSemanticMode']
  frontmatterModeEnabled: GraphStoreApi['frontmatterModeEnabled']
  multiDimTableModeEnabled: GraphStoreApi['multiDimTableModeEnabled']
  viewPinned: GraphStoreApi['viewPinned']
  fitToScreenMode: GraphStoreApi['fitToScreenMode']
  zoomToSelectionMode: GraphStoreApi['zoomToSelectionMode']
  selectedNodeId: GraphStoreApi['selectedNodeId']
  selectedEdgeId: GraphStoreApi['selectedEdgeId']
  selectedGroupId: GraphStoreApi['selectedGroupId']
  selectedNodeIds: GraphStoreApi['selectedNodeIds']
  selectedEdgeIds: GraphStoreApi['selectedEdgeIds']
  selectedGroupIds: GraphStoreApi['selectedGroupIds']
}

export const selectGraphStoreDocumentUiPersistSnapshot = (store: GraphStoreApi): GraphStoreDocumentUiPersistSnapshot => {
  const docKey = buildDocumentKey({ name: store.markdownDocumentName, sourceUrl: store.markdownDocumentSourceUrl })
  const docRef = buildDocumentRef({ name: store.markdownDocumentName, sourceUrl: store.markdownDocumentSourceUrl })
  return {
    docKey,
    docRef,
    documentStructureBaselineLock: store.documentStructureBaselineLock,
    canvasRenderMode: store.canvasRenderMode,
    canvas3dMode: store.canvas3dMode,
    canvas2dRenderer: store.canvas2dRenderer,
    documentSemanticMode: store.documentSemanticMode,
    frontmatterModeEnabled: store.frontmatterModeEnabled,
    multiDimTableModeEnabled: store.multiDimTableModeEnabled,
    viewPinned: store.viewPinned,
    fitToScreenMode: store.fitToScreenMode,
    zoomToSelectionMode: store.zoomToSelectionMode,
    selectedNodeId: store.selectedNodeId,
    selectedEdgeId: store.selectedEdgeId,
    selectedGroupId: store.selectedGroupId,
    selectedNodeIds: store.selectedNodeIds,
    selectedEdgeIds: store.selectedEdgeIds,
    selectedGroupIds: store.selectedGroupIds,
  }
}

const buildPendingDocumentUiRuntimeState = (
  snapshot: GraphStoreDocumentUiPersistSnapshot,
  options?: { includeDocumentRef?: boolean },
): PerDocumentUiRuntimeState => {
  const state: PerDocumentUiRuntimeState = {
    canvasRenderMode: snapshot.canvasRenderMode,
    canvas3dMode: snapshot.canvas3dMode,
    canvas2dRenderer: snapshot.canvas2dRenderer,
    documentSemanticMode: snapshot.documentSemanticMode,
    frontmatterModeEnabled: snapshot.frontmatterModeEnabled,
    multiDimTableModeEnabled: snapshot.multiDimTableModeEnabled,
    viewPinned: snapshot.viewPinned,
    fitToScreenMode: snapshot.fitToScreenMode,
    zoomToSelectionMode: snapshot.zoomToSelectionMode,
    selectedNodeId: snapshot.selectedNodeId,
    selectedEdgeId: snapshot.selectedEdgeId,
    selectedGroupId: snapshot.selectedGroupId,
    selectedNodeIds: snapshot.selectedNodeIds,
    selectedEdgeIds: snapshot.selectedEdgeIds,
    selectedGroupIds: snapshot.selectedGroupIds,
  }
  if (options?.includeDocumentRef) state.documentRef = snapshot.docRef
  return state
}

export const buildPendingDocumentUiPersistStateFromSnapshot = (
  snapshot: GraphStoreDocumentUiPersistSnapshot,
  options?: { includeDocumentRef?: boolean },
): PendingDocumentUiPersistState | null => {
  if (!snapshot.docKey) return null
  return {
    key: snapshot.docKey,
    ref: snapshot.docRef,
    state: buildPendingDocumentUiRuntimeState(snapshot, options),
  }
}

export const buildPendingDocumentUiPersistStateFromStore = (
  store: GraphStoreApi,
): PendingDocumentUiPersistState | null =>
  buildPendingDocumentUiPersistStateFromSnapshot(selectGraphStoreDocumentUiPersistSnapshot(store), {
    includeDocumentRef: true,
  })

export const buildPendingDocumentUiPersistSignature = (
  value: PendingDocumentUiPersistState | null,
): string => {
  if (!value) return 'none'
  const s = value.state || {}
  return hashSignatureParts([
    'v3',
    value.key,
    value.ref,
    (s as any).canvasRenderMode,
    (s as any).canvas3dMode,
    (s as any).canvas2dRenderer,
    (s as any).documentSemanticMode,
    (s as any).frontmatterModeEnabled,
    (s as any).multiDimTableModeEnabled,
    (s as any).viewPinned,
    (s as any).fitToScreenMode,
    (s as any).zoomToSelectionMode,
    (s as any).selectedNodeId,
    (s as any).selectedEdgeId,
    (s as any).selectedGroupId,
    hashStringArraySignature((s as any).selectedNodeIds, { maxSamples: 40, includeTail: true }),
    hashStringArraySignature((s as any).selectedEdgeIds, { maxSamples: 40, includeTail: true }),
    hashStringArraySignature((s as any).selectedGroupIds, { maxSamples: 40, includeTail: true }),
  ])
}
