import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_COPY } from '@/lib/config'
import type { StatsUiClasses, TokensForSelectedNode, TokensForSelectedNodes } from '@/features/graph-stats/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_COMPACT_INLINE_CHIP_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const statsTokenChipBaseClassName = `${UI_RESPONSIVE_COMPACT_INLINE_CHIP_CLASSNAME} rounded border cursor-pointer`
const statsTokenDefaultClassName = `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.input.border}`
const statsTokenIncludedClassName = `bg-blue-50 ${UI_THEME_TOKENS.text.primary} border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800`
const statsTokenExcludedClassName = `bg-red-50 ${UI_THEME_TOKENS.text.tertiary} border-red-200 line-through dark:bg-red-900/20 dark:text-red-200 dark:border-red-800`
const statsTokenInactiveIncludedClassName = `${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.text.tertiary} ${UI_THEME_TOKENS.input.border}`
const statsPanelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`

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
        <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.statsSelectNodesToSeeTokenFrequenciesLabel}
        </section>
      ) : (
        <section className="space-y-2">
          <section className={statsPanelClassName}>
            <section className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, `font-semibold ${UI_THEME_TOKENS.text.primary}`].join(' ')}>
              Selection
            </section>
            <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, `mt-1 ${UI_THEME_TOKENS.text.tertiary}`].join(' ')}>
              {tokensForSelectedNodes.nodeCount} nodes, {tokensForSelectedNodes.totalTokens} tokens
            </section>
            <section className="mt-2 flex flex-wrap gap-1">
              {tokensForSelectedNodes.topTokens.map(t => (
                <span
                  key={t.token}
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    statsTokenChipBaseClassName,
                    (() => {
                      const tok = String(t.token || '').toLowerCase()
                      const excluded = statsExcludeTokens.includes(tok)
                      const included = statsIncludeTokens.includes(tok)
                      if (statsFilterMode === 'include') {
                        return included ? statsTokenIncludedClassName : statsTokenInactiveIncludedClassName
                      }
                      return excluded ? statsTokenExcludedClassName : statsTokenDefaultClassName
                    })(),
                  ].join(' ')}
                  onClick={() => toggleStatsToken(t.token)}
                >
                  <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                  <span className={UI_THEME_TOKENS.text.tertiary}>{t.count}</span>
                </span>
              ))}
            </section>
          </section>

          {tokensForSelectedNode && (
            <section className={statsPanelClassName}>
              <section className={[uiPanelKeyValueTextSizeClass, uiPanelTextFontClass, `font-semibold ${UI_THEME_TOKENS.text.primary}`].join(' ')}>
                Focus node
              </section>
              <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, `mt-1 ${UI_THEME_TOKENS.text.tertiary}`].join(' ')}>
                id: <span className={uiPanelMonospaceTextClass}>{String(tokensForSelectedNode.node.id)}</span>
                {tokensForSelectedNode.node.label ? (
                  <>
                    {' '}
                    · label: <span className={uiPanelMonospaceTextClass}>{String(tokensForSelectedNode.node.label)}</span>
                  </>
                ) : null}{' '}
                · {tokensForSelectedNode.totalTokens} tokens
              </section>
              <section className="mt-2 flex flex-wrap gap-1">
                {tokensForSelectedNode.topTokens.map(t => (
                  <span
                    key={t.token}
                    className={[
                      uiPanelMicroLabelTextSizeClass,
                      uiPanelTextFontClass,
                      statsTokenChipBaseClassName,
                      (() => {
                        const tok = String(t.token || '').toLowerCase()
                        const excluded = statsExcludeTokens.includes(tok)
                        const included = statsIncludeTokens.includes(tok)
                        if (statsFilterMode === 'include') {
                          return included ? statsTokenIncludedClassName : statsTokenInactiveIncludedClassName
                        }
                        return excluded ? statsTokenExcludedClassName : statsTokenDefaultClassName
                      })(),
                    ].join(' ')}
                    onClick={() => toggleStatsToken(t.token)}
                  >
                    <span className={uiPanelMonospaceTextClass}>{t.token}</span>
                    <span className={UI_THEME_TOKENS.text.tertiary}>{t.count}</span>
                  </span>
                ))}
              </section>
            </section>
          )}
        </section>
      )}
    </CollapsibleSection>
  )
}
