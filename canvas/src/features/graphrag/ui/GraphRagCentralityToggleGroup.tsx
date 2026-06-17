import React from 'react'
import type { GraphRagTextCentralityConfig } from '@/lib/graph/graphragTextConfig'
import { PanelCheckbox } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CentralityKey = keyof GraphRagTextCentralityConfig

type GraphRagCentralityToggleGroupProps = {
  title?: React.ReactNode
  cfg: GraphRagTextCentralityConfig
  onChange: (patch: Partial<GraphRagTextCentralityConfig>) => void
  actions?: React.ReactNode
  className?: string
  titleClassName?: string
  optionLabelClassName?: string
  options?: ReadonlyArray<{
    key: CentralityKey
    label: React.ReactNode
  }>
}

const DEFAULT_GRAPH_RAG_CENTRALITY_OPTIONS: ReadonlyArray<{
  key: CentralityKey
  label: React.ReactNode
}> = [
  { key: 'hits', label: 'HITS' },
  { key: 'closeness', label: 'Closeness' },
  { key: 'pagerank', label: 'PageRank' },
  { key: 'betweenness', label: 'Betweenness' },
]

export function GraphRagCentralityToggleGroup({
  title,
  cfg,
  onChange,
  actions,
  className,
  titleClassName,
  optionLabelClassName,
  options = DEFAULT_GRAPH_RAG_CENTRALITY_OPTIONS,
}: GraphRagCentralityToggleGroupProps) {
  return (
    <fieldset className={className}>
      {title ? (
        <legend className={[UI_THEME_TOKENS.text.tertiary, 'font-semibold', titleClassName].filter(Boolean).join(' ')}>
          {title}
        </legend>
      ) : null}
      <section className="flex flex-wrap items-center gap-3">
        {options.map(option => (
          <label key={option.key} className="inline-flex items-center gap-2">
            <PanelCheckbox
              checked={cfg[option.key]}
              onChange={event => onChange({ [option.key]: event.target.checked })}
            />
            <span className={optionLabelClassName}>{option.label}</span>
          </label>
        ))}
        {actions}
      </section>
    </fieldset>
  )
}
