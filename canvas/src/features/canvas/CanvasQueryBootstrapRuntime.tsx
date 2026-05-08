import React from 'react'
import { emitMainPanelOpen, MAIN_PANEL_OPEN_READY_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { QUERY_PARAM_OPEN_EDITOR_WORKSPACE, QUERY_PARAM_OPEN_MAIN_PANEL, QUERY_PARAM_SHARE, QUERY_PARAM_SHARE_TITLE, QUERY_PARAM_SHARE_TEXT, QUERY_PARAM_SHARE_URL } from '@/lib/routing/queryParams'
import { useGraphStore } from '@/hooks/useGraphStore'

export const shouldOpenEditorWorkspaceFromSearch = (search: string): boolean => {
  const raw = String(search || '')
  if (!raw) return false
  const params = new URLSearchParams(raw)
  return String(params.get(QUERY_PARAM_OPEN_EDITOR_WORKSPACE) || '').trim().length > 0
}

type MainPanelOpenReadyWindow = Window & {
  __KG_MAIN_PANEL_OPEN_READY__?: boolean
}

export function CanvasQueryBootstrapRuntime(props: {
  search: string
}) {
  const { search } = props
  const openedMainPanelFromQueryRef = React.useRef(false)

  React.useEffect(() => {
    if (openedMainPanelFromQueryRef.current) return
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    const tab = String(params.get(QUERY_PARAM_OPEN_MAIN_PANEL) || '').trim()
    if (!tab) return
    if (typeof window === 'undefined') return

    const dispatchOpenMainPanel = () => {
      if (openedMainPanelFromQueryRef.current) return
      openedMainPanelFromQueryRef.current = true
      try {
        emitMainPanelOpen({ tab })
      } catch {
        void 0
      }
      try {
        params.delete(QUERY_PARAM_OPEN_MAIN_PANEL)
        const next = params.toString()
        const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
        window.history.replaceState(null, '', nextUrl)
      } catch {
        void 0
      }
    }

    if ((window as MainPanelOpenReadyWindow).__KG_MAIN_PANEL_OPEN_READY__ === true) {
      dispatchOpenMainPanel()
      return
    }

    const handleReady = () => {
      window.removeEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady)
      dispatchOpenMainPanel()
    }

    window.addEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady, { once: true })
    return () => {
      window.removeEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady)
    }
  }, [search])

  const handledShareRef = React.useRef(false)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)

  React.useEffect(() => {
    if (handledShareRef.current) return
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    if (!params.has(QUERY_PARAM_SHARE)) return
    if (typeof window === 'undefined') return

    handledShareRef.current = true
    const sharedTitle = String(params.get(QUERY_PARAM_SHARE_TITLE) || '').trim()
    const sharedText = String(params.get(QUERY_PARAM_SHARE_TEXT) || '').trim()
    const sharedUrl = String(params.get(QUERY_PARAM_SHARE_URL) || '').trim()
    const parts = [sharedTitle, sharedText, sharedUrl].filter(Boolean)
    if (parts.length > 0) {
      upsertUiToast({
        id: 'pwa:share-received',
        kind: 'neutral',
        message: `Shared: ${parts.join(' — ')}`,
        ttlMs: 8000,
        dismissible: true,
      })
    }
    try {
      params.delete(QUERY_PARAM_SHARE)
      params.delete(QUERY_PARAM_SHARE_TITLE)
      params.delete(QUERY_PARAM_SHARE_TEXT)
      params.delete(QUERY_PARAM_SHARE_URL)
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [search, upsertUiToast])

  return null
}
