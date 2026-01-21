import type { BottomTab } from '@/features/bottom-panel/open'

export type BottomPanelCurationView = 'grid' | 'json' | 'markdown'

export function resolveCurationJsonViewText(args: {
  tab: BottomTab
  curationView: BottomPanelCurationView
  jsonSourceDocumentText: string | null
  graphJsonText: string
}): { text: string; isSource: boolean } {
  const src =
    typeof args.jsonSourceDocumentText === 'string' && args.jsonSourceDocumentText.trim()
      ? args.jsonSourceDocumentText
      : null
  const isSource = args.tab === 'curation' && args.curationView === 'json' && !!src
  return { text: isSource && src ? src : args.graphJsonText, isSource }
}

