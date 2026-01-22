import type { LoaderResult } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'

export function applyLoaderResultToParserUi(
  res: LoaderResult | null,
  options?: {
    collapsePanelsOnSuccess?: boolean
    successLabelOverride?: string
    failureLabelOverride?: string
  },
): void {
  if (!res) {
    try {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, options?.failureLabelOverride || UI_COPY.parserDataLoadFailed)
    } catch {
      void 0
    }
    return
  }

  try {
    const ui = useParserUIState.getState()
    if (res.input) ui.setLastInput(res.input.name, res.input.text)
    const warnings = res.warnings || []
    const counts = res.counts
    const nodeCount = counts ? Number(counts.n || 0) : 0
    const edgeCount = counts ? Number(counts.e || 0) : 0
    const hasGraph = nodeCount > 0 || edgeCount > 0
    if (warnings.length > 0 && !hasGraph) {
      ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(warnings[0] || ''))
    } else {
      const label = options?.successLabelOverride || (res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess)
      ui.setDataLoadStatus(true, label)
      if (options?.collapsePanelsOnSuccess) {
        const store = useGraphStore.getState()
        try {
          store.setSidebarOpen(false)
          if (store.setBottomPanelCollapsed) store.setBottomPanelCollapsed(true)
        } catch {
          void 0
        }
      }
    }
    ui.setWarnings(warnings)
    if (counts) ui.setCounts(counts)
  } catch {
    void 0
  }
}
