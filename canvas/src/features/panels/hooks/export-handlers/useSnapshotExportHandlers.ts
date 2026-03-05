import { useCallback } from 'react'
import { exportSvgSnapshot, exportPngSnapshot } from '@/lib/graph/file'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import { captureVisibleCanvasPngBlobFromDom, readCanvasViewportSizeFromDom, wrapPngBlobAsSvgMarkup } from '@/lib/graph/svgSnapshot'
import { LS_KEYS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { useGraphStore } from '@/hooks/useGraphStore'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import type { WorkflowExportStatusDeps } from './useExportUtils'

type UseSnapshotExportHandlersParams = {
  captureCanvasSvgSnapshot: (mode?: '2d' | '3d') => Promise<string | null>
  captureCanvasPngSnapshot: () => Promise<Blob | null>
} & WorkflowExportStatusDeps

export function useSnapshotExportHandlers({
  captureCanvasSvgSnapshot,
  captureCanvasPngSnapshot,
  markExported,
  setTransientExportStatus,
}: UseSnapshotExportHandlersParams) {
  const exportSvgSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const geospatialEnabled = (() => {
          try {
            return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
          } catch {
            return false
          }
        })()
        const store = useGraphStore.getState()
        const workspaceEditorEnabled = store.workspaceViewMode === 'editor'
        const wants3dExport =
          store.canvasRenderMode === '3d' ||
          (store.canvasRenderModeIsAuto === true && store.canvasRenderModeLastFree === '3d')

        if (wants3dExport) {
          const graphData = store.graphData
          const schema = store.schema
          const vp = readCanvasViewportSizeFromDom()
          if (graphData && schema) {
            const centered3d = exportGraphAsCentered3dSvgMarkup({
              graphData,
              schema,
              widthPx: vp.w,
              heightPx: vp.h,
              paddingPx: 96,
              includeXmlDeclaration: true,
              animated: true,
            })
            if (centered3d && centered3d.trim()) {
              await exportSvgSnapshot(centered3d, suggested)
              markExported()
              setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
              return
            }
          }
        }

        if (geospatialEnabled || workspaceEditorEnabled) {
          const graphData = store.graphData
          const schema = store.schema
          const vp = readCanvasViewportSizeFromDom()
          if (graphData && schema) {
            const centered = exportGraphAsCenteredSvgMarkup({
              graphData,
              schema,
              widthPx: vp.w,
              heightPx: vp.h,
              paddingPx: 96,
              includeXmlDeclaration: true,
              animated: workspaceEditorEnabled,
            })
            if (centered && centered.trim()) {
              await exportSvgSnapshot(centered, suggested)
              markExported()
              setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
              return
            }
          }
        }

        if (!geospatialEnabled) {
          const svg = await captureCanvasSvgSnapshot()
          const trimmed = String(svg || '').trim()
          if (trimmed) {
            await exportSvgSnapshot(trimmed, suggested)
            markExported()
            setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
            return
          }
        }

        const png = (geospatialEnabled ? null : await captureCanvasPngSnapshot()) || (await captureVisibleCanvasPngBlobFromDom())
        if (!png) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotNoSnapshotAvailable)
          return
        }
        const vp = readCanvasViewportSizeFromDom()
        const wrapped = await wrapPngBlobAsSvgMarkup(png, { includeXmlDeclaration: true, width: vp.w, height: vp.h })
        const wrappedTrimmed = String(wrapped || '').trim()
        if (!wrappedTrimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotNoSnapshotAvailable)
          return
        }
        await exportSvgSnapshot(wrappedTrimmed, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExportFailed)
      }
    })()
  }, [captureCanvasPngSnapshot, captureCanvasSvgSnapshot, markExported, setTransientExportStatus])

  const exportPngSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const pngBlob = await captureCanvasPngSnapshot()
        if (!pngBlob) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotNoSnapshotAvailable)
          return
        }
        await exportPngSnapshot(pngBlob, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExportFailed)
      }
    })()
  }, [captureCanvasPngSnapshot, markExported, setTransientExportStatus])

  return {
    exportSvgSnapshotAction,
    exportPngSnapshotAction,
  }
}
