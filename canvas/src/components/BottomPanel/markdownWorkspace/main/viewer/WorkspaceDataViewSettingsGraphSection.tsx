import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_FOCUS_RING } from '@/lib/ui/focusRing'
import { cn } from '@/lib/utils'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewConfig, WorkspaceDataViewGraphColumnRole } from './workspaceDataViewConfig'

const normalize = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim()

const inferRoleForColumn = (name: string): WorkspaceDataViewGraphColumnRole => {
  const lower = normalize(name).toLowerCase()
  if (lower === 'task') return 'node'
  if (lower === 'status') return 'color'
  if (lower === 'category') return 'group'
  if (lower === 'dependency' || lower === 'dependencies') return 'dependsOn'
  if (lower === 'predecessor' || lower === 'predecessors') return 'predecessor'
  if (lower === 'successor' || lower === 'successors') return 'successor'
  return 'none'
}

const buildSuggestedRoles = (cols: readonly MarkdownDataViewColumn[]): Record<string, WorkspaceDataViewGraphColumnRole> => {
  const out: Record<string, WorkspaceDataViewGraphColumnRole> = {}
  for (const c of cols) {
    out[c.id] = inferRoleForColumn(c.name)
  }
  return out
}

const ROLE_OPTIONS: Array<{ value: WorkspaceDataViewGraphColumnRole; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'node', label: 'Node (title)' },
  { value: 'color', label: 'Node color' },
  { value: 'group', label: 'Cluster / group' },
  { value: 'dependsOn', label: 'Edge: dependency' },
  { value: 'predecessor', label: 'Edge: predecessor' },
  { value: 'successor', label: 'Edge: successor' },
]

export function WorkspaceDataViewSettingsGraphSection(props: {
  canMutate: boolean
  columns: readonly MarkdownDataViewColumn[]
  view: WorkspaceDataViewConfig
  onChangeView: (next: WorkspaceDataViewConfig) => void
}) {
  const roles = props.view.graphRolesByColumnId ?? {}
  const enabled = props.view.graphEnabled === true

  const setEnabled = React.useCallback(
    (next: boolean) => {
      const nextView: WorkspaceDataViewConfig = { ...props.view, graphEnabled: next }
      const hasAnyRole = props.view.graphRolesByColumnId && Object.keys(props.view.graphRolesByColumnId).length > 0
      if (next && !hasAnyRole) {
        nextView.graphRolesByColumnId = buildSuggestedRoles(props.columns)
      }
      props.onChangeView(nextView)
    },
    [props.columns, props.onChangeView, props.view],
  )

  const setRole = React.useCallback(
    (columnId: string, role: WorkspaceDataViewGraphColumnRole) => {
      const base = { ...(props.view.graphRolesByColumnId ?? {}) }
      base[columnId] = role
      props.onChangeView({ ...props.view, graphRolesByColumnId: base })
    },
    [props.onChangeView, props.view],
  )

  return (
    <section className="space-y-3" aria-label="Multi-dimensional table graph">
      <fieldset className={['rounded border p-3', UI_THEME_TOKENS.panel.border].join(' ')}>
        <legend className={['px-1 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Multi-dimensional Table</legend>
        <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>
          Map table columns to graph properties used in Frontmatter Mode.
        </div>

        <label className="mt-3 flex items-center gap-2" aria-label="Enable Multi-dimensional Table graph">
          <input
            type="checkbox"
            className={cn('rounded', UI_FOCUS_RING)}
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            disabled={!props.canMutate}
          />
          <span className={['text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>Enable table-to-graph rendering</span>
        </label>
      </fieldset>

      <fieldset className={['rounded border p-3', UI_THEME_TOKENS.panel.border].join(' ')} disabled={!enabled}>
        <legend className={['px-1 text-sm font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>Property Type</legend>
        <div className="space-y-2" role="group" aria-label="Column mappings">
          {props.columns.map(col => {
            const current = roles[col.id] ?? inferRoleForColumn(col.name)
            return (
              <div key={col.id} className="grid grid-cols-[1fr_220px] gap-3 items-center">
                <div className="min-w-0">
                  <div className={['text-sm font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>{col.name || col.id}</div>
                  <div className={['text-xs', UI_THEME_TOKENS.text.tertiary].join(' ')}>{col.kind}</div>
                </div>
                <label className="block">
                  <span className="sr-only">Property type</span>
                  <select
                    className={cn(
                      'w-full text-sm px-2 py-2 rounded border bg-transparent',
                      UI_FOCUS_RING,
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={current}
                    onChange={e => setRole(col.id, e.target.value as WorkspaceDataViewGraphColumnRole)}
                    disabled={!props.canMutate || !enabled}
                  >
                    {ROLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
