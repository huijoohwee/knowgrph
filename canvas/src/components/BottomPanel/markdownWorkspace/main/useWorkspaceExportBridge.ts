import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/types'
import { exportWorkspaceFileJsonLd } from './exports/exportWorkspaceFile'
import { exportMarkdownFile } from './exports/exportMarkdown'
import { exportHtmlViewerSnapshot } from './exports/exportHtmlViewer'
import { exportHtmlCanvasFromWorkspace } from './exports/exportHtmlCanvas'
import { exportCanvasSvg } from './exports/exportSvg'
import { exportGraphJson } from './exports/exportJson'
import { exportViewerPdf } from './exports/exportPdf'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'

type UseWorkspaceExportBridgeArgs = {
  activeDocumentKey: string
  activeText: string
  markdownEditText: string | null
  viewerTextOverride?: string | null
  showWebpageHtml: boolean
  iframeSrcDoc: string
  viewerEl: HTMLElement | null
  pushUiToast: (toast: UiToastInput) => void
  onSaveAs?: () => void
  getViewerRefCurrent: () => HTMLElement | null
}

export function useWorkspaceExportBridge(args: UseWorkspaceExportBridgeArgs) {
  const {
    activeDocumentKey,
    activeText,
    markdownEditText,
    viewerTextOverride,
    showWebpageHtml,
    iframeSrcDoc,
    viewerEl,
    pushUiToast,
    onSaveAs,
    getViewerRefCurrent,
  } = args

  const exportBaseName = React.useMemo(() => {
    const raw = String(activeDocumentKey || '').trim() || 'document'
    const base = raw.split('/').filter(Boolean).pop() || raw
    return base.replace(/\.[a-z0-9]+$/i, '') || 'document'
  }, [activeDocumentKey])

  const flushGraphWritebackForExport = React.useCallback(() => {
    try {
      useGraphStore.getState().flushComposedPositionWritesNow()
    } catch {
      void 0
    }
  }, [])

  const handleExportWorkspaceFile = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const text = String(typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText)
    await exportWorkspaceFileJsonLd({ activeDocumentKey, exportBaseName, text })
  }, [activeDocumentKey, activeText, exportBaseName, flushGraphWritebackForExport, viewerTextOverride])

  const handleExportMarkdown = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const text = String(markdownEditText ?? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText))
    await exportMarkdownFile({ exportBaseName, text })
  }, [activeText, exportBaseName, flushGraphWritebackForExport, markdownEditText, viewerTextOverride])

  const handleExportHtmlViewer = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportHtmlViewerSnapshot({
      exportBaseName,
      showWebpageHtml,
      iframeSrcDoc,
      viewerEl,
      viewerRefCurrent: getViewerRefCurrent(),
      pushUiToast,
    })
  }, [exportBaseName, flushGraphWritebackForExport, getViewerRefCurrent, iframeSrcDoc, pushUiToast, showWebpageHtml, viewerEl])

  const handleExportHtmlCanvas = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportHtmlCanvasFromWorkspace({ exportBaseName, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportSvg = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportCanvasSvg({
      exportBaseName,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportJson = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const gd = useGraphStore.getState().graphData
    await exportGraphJson({ graphData: gd, exportBaseName, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportPdf = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportViewerPdf({ exportBaseName, viewerEl, viewerRefCurrent: getViewerRefCurrent(), pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, getViewerRefCurrent, pushUiToast, viewerEl])

  const exportBridge = React.useMemo(
    () => ({
      export: {
        duplicateInWorkspace: onSaveAs,
        workspaceFileJsonLd: () => void handleExportWorkspaceFile(),
        markdown: () => void handleExportMarkdown(),
        htmlViewer: () => void handleExportHtmlViewer(),
        htmlCanvas: () => void handleExportHtmlCanvas(),
        json: () => void handleExportJson(),
        svg: () => void handleExportSvg(),
        pdf: () => void handleExportPdf(),
      },
    }),
    [
      handleExportHtmlCanvas,
      handleExportHtmlViewer,
      handleExportJson,
      handleExportMarkdown,
      handleExportPdf,
      handleExportSvg,
      handleExportWorkspaceFile,
      onSaveAs,
    ],
  )

  React.useEffect(() => {
    return registerMarkdownWorkspaceActionBridge('markdown-workspace-export', exportBridge)
  }, [exportBridge])

  return {
    handleExportWorkspaceFile,
    handleExportMarkdown,
    handleExportHtmlViewer,
    handleExportHtmlCanvas,
    handleExportSvg,
    handleExportJson,
    handleExportPdf,
  }
}
