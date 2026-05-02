export const TEXT_SELECTION_EVENT = 'select' as const

export function emitTextSelectionEvent(target: HTMLTextAreaElement | null | undefined): void {
  if (!target) return
  try {
    const view = target.ownerDocument?.defaultView
    const EventCtor = typeof view?.Event === 'function' ? view.Event : Event
    target.dispatchEvent(new EventCtor(TEXT_SELECTION_EVENT, { bubbles: true }))
  } catch {
    void 0
  }
}
