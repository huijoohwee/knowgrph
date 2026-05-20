import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { summarizeDesignTokens, type DesignTokenSummaryEntry } from '@/features/design/designTokenSummary'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'

function TokenRow({ entry, color }: { entry: DesignTokenSummaryEntry; color?: boolean }) {
  return (
    <li className={cn('flex min-w-0 items-center gap-2 border-b px-2 py-1.5 last:border-b-0', UI_THEME_TOKENS.panel.border)}>
      {color ? (
        <span
          className="h-4 w-4 shrink-0 rounded border border-[color:var(--kg-border)]"
          style={{ background: entry.value }}
          aria-hidden={true}
        />
      ) : null}
      <span className={cn('min-w-0 flex-1 truncate font-mono text-[10px]', UI_THEME_TOKENS.text.primary)} title={entry.value}>
        {entry.value}
      </span>
      <span className={cn('shrink-0 font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{entry.count}</span>
    </li>
  )
}

function TokenSection(props: { title: string; entries: DesignTokenSummaryEntry[]; color?: boolean }) {
  return (
    <section className={cn('rounded border', UI_THEME_TOKENS.panel.border)} aria-label={props.title}>
      <header className={cn('flex items-center justify-between border-b px-2 py-1.5', UI_THEME_TOKENS.panel.border)}>
        <span className={cn('text-[10px] font-semibold uppercase tracking-normal', UI_THEME_TOKENS.text.secondary)}>{props.title}</span>
        <span className={cn('font-mono text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{props.entries.length}</span>
      </header>
      {props.entries.length > 0 ? (
        <ul className="m-0 max-h-36 list-none overflow-y-auto p-0">
          {props.entries.map(entry => (
            <TokenRow key={entry.value} entry={entry} color={props.color} />
          ))}
        </ul>
      ) : (
        <span className={cn('block px-2 py-2 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>None</span>
      )}
    </section>
  )
}

export default function DesignTokensPanel({ active }: { active: boolean }) {
  const panelTypography = usePanelTypography()
  const { graphData, graphDataRevision } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
    })),
  )

  const summary = React.useMemo(
    () => summarizeDesignTokens({ graphData: active ? graphData : null, graphRevision: graphDataRevision, maxEntries: 8 }),
    [active, graphData, graphDataRevision],
  )

  if (!active) {
    return <div className={cn('px-3 py-2 text-xs', UI_THEME_TOKENS.text.secondary)}>Tokens are available in Design renderer.</div>
  }

  return (
    <div className={cn('min-w-56 space-y-2 px-3 py-2', panelTypography.panelTextClass)} aria-label="Design Tokens" data-main-panel-no-drag="true">
      <div className={cn('flex items-center justify-between gap-2', UI_THEME_TOKENS.text.tertiary)}>
        <span className="text-[10px] font-mono">{summary.nodeCount} nodes</span>
        <span className="min-w-0 truncate text-right font-mono text-[10px]" title={summary.semanticKey}>
          {summary.semanticKey ? summary.semanticKey.slice(0, 10) : 'empty'}
        </span>
      </div>
      <TokenSection title="Colors" entries={summary.colorEntries} color />
      <TokenSection title="Typography" entries={summary.typographyEntries} />
      <TokenSection title="Spacing" entries={summary.spacingEntries} />
      <TokenSection title="Types" entries={summary.typeEntries} />
    </div>
  )
}
