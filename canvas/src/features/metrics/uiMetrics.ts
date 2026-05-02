export const MARKDOWN_PANEL_METRIC_EVENT = 'kg:markdownPanelMetric' as const

export type UiMetricEventDetail = {
  event: string
} & Record<string, unknown>

export const emitUiMetric = (
  channel: string,
  event: string,
  detail: Record<string, unknown> = {},
): void => {
  try {
    if (typeof window === 'undefined') return
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(
      new CustomEventCtor(channel, {
        detail: {
          event,
          ...detail,
        },
      }),
    )
  } catch {
    void 0
  }
}

export const emitMarkdownPanelMetric = (
  event: string,
  detail: Record<string, unknown> = {},
): void => {
  emitUiMetric(MARKDOWN_PANEL_METRIC_EVENT, event, detail)
}

export function readUiMetricEventDetail(event: Event | null | undefined): UiMetricEventDetail | null {
  if (!event || typeof event !== 'object' || !('detail' in event)) return null
  const detail = (event as CustomEvent<unknown>).detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const metric = detail as Record<string, unknown>
  const eventName = String(metric.event || '').trim()
  if (!eventName) return null
  return {
    ...metric,
    event: eventName,
  }
}

export function subscribeMarkdownPanelMetric(listener: (detail: UiMetricEventDetail) => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = (event: Event) => {
    const detail = readUiMetricEventDetail(event)
    if (!detail) return
    listener(detail)
  }
  window.addEventListener(MARKDOWN_PANEL_METRIC_EVENT, handle as EventListener)
  return () => {
    window.removeEventListener(MARKDOWN_PANEL_METRIC_EVENT, handle as EventListener)
  }
}
