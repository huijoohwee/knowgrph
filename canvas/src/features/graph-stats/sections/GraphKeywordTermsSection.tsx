import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import type { StatsKeywordTerm, StatsUiClasses } from '@/features/graph-stats/types'
import {
  GRAPH_KEYWORD_TERM_ACTIVE_CHIP_TONE_CLASS_NAME,
  GRAPH_KEYWORD_TERM_NEUTRAL_CHIP_TONE_CLASS_NAME,
} from '@/lib/graph/keywordTermChipStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_COMPACT_INLINE_CHIP_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const keywordChipClassName = `${UI_RESPONSIVE_COMPACT_INLINE_CHIP_CLASSNAME} rounded border cursor-pointer`

export default function GraphKeywordTermsSection(props: {
  ui: StatsUiClasses
  terms: StatsKeywordTerm[]
  selectedNodeIdSet: Set<string>
  selectNodeIds: (ids: string[]) => void
}) {
  const {
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
  } = props.ui

  return (
    <CollapsibleSection title="Keywords">
      {props.terms.length === 0 ? (
        <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          No centralized keywords found in `tags`, `keywords`, or typed node categories.
        </section>
      ) : (
        <section className="space-y-2">
          <section className={[uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
            Shared Dashboard keyword inventory derived from graph tags, keywords, and typed node categories.
          </section>
          <section className="flex flex-wrap gap-1">
            {props.terms.map(term => {
              const selected = term.nodeIds.some(nodeId => props.selectedNodeIdSet.has(nodeId))
              return (
                <button
                  key={term.term}
                  type="button"
                  className={[
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                    keywordChipClassName,
                    selected
                      ? GRAPH_KEYWORD_TERM_ACTIVE_CHIP_TONE_CLASS_NAME
                      : GRAPH_KEYWORD_TERM_NEUTRAL_CHIP_TONE_CLASS_NAME,
                  ].join(' ')}
                  onClick={() => props.selectNodeIds(term.nodeIds)}
                  title={`${term.count} nodes`}
                >
                  <span className={uiPanelMonospaceTextClass}>#{term.term}</span>
                  <span className={UI_THEME_TOKENS.text.tertiary}>{term.count}</span>
                </button>
              )
            })}
          </section>
        </section>
      )}
    </CollapsibleSection>
  )
}
