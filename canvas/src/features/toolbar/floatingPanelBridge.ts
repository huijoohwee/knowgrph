import type { PropsPanelOpenEventDetail, FloatingPanelOpenEventDetail } from '@/features/canvas/utils'

export type FloatingPanelRequestedView =
  | 'propsPanel'
  | 'view'
  | 'interaction'
  | 'design'
  | 'chat'
  | 'geo'
  | 'renderer'
  | 'storybldr'
  | 'graphTraversal'

type FloatingPanelBridge = {
  openPropsPanel: (detail?: PropsPanelOpenEventDetail) => void
  openFloatingPanel: (detail?: FloatingPanelOpenEventDetail) => void
  openRendererPanel: () => void
}

const FLOATING_PANEL_BRIDGE_KEY = '__knowgrphFloatingPanelBridge'

declare global {
  interface Window {
    __knowgrphFloatingPanelBridge?: FloatingPanelBridge
  }
}

export function installFloatingPanelBridge(bridge: FloatingPanelBridge): () => void {
  if (typeof window === 'undefined') return () => void 0
  window[FLOATING_PANEL_BRIDGE_KEY] = bridge
  return () => {
    if (window[FLOATING_PANEL_BRIDGE_KEY] === bridge) {
      delete window[FLOATING_PANEL_BRIDGE_KEY]
    }
  }
}

export function requestPropsPanelOpen(detail?: PropsPanelOpenEventDetail): boolean {
  if (typeof window === 'undefined') return false
  const bridge = window[FLOATING_PANEL_BRIDGE_KEY]
  if (!bridge) return false
  bridge.openPropsPanel(detail)
  return true
}

export function requestFloatingPanelOpen(detail?: FloatingPanelOpenEventDetail): boolean {
  if (typeof window === 'undefined') return false
  const bridge = window[FLOATING_PANEL_BRIDGE_KEY]
  if (!bridge) return false
  bridge.openFloatingPanel(detail)
  return true
}

export function requestRendererPanelOpen(): boolean {
  if (typeof window === 'undefined') return false
  const bridge = window[FLOATING_PANEL_BRIDGE_KEY]
  if (!bridge) return false
  bridge.openRendererPanel()
  return true
}
