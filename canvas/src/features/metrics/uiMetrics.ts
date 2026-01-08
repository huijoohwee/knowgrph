export const emitUiMetric = (
  channel: string,
  event: string,
  detail: Record<string, unknown> = {},
): void => {
  try {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent(channel, {
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
  emitUiMetric('kg:markdownPanelMetric', event, detail)
}

