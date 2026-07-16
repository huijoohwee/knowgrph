import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { __flowCanvasDebug, syncFlowCanvasDebugWindow } from '@/components/FlowCanvas/flowCanvasDebug'

type MediaOverlayElementRef = React.MutableRefObject<Map<string, HTMLElement>>

export function useFlowCanvasMediaOverlayDebug(args: {
  mediaLayoutItemsKey: string
  mediaLayoutPropsSignature: string
  mediaNodes: MediaOverlayNode[]
  mediaOverlayElementsRef: MediaOverlayElementRef
  nativeSceneGraphData: GraphData | null
  workspaceOverlayOpen: boolean
}): void {
  const {
    mediaLayoutItemsKey,
    mediaLayoutPropsSignature,
    mediaNodes,
    mediaOverlayElementsRef,
    nativeSceneGraphData,
    workspaceOverlayOpen,
  } = args

  React.useEffect(() => {
    __flowCanvasDebug.sceneNodeIds = Array.isArray(nativeSceneGraphData?.nodes)
      ? nativeSceneGraphData.nodes.map(node => String(node?.id || '').trim()).filter(Boolean)
      : []
    syncFlowCanvasDebugWindow()
  }, [nativeSceneGraphData])

  React.useEffect(() => {
    __flowCanvasDebug.mediaNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    __flowCanvasDebug.overlayNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    syncFlowCanvasDebugWindow()
  }, [mediaNodes])

  React.useEffect(() => {
    try {
      ;(window as unknown as { __flowCanvasDebug?: unknown }).__flowCanvasDebug = __flowCanvasDebug
      return () => {
        try {
          const win = window as unknown as { __flowCanvasDebug?: unknown }
          if (win.__flowCanvasDebug === __flowCanvasDebug) delete win.__flowCanvasDebug
        } catch {
          void 0
        }
      }
    } catch {
      return () => void 0
    }
  }, [])

  React.useEffect(() => {
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {}
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const node = mediaNodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      const element = mediaOverlayElementsRef.current.get(id)
      if (!element) continue
      const transformMatch = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(element.style.transform || ''))
      const left = transformMatch ? Number.parseFloat(transformMatch[1] || 'NaN') : Number.NaN
      const top = transformMatch ? Number.parseFloat(transformMatch[2] || 'NaN') : Number.NaN
      const width = Number.parseFloat(element.style.width || 'NaN')
      const height = Number.parseFloat(element.style.height || 'NaN')
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      next[id] = { left, top, width, height }
    }
    __flowCanvasDebug.richMediaRectById = next
    syncFlowCanvasDebugWindow()
  }, [mediaLayoutItemsKey, mediaLayoutPropsSignature, mediaNodes, mediaOverlayElementsRef, workspaceOverlayOpen])
}
