import React from 'react'
import { MAIN_PANEL_OPEN_EVENT, MAIN_PANEL_OPEN_READY_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { QUERY_PARAM_OPEN_EDITOR_WORKSPACE, QUERY_PARAM_OPEN_MAIN_PANEL } from '@/lib/routing/queryParams'

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
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab } }))
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

  return null
}
