export const FLOW_EDITOR_OVERLAY_ROOT_SELECTOR = '[data-kg-node-quick-editor]'

export const FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR =
  'input,textarea,select,button,a,[role="textbox"],[role="button"],[contenteditable="true"]'

export const FLOW_EDITOR_INTERACTION_FRAME_EVENT = 'kg-flow-editor-interaction-frame'

export type FlowEditorOverlayProxyTarget =
  | { kind: 'none' }
  | { kind: 'canvas'; targetEl: Element }
  | { kind: 'overlay'; targetEl: Element; overlayRoot: HTMLElement; isInteractive: boolean }

export function resolveFlowEditorOverlayProxyTarget(args: { target: unknown; canvasEl: Element }): FlowEditorOverlayProxyTarget {
  const el = args.target instanceof Element ? args.target : null
  if (!el) return { kind: 'none' }
  if (args.canvasEl.contains(el)) return { kind: 'canvas', targetEl: el }

  const root = el.closest(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR)
  const overlayRoot = root instanceof HTMLElement ? root : null
  if (!overlayRoot) return { kind: 'none' }

  const isInteractive = !!el.closest(FLOW_EDITOR_OVERLAY_INTERACTIVE_SELECTOR)
  return { kind: 'overlay', targetEl: el, overlayRoot, isInteractive }
}
