import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildViewportSvgMarkupFromElement } from '@/lib/graph/svgSnapshot'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { DesignLayerState } from '@/features/design/designLayersState'

type UseDesignCanvasBootstrapArgs = {
  active: boolean
  svgRef: React.RefObject<SVGSVGElement | null>
  emptyStringArray: string[]
  emptyDesignLayerState: DesignLayerState
  emptyDesignFramePosById: Record<string, DesignFramePos>
  emptyDesignFrameSizeById: Record<string, DesignFrameSize>
}

export function useDesignCanvasBootstrap(args: UseDesignCanvasBootstrapArgs) {
  const { active, svgRef, emptyStringArray, emptyDesignLayerState, emptyDesignFramePosById, emptyDesignFrameSizeById } = args
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)

  React.useEffect(() => {
    if (!active) return
    const captureSvg = async (): Promise<string | null> => {
      try {
        const element = svgRef.current
        if (!element) return null
        return buildViewportSvgMarkupFromElement(element, {
          includeXmlDeclaration: true,
          inlineComputedStyles: true,
          removeCssClasses: true,
          removeDataAttributes: false,
        })
      } catch {
        return null
      }
    }

    const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
      try {
        const element = svgRef.current
        if (!element) return null
        const serializer = new XMLSerializer()
        const markup = serializer.serializeToString(element)
        if (!markup || !markup.trim()) return null
        const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        try {
          const img = new Image()
          const viewBox = element.viewBox && element.viewBox.baseVal ? element.viewBox.baseVal : null
          const width = viewBox && viewBox.width ? viewBox.width : element.clientWidth || 800
          const height = viewBox && viewBox.height ? viewBox.height : element.clientHeight || 600
          const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.floor(width * ratio))
          canvas.height = Math.max(1, Math.floor(height * ratio))
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('Image load failed'))
            img.src = url
          })
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const pngBlob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(nextBlob => resolve(nextBlob), 'image/png')
          })
          return pngBlob || null
        } finally {
          URL.revokeObjectURL(url)
        }
      } catch {
        return null
      }
    }

    registerCanvasSnapshotFns('2d', { captureSvg, capturePng })
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [active, registerCanvasSnapshotFns, svgRef])

  const snapshot = useGraphStore(
    useShallow(state => {
      if (!active) {
        return {
          graphData: null,
          graphDataRevision: state.graphDataRevision,
          schema: state.schema,
          canvasRenderMode: '2d' as const,
          canvas2dRenderer: 'design' as const,
          documentSemanticMode: 'document' as const,
          frontmatterModeEnabled: false,
          multiDimTableModeEnabled: false,
          documentStructureBaselineLock: false,
          renderMediaAsNodes: false,
          mediaPanelDensity: 'default' as const,
          threeIframeOverlayPoolMax: state.threeIframeOverlayPoolMax,
          threeIframeOverlayBaseWidthRatioDefault: state.threeIframeOverlayBaseWidthRatioDefault,
          threeIframeOverlayBaseWidthRatioCompact: state.threeIframeOverlayBaseWidthRatioCompact,
          threeIframeOverlayBaseWidthMinPxDefault: state.threeIframeOverlayBaseWidthMinPxDefault,
          threeIframeOverlayBaseWidthMinPxCompact: state.threeIframeOverlayBaseWidthMinPxCompact,
          threeIframeOverlayBaseWidthMaxPxDefault: state.threeIframeOverlayBaseWidthMaxPxDefault,
          threeIframeOverlayBaseWidthMaxPxCompact: state.threeIframeOverlayBaseWidthMaxPxCompact,
          collapsedGroupIds: emptyStringArray,
          selectedNodeId: null,
          selectedNodeIds: emptyStringArray,
          selectedGroupId: null,
          workspaceViewMode: 'canvas' as const,
          viewportControlsPreset: state.viewportControlsPreset,
          canvasPointerMode2d: (state as unknown as { canvasPointerMode2d?: unknown }).canvasPointerMode2d,
          designLayerState: emptyDesignLayerState,
          designWireframeCacheEpoch: 0,
          designFramePosById: emptyDesignFramePosById,
          designFrameSizeById: emptyDesignFrameSizeById,
          setDesignFramePosMany: state.setDesignFramePosMany,
          setDesignFrameSizeMany: state.setDesignFrameSizeMany,
          setDesignRendererNodes: state.setDesignRendererNodes,
          setDesignRendererWebpageGraph: state.setDesignRendererWebpageGraph,
          markdownDocumentName: null,
          markdownDocumentText: '',
        }
      }

      return {
        graphData: state.graphData,
        graphDataRevision: state.graphDataRevision,
        schema: state.schema,
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        multiDimTableModeEnabled: state.multiDimTableModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        threeIframeOverlayPoolMax: state.threeIframeOverlayPoolMax,
        threeIframeOverlayBaseWidthRatioDefault: state.threeIframeOverlayBaseWidthRatioDefault,
        threeIframeOverlayBaseWidthRatioCompact: state.threeIframeOverlayBaseWidthRatioCompact,
        threeIframeOverlayBaseWidthMinPxDefault: state.threeIframeOverlayBaseWidthMinPxDefault,
        threeIframeOverlayBaseWidthMinPxCompact: state.threeIframeOverlayBaseWidthMinPxCompact,
        threeIframeOverlayBaseWidthMaxPxDefault: state.threeIframeOverlayBaseWidthMaxPxDefault,
        threeIframeOverlayBaseWidthMaxPxCompact: state.threeIframeOverlayBaseWidthMaxPxCompact,
        collapsedGroupIds: state.collapsedGroupIds,
        selectedNodeId: state.selectedNodeId,
        selectedNodeIds: state.selectedNodeIds,
        selectedGroupId: state.selectedGroupId,
        workspaceViewMode: state.workspaceViewMode,
        viewportControlsPreset: state.viewportControlsPreset,
        canvasPointerMode2d: state.canvasPointerMode2d,
        designLayerState: state.designLayerState,
        designWireframeCacheEpoch: state.designWireframeCacheEpoch,
        designFramePosById: state.designFramePosById,
        designFrameSizeById: state.designFrameSizeById,
        setDesignFramePosMany: state.setDesignFramePosMany,
        setDesignFrameSizeMany: state.setDesignFrameSizeMany,
        setDesignRendererNodes: state.setDesignRendererNodes,
        setDesignRendererWebpageGraph: state.setDesignRendererWebpageGraph,
        markdownDocumentName: state.markdownDocumentName,
        markdownDocumentText: state.markdownDocumentText,
      }
    }),
  )

  return {
    snapshot,
  }
}
