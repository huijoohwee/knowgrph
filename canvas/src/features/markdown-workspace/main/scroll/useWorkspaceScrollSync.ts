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

export function scrollWorkspaceEditorHandleToBottom(h: MonacoTextEditorHandle): number {
  const max = Math.max(0, h.getScrollHeight() - h.getClientHeight())
  h.setScrollTop(max)
  return max
}

export function useWorkspaceScrollSync(args: {
  activeDocumentKey: string
  layoutMode: MarkdownWorkspaceLayoutMode
  showWebpageHtml: boolean
  markdownEditorHandle: MonacoTextEditorHandle | null
  jsonEditorHandle: MonacoTextEditorHandle | null
  viewerEl: HTMLElement | null
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
  liveTextTailFollowKey?: string | null
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
    const disposers: Array<{ dispose: () => void }> = []
    if (args.markdownEditorHandle) {
      disposers.push(
        args.markdownEditorHandle.onDidScrollChange(() => {
          setSavedRatio(getEditorScrollRatio(args.markdownEditorHandle!))
        }),
      )
    }
    if (args.jsonEditorHandle) {
      disposers.push(
        args.jsonEditorHandle.onDidScrollChange(() => {
          setSavedRatio(getEditorScrollRatio(args.jsonEditorHandle!))
        }),
      )
    }
    if (!disposers.length) return
    return () => {
      for (const sub of disposers) {
        try {
          sub.dispose()
        } catch {
          void 0
        }
      }
    }
  }, [args.jsonEditorHandle, args.markdownEditorHandle, setSavedRatio])

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
    if (args.viewerEl) {
      setScrollRatio(args.viewerEl, ratio)
    }
    if (!args.showWebpageHtml) {
      if (args.layoutMode === 'editor' || args.layoutMode === 'split') {
        if (args.markdownEditorHandle) setEditorScrollRatio(args.markdownEditorHandle, ratio)
        if (args.jsonEditorHandle) setEditorScrollRatio(args.jsonEditorHandle, ratio)
      }
      return
    }
    const iframe = args.iframeRef.current
    if (!iframe) return
    if (args.layoutMode === 'editor' || args.layoutMode === 'split') {
      if (args.markdownEditorHandle) setEditorScrollRatio(args.markdownEditorHandle, ratio)
      if (args.jsonEditorHandle) setEditorScrollRatio(args.jsonEditorHandle, ratio)
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
  }, [args.iframeRef, args.jsonEditorHandle, args.layoutMode, args.markdownEditorHandle, args.showWebpageHtml, args.viewerEl, getSavedRatio])

  React.useLayoutEffect(() => {
    if (!args.liveTextTailFollowKey) return
    if (args.layoutMode !== 'editor' && args.layoutMode !== 'split') return
    let followed = false
    if (args.markdownEditorHandle) {
      scrollWorkspaceEditorHandleToBottom(args.markdownEditorHandle)
      followed = true
    }
    if (args.jsonEditorHandle) {
      scrollWorkspaceEditorHandleToBottom(args.jsonEditorHandle)
      followed = true
    }
    if (args.layoutMode === 'split' && args.viewerEl) {
      setScrollRatio(args.viewerEl, 1)
      followed = true
    }
    if (followed) setSavedRatio(1)
  }, [
    args.jsonEditorHandle,
    args.layoutMode,
    args.liveTextTailFollowKey,
    args.markdownEditorHandle,
    args.viewerEl,
    setSavedRatio,
  ])

  useSyncScrollEditorHandleElements(args.markdownEditorHandle, args.viewerEl, args.layoutMode === 'split')
  useSyncScrollEditorHandleElements(args.jsonEditorHandle, args.viewerEl, args.layoutMode === 'split')

  React.useEffect(() => {
    if (!args.showWebpageHtml) return
    const iframe = args.iframeRef.current
    if (!iframe) return
    if (!args.markdownEditorHandle && !args.jsonEditorHandle) return

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
      const baseHandle = args.markdownEditorHandle || args.jsonEditorHandle
      if (!baseHandle) return
      const ratio = getEditorScrollRatio(baseHandle)
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
      if (args.markdownEditorHandle) setEditorScrollRatio(args.markdownEditorHandle, ratio)
      if (args.jsonEditorHandle) setEditorScrollRatio(args.jsonEditorHandle, ratio)
    }

    const subs: Array<{ dispose: () => void }> = []
    if (args.markdownEditorHandle) {
      subs.push(args.markdownEditorHandle.onDidScrollChange(() => {
        if (args.layoutMode !== 'split') return
        handleEditorScroll()
      }))
    }
    if (args.jsonEditorHandle) {
      subs.push(args.jsonEditorHandle.onDidScrollChange(() => {
        if (args.layoutMode !== 'split') return
        handleEditorScroll()
      }))
    }
    window.addEventListener('message', handleMessage)
    return () => {
      for (const sub of subs) {
        try {
          sub.dispose()
        } catch {
          void 0
        }
      }
      window.removeEventListener('message', handleMessage)
    }
  }, [args.iframeRef, args.jsonEditorHandle, args.layoutMode, args.markdownEditorHandle, args.showWebpageHtml, setSavedRatio])
}
