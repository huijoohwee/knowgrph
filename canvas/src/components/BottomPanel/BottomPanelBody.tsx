import React from 'react'
import BottomPanelStatsTab from '@/components/BottomPanel/BottomPanelStatsTab'
import HistoryView from '@/features/panels/views/HistoryView'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphNode } from '@/lib/graph/types'
import type { BottomTab } from '@/features/bottom-panel/open'
import { UI_COPY } from '@/lib/config'
import { importHistoryJsonLd as runImportHistoryJsonLd } from '@/features/panels/hooks/workflowJsonLdActions'

type BottomPanelBodyProps = {
  tab: BottomTab
  searchQuery: string
  nodes: GraphNode[]
}

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function BottomPanelBody({
  tab,
  searchQuery,
  nodes,
}: BottomPanelBodyProps) {
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const importHistoryJsonLd = React.useCallback(() => {
    void runImportHistoryJsonLd({
      setTransientExportStatus: (msg) => {
        try {
          upsertUiToast({ id: 'history-import', kind: 'neutral', message: msg, ttlMs: 5000 })
        } catch {
          void 0
        }
      },
      markExported: () => void 0,
    })
  }, [upsertUiToast])

  return (
    <>
      <section className="flex-1 min-h-0 overflow-hidden px-3 pb-1" aria-label="Panel Content">
        {tab === 'stats' ? (
          <BottomPanelStatsTab />
        ) : tab === 'history' ? (
          <section className="h-full min-h-0 flex flex-col overflow-auto" aria-label="History Panel">
            <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.divider}`}>
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={importHistoryJsonLd}
              >
                {UI_COPY.bottomPanelImportHistoryJsonLdAgenticRagButtonLabel}
              </button>
            </header>
            <HistoryView searchQuery={searchQuery} />
          </section>
        ) : (
          <BottomPanelStatsTab />
        )}
        <datalist id="node-ids">
          {nodes.map(n => (
            <option key={n.id} value={n.id} />
          ))}
        </datalist>
      </section>
    </>
  )
}
