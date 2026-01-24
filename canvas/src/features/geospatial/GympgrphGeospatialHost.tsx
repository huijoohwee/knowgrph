import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'

type GympgrphModule = typeof import('gympgrph')

let gympgrphModulePromise: Promise<GympgrphModule> | null = null
const loadGympgrphModule = (): Promise<GympgrphModule> => {
  if (!gympgrphModulePromise) {
    gympgrphModulePromise = import('gympgrph')
  }
  return gympgrphModulePromise
}

const useGympgrphModule = (active: boolean): GympgrphModule | null => {
  const [mod, setMod] = React.useState<GympgrphModule | null>(null)

  React.useEffect(() => {
    if (!active) return
    let cancelled = false
    void loadGympgrphModule()
      .then(m => {
        if (!cancelled) setMod(m)
      })
      .catch(() => void 0)
    return () => {
      cancelled = true
    }
  }, [active])

  return mod
}

export function GympgrphGeospatialOverlayHost(props: { active: boolean }) {
  const mod = useGympgrphModule(props.active)
  const snapshot = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      zoomState: s.zoomState,
      canvasRenderMode: s.canvasRenderMode,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      setSelectionSource: s.setSelectionSource,
      requestZoom: s.requestZoom,
      requestThreeCamera: s.requestThreeCamera,
      pushUiToast: s.pushUiToast,
      upsertUiToast: s.upsertUiToast,
      dismissUiToast: s.dismissUiToast,
    })),
  )

  React.useEffect(() => {
    if (!mod) return
    mod.setHostHandlers({
      selectNode: snapshot.selectNode,
      selectEdge: snapshot.selectEdge,
      setSelectionSource: snapshot.setSelectionSource,
      requestZoom: snapshot.requestZoom as unknown as (mode: 'fit') => void,
      requestThreeCamera: snapshot.requestThreeCamera as unknown as (mode: 'fit') => void,
      pushUiToast: snapshot.pushUiToast,
      upsertUiToast: snapshot.upsertUiToast,
      dismissUiToast: snapshot.dismissUiToast,
    })
  }, [
    mod,
    snapshot.dismissUiToast,
    snapshot.pushUiToast,
    snapshot.requestThreeCamera,
    snapshot.requestZoom,
    snapshot.selectEdge,
    snapshot.selectNode,
    snapshot.setSelectionSource,
    snapshot.upsertUiToast,
  ])

  React.useEffect(() => {
    if (!mod) return
    mod.applyHostSnapshot({
      graphData: snapshot.graphData,
      zoomState: snapshot.zoomState,
      canvasRenderMode: snapshot.canvasRenderMode,
      selectedNodeId: snapshot.selectedNodeId,
      selectedNodeIds: snapshot.selectedNodeIds,
    })
  }, [
    mod,
    snapshot.canvasRenderMode,
    snapshot.graphData,
    snapshot.selectedNodeId,
    snapshot.selectedNodeIds,
    snapshot.zoomState,
  ])

  if (!mod) return null
  return <mod.GeospatialOverlay />
}

export function GympgrphGeospatialPanelHost(props: { active: boolean }) {
  const mod = useGympgrphModule(props.active)
  if (!mod) return null
  return <mod.GeospatialPanel />
}

