import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useSyncScrollEditorHandleElements } from '../../useSyncScroll'

function clamp01(n: number) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function getScrollRatio(el: HTMLElement) {
  const max = Math.max(1, el.scrollHeight - el.clientHeight)
  return clamp01(el.scrollTop / max)
}

function getEditorScrollRatio(h: MonacoTextEditorHandle) {
  const max = Math.max(1, h.getScrollHeight() - h.getClientHeight())
  return clamp01(h.getScrollTop() / max)
}

function setScrollRatio(el: HTMLElement, ratio: number) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  el.scrollTop = Math.round(clamp01(ratio) * max)
}

function setEditorScrollRatio(h: MonacoTextEditorHandle, ratio: number) {
  const max = Math.max(0, h.getScrollHeight() - h.getClientHeight())
  h.setScrollTop(Math.round(clamp01(ratio) * max))
}

export function useWorkspaceScrollSync(args: {
  activeDocumentKey: string
  layoutMode: MarkdownWorkspaceLayoutMode
  showWebpageHtml: boolean
  editorHandle: MonacoTextEditorHandle | null
  viewerEl: HTMLElement | null
  setViewerEl: (next: HTMLElement | null) => void
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
}) {
  const scrollRatioByDocRef = React.useRef<Map<string, number>>(new Map())
  const docKey = String(args.activeDocumentKey || '')

  const setSavedRatio = React.useCallback(
    (ratio: number) => {
      if (!docKey) return
      const r = clamp01(ratio)
      const prev = scrollRatioByDocRef.current.get(docKey)
      if (prev === r) return
      scrollRatioByDocRef.current.set(docKey, r)
    },
    [docKey],
  )

  const getSavedRatio = React.useCallback(() => {
    if (!docKey) return 0
    const v = scrollRatioByDocRef.current.get(docKey)
    return typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : 0
  }, [docKey])

  React.useEffect(() => {
    if (args.showWebpageHtml) args.setViewerEl(null)
  }, [args.showWebpageHtml, args.setViewerEl])

  React.useEffect(() => {
    if (!args.editorHandle) return
    const sub = args.editorHandle.onDidScrollChange(() => {
      setSavedRatio(getEditorScrollRatio(args.editorHandle!))
    })
    return () => {
      try {
        sub.dispose()
      } catch {
        void 0
      }
    }
  }, [args.editorHandle, setSavedRatio])

  React.useEffect(() => {
    if (!args.viewerEl) return
    const handleScroll = () => {
      setSavedRatio(getScrollRatio(args.viewerEl!))
    }
    args.viewerEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      args.viewerEl?.removeEventListener('scroll', handleScroll)
    }
  }, [args.viewerEl, setSavedRatio])

  React.useEffect(() => {
    const ratio = getSavedRatio()
    if (!args.showWebpageHtml) {
      if (args.viewerEl) {
        setScrollRatio(args.viewerEl, ratio)
      }
      if (args.editorHandle && (args.layoutMode === 'editor' || args.layoutMode === 'split')) {
        setEditorScrollRatio(args.editorHandle, ratio)
      }
      return
    }
    const iframe = args.iframeRef.current
    if (!iframe) return
    if (args.editorHandle && (args.layoutMode === 'editor' || args.layoutMode === 'split')) {
      setEditorScrollRatio(args.editorHandle, ratio)
    }
    const sendRatioToIframe = (r: number) => {
      try {
        iframe.contentWindow?.postMessage({ kind: 'kg-scroll-sync', ratio: r }, '*')
      } catch {
        void 0
      }
    }
    const handleLoad = () => {
      sendRatioToIframe(ratio)
    }
    iframe.addEventListener('load', handleLoad)
    sendRatioToIframe(ratio)
    return () => {
      iframe.removeEventListener('load', handleLoad)
    }
  }, [args.editorHandle, args.iframeRef, args.layoutMode, args.showWebpageHtml, args.viewerEl, getSavedRatio])

  useSyncScrollEditorHandleElements(args.editorHandle, args.viewerEl, args.layoutMode === 'split' && !args.showWebpageHtml)

  React.useEffect(() => {
    if (!args.showWebpageHtml) return
    const iframe = args.iframeRef.current
    if (!iframe) return
    if (!args.editorHandle) return

    const lockRef = { owner: null as 'editor' | 'iframe' | null, until: 0 }
    const canSync = (owner: 'editor' | 'iframe') => {
      const now = Date.now()
      if (!lockRef.owner || now > lockRef.until) {
        lockRef.owner = null
        lockRef.until = 0
        return true
      }
      return lockRef.owner === owner
    }

    const sendRatioToIframe = (ratio: number) => {
      try {
        iframe.contentWindow?.postMessage({ kind: 'kg-scroll-sync', ratio }, '*')
      } catch {
        void 0
      }
    }

    const handleEditorScroll = () => {
      if (!canSync('editor')) return
      lockRef.owner = 'editor'
      lockRef.until = Date.now() + 180
      const ratio = getEditorScrollRatio(args.editorHandle!)
      setSavedRatio(ratio)
      sendRatioToIframe(ratio)
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      const d = e.data as { kind?: unknown; ratio?: unknown } | null
      if (!d || d.kind !== 'kg-scroll-sync') return
      const ratio = typeof d.ratio === 'number' ? d.ratio : NaN
      if (!Number.isFinite(ratio)) return
      setSavedRatio(ratio)
      if (args.layoutMode !== 'split') return
      if (!canSync('iframe')) return
      lockRef.owner = 'iframe'
      lockRef.until = Date.now() + 180
      setEditorScrollRatio(args.editorHandle!, ratio)
    }

    const sub = args.editorHandle.onDidScrollChange(() => {
      if (args.layoutMode !== 'split') return
      handleEditorScroll()
    })
    window.addEventListener('message', handleMessage)
    return () => {
      try {
        sub.dispose()
      } catch {
        void 0
      }
      window.removeEventListener('message', handleMessage)
    }
  }, [args.editorHandle, args.iframeRef, args.layoutMode, args.showWebpageHtml, setSavedRatio])
}

