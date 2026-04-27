import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasSliceStorageMigrations } from '@/hooks/store/canvasSlice'
import { applyFlowEditorManagerDefaultRegistrySeed } from '@/hooks/store/flowEditorManagerSlice'
import { applyGraphViewPinnedSemanticsMigration } from '@/hooks/store/graphViewSlice'
import { ensureSessionTabId } from '@/hooks/store/uiSettingsSlice'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { buildDocumentKey, buildDocumentRef, readPerDocumentUiState, writePerDocumentUiState } from '@/lib/persistence/perDocumentUiState'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI,
} from '@/lib/async/workspaceSyncKeys'
import { hashSignatureParts, hashStringArraySignature } from '@/lib/hash/signature'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'

type DebugTraceWindow = Window & {
  localStorage?: Storage
  __KG_MARKDOWN_EMPTY_TRACE__?: unknown
}

type PerDocumentUiRuntimeState = Parameters<typeof writePerDocumentUiState>[0]['state']

const buildPendingSignature = (
  value: { key: string; ref: string; state: PerDocumentUiRuntimeState } | null,
): string => {
  if (!value) return 'none'
  const s = value.state || {}
  return hashSignatureParts([
    'v2',
    value.key,
    value.ref,
    (s as any).canvasRenderMode,
    (s as any).canvas3dMode,
    (s as any).canvas2dRenderer,
    (s as any).documentSemanticMode,
    (s as any).frontmatterModeEnabled,
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

export function GraphStoreRuntime() {
  React.useLayoutEffect(() => {
    const tabId = ensureSessionTabId()
    if (!tabId || tabId === 'tab-ssr') return
    if (useGraphStore.getState().tabId === tabId) return
    useGraphStore.setState({ tabId })
  }, [])

  React.useEffect(() => {
    applyCanvasSliceStorageMigrations()
    applyFlowEditorManagerDefaultRegistrySeed()
    applyGraphViewPinnedSemanticsMigration()
  }, [])

  React.useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as DebugTraceWindow) : null
    const enabled = !!(w?.localStorage && w.localStorage.getItem('kg:debug:markdownEmptyTrace') === '1')
    if (!w || !enabled) return

    const buf: Array<{ ts: number; prevName: string; nextName: string; prevLen: number; nextLen: number; stack: string }> = []
    w.__KG_MARKDOWN_EMPTY_TRACE__ = buf
    let prevName = String(useGraphStore.getState().markdownDocumentName || '')
    let prevText = String(useGraphStore.getState().markdownDocumentText || '')

    const unsubscribe = useGraphStore.subscribe(
      s => [s.markdownDocumentName, s.markdownDocumentText] as const,
      next => {
        const nextName = String(next[0] || '')
        const nextText = String(next[1] || '')
        const prevLen = prevText.trim().length
        const nextLen = nextText.trim().length
        if (prevLen > 0 && nextLen === 0) {
          const stack = String(new Error('markdownDocumentText emptied').stack || '')
          buf.push({ ts: Date.now(), prevName, nextName, prevLen, nextLen, stack })
          if (buf.length > 20) buf.splice(0, buf.length - 20)
        }
        prevName = nextName
        prevText = nextText
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    let restoring = false
    let pending: { key: string; ref: string; state: PerDocumentUiRuntimeState } | null = null

    const schedulePersist = () => {
      const signature = buildPendingSignature(pending)
      scheduleWorkspaceSyncTask(
        WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI,
        () => {
          const next = pending
          pending = null
          if (!next) return
          writePerDocumentUiState({
            documentKey: next.key,
            documentRef: next.ref,
            state: next.state,
          })
        },
        250,
        { signature, scopeKey: WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE },
      )
    }

    const unsubscribePersist = useGraphStore.subscribe(
      s => {
        const docKey = buildDocumentKey({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl })
        const docRef = buildDocumentRef({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl })
        return {
          docKey,
          docRef,
          documentStructureBaselineLock: s.documentStructureBaselineLock,
          canvasRenderMode: s.canvasRenderMode,
          canvas3dMode: s.canvas3dMode,
          canvas2dRenderer: s.canvas2dRenderer,
          documentSemanticMode: s.documentSemanticMode,
          frontmatterModeEnabled: s.frontmatterModeEnabled,
          viewPinned: s.viewPinned,
          fitToScreenMode: s.fitToScreenMode,
          zoomToSelectionMode: s.zoomToSelectionMode,
          selectedNodeId: s.selectedNodeId,
          selectedEdgeId: s.selectedEdgeId,
          selectedGroupId: s.selectedGroupId,
          selectedNodeIds: s.selectedNodeIds,
          selectedEdgeIds: s.selectedEdgeIds,
          selectedGroupIds: s.selectedGroupIds,
        }
      },
      (next, prev) => {
        if (restoring) return

        if (prev?.docKey && prev.docKey !== next.docKey) {
          pending = {
            key: prev.docKey,
            ref: prev.docRef,
            state: {
              canvasRenderMode: prev.canvasRenderMode,
              canvas3dMode: prev.canvas3dMode,
              canvas2dRenderer: prev.canvas2dRenderer,
              documentSemanticMode: prev.documentSemanticMode,
              frontmatterModeEnabled: prev.frontmatterModeEnabled,
              viewPinned: prev.viewPinned,
              fitToScreenMode: prev.fitToScreenMode,
              zoomToSelectionMode: prev.zoomToSelectionMode,
              selectedNodeId: prev.selectedNodeId,
              selectedEdgeId: prev.selectedEdgeId,
              selectedGroupId: prev.selectedGroupId,
              selectedNodeIds: prev.selectedNodeIds,
              selectedEdgeIds: prev.selectedEdgeIds,
              selectedGroupIds: prev.selectedGroupIds,
            },
          }
          schedulePersist()
        }

        if (next.documentStructureBaselineLock === true) return
        if (prev?.docKey === next.docKey) {
          pending = {
            key: next.docKey,
            ref: next.docRef,
            state: {
              canvasRenderMode: next.canvasRenderMode,
              canvas3dMode: next.canvas3dMode,
              canvas2dRenderer: next.canvas2dRenderer,
              documentSemanticMode: next.documentSemanticMode,
              frontmatterModeEnabled: next.frontmatterModeEnabled,
              viewPinned: next.viewPinned,
              fitToScreenMode: next.fitToScreenMode,
              zoomToSelectionMode: next.zoomToSelectionMode,
              selectedNodeId: next.selectedNodeId,
              selectedEdgeId: next.selectedEdgeId,
              selectedGroupId: next.selectedGroupId,
              selectedNodeIds: next.selectedNodeIds,
              selectedEdgeIds: next.selectedEdgeIds,
              selectedGroupIds: next.selectedGroupIds,
            },
          }
          schedulePersist()
        }
      },
    )

    const unsubscribeRestore = useGraphStore.subscribe(
      s => ({
        docKey: buildDocumentKey({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
        docRef: buildDocumentRef({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
        documentStructureBaselineLock: s.documentStructureBaselineLock,
      }),
      (next, prev) => {
        if (next.docKey === prev?.docKey) return
        if (next.documentStructureBaselineLock === true) return
        const saved = readPerDocumentUiState({ documentKey: next.docKey })
        if (!saved) return

        const api = useGraphStore.getState()
        restoring = true
        try {
          const graphData = api.graphData
          const shouldPreferFrontmatterFlowLanding = isFrontmatterFlowGraph(graphData)
          if (shouldPreferFrontmatterFlowLanding) {
            applyFrontmatterFlowImportModes(graphData)
          } else {
            if (saved.documentSemanticMode) api.setDocumentSemanticMode(saved.documentSemanticMode)
            if (typeof saved.frontmatterModeEnabled === 'boolean') api.setFrontmatterModeEnabled(saved.frontmatterModeEnabled)
            if (saved.canvasRenderMode) api.setCanvasRenderMode(saved.canvasRenderMode)
            if (saved.canvas3dMode) api.setCanvas3dMode(saved.canvas3dMode)
            if (saved.canvas2dRenderer) api.setCanvas2dRenderer(saved.canvas2dRenderer)
          }

          const pinned = saved.viewPinned === true
          api.setViewPinned(pinned)
          if (!pinned) {
            const zoomSel = saved.zoomToSelectionMode === true
            const fit = !zoomSel && saved.fitToScreenMode === true
            api.setZoomToSelectionMode(zoomSel)
            api.setFitToScreenMode(fit)
            if (!zoomSel && !fit) {
              api.setZoomToSelectionMode(false)
              api.setFitToScreenMode(false)
            }
          }

          const nodeIds = Array.isArray(saved.selectedNodeIds) ? saved.selectedNodeIds : []
          const edgeIds = Array.isArray(saved.selectedEdgeIds) ? saved.selectedEdgeIds : []
          const groupIds = Array.isArray(saved.selectedGroupIds) ? saved.selectedGroupIds : []
          if (nodeIds.length > 0 || edgeIds.length > 0 || groupIds.length > 0) {
            api.setSelectionSource('canvas')
            api.selectNodesExpanded({
              nodeIds,
              edgeIds,
              groupIds,
              activeNodeId: typeof saved.selectedNodeId === 'string' ? saved.selectedNodeId : null,
            })
          } else {
            api.selectNode(null)
          }
        } finally {
          restoring = false
        }

        const current = useGraphStore.getState()
        pending = {
          key: next.docKey,
          ref: next.docRef,
          state: {
            documentRef: next.docRef,
            canvasRenderMode: current.canvasRenderMode,
            canvas3dMode: current.canvas3dMode,
            canvas2dRenderer: current.canvas2dRenderer,
            documentSemanticMode: current.documentSemanticMode,
            frontmatterModeEnabled: current.frontmatterModeEnabled,
            viewPinned: current.viewPinned,
            fitToScreenMode: current.fitToScreenMode,
            zoomToSelectionMode: current.zoomToSelectionMode,
            selectedNodeId: current.selectedNodeId,
            selectedEdgeId: current.selectedEdgeId,
            selectedGroupId: current.selectedGroupId,
            selectedNodeIds: current.selectedNodeIds,
            selectedEdgeIds: current.selectedEdgeIds,
            selectedGroupIds: current.selectedGroupIds,
          },
        }
        schedulePersist()
      },
    )

    return () => {
      unsubscribePersist()
      unsubscribeRestore()
      cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI)
    }
  }, [])

  return null
}
