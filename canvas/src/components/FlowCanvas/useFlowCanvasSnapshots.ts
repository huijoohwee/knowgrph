import React from 'react'

import { renderGraphCanvasSvgForHtmlExport } from '@/lib/graph/htmlCanvasSvgExport'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { resolveActiveDocumentViewMode } from '@/lib/graph/documentViewMode'
import { buildMarkdownTokensKey, lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'

export function useFlowCanvasSnapshots(args: {
  active: boolean
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  graphDataOverride: GraphData | null | undefined
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: { capturePng: (pixelRatio?: number) => Promise<Blob | null>; captureSvg: () => Promise<string | null> } | null) => void
  viewportW: number
  viewportH: number
}) {
  const { active, canvasRef, runtimeRef, graphDataOverride, registerCanvasSnapshotFns, viewportW, viewportH } = args

  React.useEffect(() => {
    if (!active) return

    const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return null
        const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
        if (ratio === 1 && typeof canvas.toBlob === 'function') {
          return await new Promise<Blob | null>(resolve => {
            canvas.toBlob(blob => resolve(blob || null), 'image/png')
          })
        }
        const width = Math.max(1, Math.floor(canvas.width * ratio))
        const height = Math.max(1, Math.floor(canvas.height * ratio))
        const target = document.createElement('canvas')
        target.width = width
        target.height = height
        const ctx = target.getContext('2d')
        if (!ctx) return null
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(canvas, 0, 0, width, height)
        return await new Promise<Blob | null>(resolve => {
          target.toBlob(blob => resolve(blob || null), 'image/png')
        })
      } catch {
        return null
      }
    }

    const captureSvg = async (): Promise<string | null> => {
      try {
        const store = useGraphStore.getState()
        const graphData = (graphDataOverride || store.graphData) as GraphData | null
        const schema = store.schema as GraphSchema | null
        if (!graphData || !schema) return null

        const documentSemanticMode = store.documentSemanticMode === 'keyword' ? 'keyword' : 'document'
        const activeDocumentViewMode = resolveActiveDocumentViewMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled === true,
          multiDimTableModeEnabled: store.multiDimTableModeEnabled === true,
          documentSemanticMode: String(store.documentSemanticMode || 'document'),
          documentStructureBaselineLock: store.documentStructureBaselineLock === true,
        })
        const layoutSemanticModeKey = activeDocumentViewMode === 'multiDimTable' ? `${documentSemanticMode}:mdtbl` : documentSemanticMode
        const frontmatterModeEnabled = computeEffectiveFrontmatterMode({
          frontmatterModeEnabled: store.frontmatterModeEnabled,
          documentSemanticMode: store.documentSemanticMode,
          graphData,
        })

        const markdownDesignBlocks = (() => {
          try {
            const markdownText = String(store.markdownDocumentText || '')
            if (!markdownText.trim()) return []
            const activeDocumentPath = String(store.markdownDocumentName || '').trim() || 'markdown'
            const markdownTokensKey = buildMarkdownTokensKey(markdownText)
            const lexed = lexMarkdown(markdownText)
            const layout = deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
            return Array.isArray(layout.blocks) ? layout.blocks : []
          } catch {
            return []
          }
        })()

        const svg = await renderGraphCanvasSvgForHtmlExport({
          graphData,
          graphDataRevision: store.graphDataRevision,
          schema,
          widthPx: viewportW,
          heightPx: viewportH,
          viewportControlsPreset: (store as unknown as { viewportControlsPreset?: 'map' | 'design' }).viewportControlsPreset === 'design' ? 'design' : 'map',
          renderMediaAsNodes: store.renderMediaAsNodes === true,
          mediaPanelDensity: store.mediaPanelDensity === 'compact' ? 'compact' : 'default',
          documentSemanticMode,
          frontmatterModeEnabled,
          multiDimTableModeEnabled: store.multiDimTableModeEnabled === true,
          documentStructureBaselineLock: store.documentStructureBaselineLock === true,
          markdownDesignBlocks,
          collapsedGroupIds: store.collapsedGroupIds,
          layoutPositionCacheByMode: store.layoutPositionCacheByMode,
          canvas2dRenderer: store.canvas2dRenderer,
          overlayBaseWidthRatioDefault: (store as unknown as { threeIframeOverlayBaseWidthRatioDefault?: number }).threeIframeOverlayBaseWidthRatioDefault,
          overlayBaseWidthRatioCompact: (store as unknown as { threeIframeOverlayBaseWidthRatioCompact?: number }).threeIframeOverlayBaseWidthRatioCompact,
          overlayBaseWidthMinPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMinPxDefault?: number }).threeIframeOverlayBaseWidthMinPxDefault,
          overlayBaseWidthMinPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMinPxCompact?: number }).threeIframeOverlayBaseWidthMinPxCompact,
          overlayBaseWidthMaxPxDefault: (store as unknown as { threeIframeOverlayBaseWidthMaxPxDefault?: number }).threeIframeOverlayBaseWidthMaxPxDefault,
          overlayBaseWidthMaxPxCompact: (store as unknown as { threeIframeOverlayBaseWidthMaxPxCompact?: number }).threeIframeOverlayBaseWidthMaxPxCompact,
          layoutSemanticModeKey,
        })
        const trimmed = String(svg || '').trim()
        if (!trimmed) return null

        const runtime = runtimeRef.current
        const transform = runtime?.transform || null
        if (!transform) return trimmed

        try {
          const noXml = trimmed.replace(/^<\?xml[^>]*>\s*/i, '')
          const parser = new DOMParser()
          const doc = parser.parseFromString(noXml, 'image/svg+xml')
          const svgEl = doc.querySelector('svg')
          const group = svgEl?.querySelector('g')
          if (group) group.setAttribute('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`)
          return svgEl ? svgEl.outerHTML : trimmed
        } catch {
          return trimmed
        }
      } catch {
        return null
      }
    }

    registerCanvasSnapshotFns('2d', { capturePng, captureSvg })
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [active, canvasRef, graphDataOverride, registerCanvasSnapshotFns, runtimeRef, viewportH, viewportW])
}
