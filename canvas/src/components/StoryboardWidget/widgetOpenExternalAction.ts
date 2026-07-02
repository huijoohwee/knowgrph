export type WidgetOpenExternalAction = {
  visible: true
  label: string
  onOpen: () => void
}

export function openWidgetExternalUrl(url: string): void {
  const resolvedUrl = String(url || '').trim()
  if (!resolvedUrl || typeof window === 'undefined') return
  try {
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
  } catch {
    void 0
  }
}

export function buildWidgetOpenExternalAction(args: {
  url: string | null | undefined
  label?: string | null | undefined
}): WidgetOpenExternalAction | undefined {
  const url = String(args.url || '').trim()
  if (!url) return undefined
  const label = String(args.label || '').trim() || 'Open source'
  return {
    visible: true,
    label,
    onOpen: () => {
      openWidgetExternalUrl(url)
    },
  }
}
