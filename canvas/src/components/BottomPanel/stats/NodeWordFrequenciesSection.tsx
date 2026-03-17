import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_COPY } from '@/lib/config'
import type { StatsUiClasses, TokensForSelectedNode, TokensForSelectedNodes } from '@/components/BottomPanel/stats/types'

export default function NodeWordFrequenciesSection({
  ui,
  tokensForSelectedNodes,
  tokensForSelectedNode,
  statsFilterMode,
  statsExcludeTokens,
  statsIncludeTokens,
  toggleStatsToken,
}: {
  ui: StatsUiClasses
  tokensForSelectedNodes: TokensForSelectedNodes | null
  tokensForSelectedNode: TokensForSelectedNode | null
  statsFilterMode: 'exclude' | 'include'
  statsExcludeTokens: string[]
  statsIncludeTokens: string[]
  toggleStatsToken: (token: string) => void
}) {
  const {
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
  } = ui

  return (
    <CollapsibleSection title="Word frequencies by node">
      {!tokensForSelectedNodes ? (
        <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'text-gray-600'].join(' ')}>
          {UI_COPY.statsSelectNodesToSeeTokenFrequenciesLabel}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold text-gray-800'].join(' ')}>
              Selection
            </div>
            <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1 text-gray-500'].join(' ')}>
              {tokensForSelectedNodes.nodeCount} nodes, {tokensForSelectedNodes.totalTokens} tokens
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tokensForSelectedNodes.topTokens.map(t => (
                <span
                  key={t.token}
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'inline-flex items-center gap-1 px-2 py-[2px] rounded border border-gray-200 cursor-pointer',
                    (() => {
                      const tok = String(t.token || '').toLowerCase()
                      const excluded = statsExcludeTokens.includes(tok)
                      const included = statsIncludeTokens.includes(tok)
                      if (statsFilterMode === 'include') {
                        return included ? 'bg-blue-50 text-gray-700 border-blue-200' : 'bg-gray-50 text-gray-400'
                      }
                      return excluded ? 'bg-red-50 text-gray-400 border-red-200 line-through' : 'bg-gray-50 text-gray-700'
                    })(),
                  ].join(' ')}
                  onClick={() => toggleStatsToken(t.token)}
                >
                  <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                  <span className="text-gray-500">{t.count}</span>
                </span>
              ))}
            </div>
          </div>

          {tokensForSelectedNode && (
            <div className="rounded border border-gray-200 bg-white p-3">
              <div className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, 'font-semibold text-gray-800'].join(' ')}>
                Focus node
              </div>
              <div className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, 'mt-1 text-gray-500'].join(' ')}>
                id: <span className={uiPanelMonospaceTextClass}>{String(tokensForSelectedNode.node.id)}</span>
                {tokensForSelectedNode.node.label ? (
                  <>
                    {' '}
                    · label: <span className={uiPanelMonospaceTextClass}>{String(tokensForSelectedNode.node.label)}</span>
                  </>
                ) : null}{' '}
                · {tokensForSelectedNode.totalTokens} tokens
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {tokensForSelectedNode.topTokens.map(t => (
                  <span
                    key={t.token}
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      'inline-flex items-center gap-1 px-2 py-[2px] rounded border border-gray-200 cursor-pointer',
                      (() => {
                        const tok = String(t.token || '').toLowerCase()
                        const excluded = statsExcludeTokens.includes(tok)
                        const included = statsIncludeTokens.includes(tok)
                        if (statsFilterMode === 'include') {
                          return included ? 'bg-blue-50 text-gray-700 border-blue-200' : 'bg-gray-50 text-gray-400'
                        }
                        return excluded ? 'bg-red-50 text-gray-400 border-red-200 line-through' : 'bg-gray-50 text-gray-700'
                      })(),
                    ].join(' ')}
                    onClick={() => toggleStatsToken(t.token)}
                  >
                    <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                    <span className="text-gray-500">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
