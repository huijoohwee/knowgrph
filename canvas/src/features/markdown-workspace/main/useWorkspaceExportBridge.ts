import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UiToastInput } from '@/hooks/store/types'
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
    const mod = await import('./exports/exportWorkspaceFile')
    const { exportWorkspaceFileJsonLd } = mod
    await exportWorkspaceFileJsonLd({ activeDocumentKey, exportBaseName, text })
  }, [activeDocumentKey, activeText, exportBaseName, flushGraphWritebackForExport, viewerTextOverride])

  const handleExportMarkdown = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const text = String(markdownEditText ?? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText))
    const mod = await import('./exports/exportMarkdown')
    const { exportMarkdownFile } = mod
    await exportMarkdownFile({ exportBaseName, text, activeDocumentPath: activeDocumentKey })
  }, [activeText, exportBaseName, flushGraphWritebackForExport, markdownEditText, viewerTextOverride])

  const handleExportPng = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportPng')
    const { exportCanvasPng } = mod
    await exportCanvasPng({
      exportBaseName,
      activeDocumentPath: activeDocumentKey,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [activeDocumentKey, exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportGlb = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportGlb')
    const { exportCanvasGlb } = mod
    await exportCanvasGlb({
      exportBaseName,
      activeDocumentPath: activeDocumentKey,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [activeDocumentKey, exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportGltf = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportGlb')
    const { exportCanvasGltf } = mod
    await exportCanvasGltf({
      exportBaseName,
      activeDocumentPath: activeDocumentKey,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [activeDocumentKey, exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportHtmlViewer = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportHtmlViewer')
    const { exportHtmlViewerSnapshot } = mod
    await exportHtmlViewerSnapshot({
      exportBaseName,
      activeDocumentPath: activeDocumentKey,
      showWebpageHtml,
      iframeSrcDoc,
      viewerEl,
      viewerRefCurrent: getViewerRefCurrent(),
      pushUiToast,
    })
  }, [exportBaseName, flushGraphWritebackForExport, getViewerRefCurrent, iframeSrcDoc, pushUiToast, showWebpageHtml, viewerEl])

  const handleExportHtmlCanvas = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportHtmlCanvas')
    const { exportHtmlCanvasFromWorkspace } = mod
    await exportHtmlCanvasFromWorkspace({ exportBaseName, activeDocumentPath: activeDocumentKey, pushUiToast })
  }, [activeDocumentKey, exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportSvg = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportSvg')
    const { exportCanvasSvg } = mod
    await exportCanvasSvg({
      exportBaseName,
      activeDocumentPath: activeDocumentKey,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [activeDocumentKey, exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportJson = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const gd = useGraphStore.getState().graphData
    const mod = await import('./exports/exportJson')
    const { exportGraphJson } = mod
    await exportGraphJson({ graphData: gd, exportBaseName, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportPdfPortrait = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportPdf')
    const { exportViewerPdf } = mod
    const markdownText = String(markdownEditText ?? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText))
    await exportViewerPdf({ exportBaseName, viewerEl, viewerRefCurrent: getViewerRefCurrent(), pushUiToast, orientation: 'portrait', markdownText })
  }, [activeText, exportBaseName, flushGraphWritebackForExport, getViewerRefCurrent, markdownEditText, pushUiToast, viewerEl, viewerTextOverride])

  const handleExportPdfLandscape = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const mod = await import('./exports/exportPdf')
    const { exportViewerPdf } = mod
    const markdownText = String(markdownEditText ?? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText))
    await exportViewerPdf({ exportBaseName, viewerEl, viewerRefCurrent: getViewerRefCurrent(), pushUiToast, orientation: 'landscape', markdownText })
  }, [activeText, exportBaseName, flushGraphWritebackForExport, getViewerRefCurrent, markdownEditText, pushUiToast, viewerEl, viewerTextOverride])

  const exportBridge = React.useMemo(
    () => ({
      export: {
        duplicateInWorkspace: onSaveAs,
        workspaceFileJsonLd: () => void handleExportWorkspaceFile(),
        markdown: () => void handleExportMarkdown(),
        png: () => void handleExportPng(),
        gltf: () => void handleExportGltf(),
        glb: () => void handleExportGlb(),
        htmlViewer: () => void handleExportHtmlViewer(),
        htmlCanvas: () => void handleExportHtmlCanvas(),
        json: () => void handleExportJson(),
        svg: () => void handleExportSvg(),
        pdfPortrait: () => void handleExportPdfPortrait(),
        pdfLandscape: () => void handleExportPdfLandscape(),
      },
    }),
    [
      handleExportGlb,
      handleExportGltf,
      handleExportHtmlCanvas,
      handleExportHtmlViewer,
      handleExportJson,
      handleExportMarkdown,
      handleExportPng,
      handleExportPdfLandscape,
      handleExportPdfPortrait,
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
    handleExportPng,
    handleExportGlb,
    handleExportGltf,
    handleExportHtmlViewer,
    handleExportHtmlCanvas,
    handleExportSvg,
    handleExportJson,
    handleExportPdfPortrait,
    handleExportPdfLandscape,
  }
}
