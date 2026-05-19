import React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import { UI_FOCUS_RING } from '@/lib/ui/focusRing'
import type { WorkspaceDataViewConfig, WorkspaceDataViewSortDirection, WorkspaceDataViewSortRule } from './workspaceDataViewConfig'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_ACTION_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { uiToolbarRowScrollClassName } from '@/features/toolbar/ui/toolbarStyles'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

export function WorkspaceDataViewSettingsSortSection(props: {
  columns: readonly MarkdownDataViewColumn[]
  view: WorkspaceDataViewConfig
  onChangeView: (next: WorkspaceDataViewConfig) => void
}) {
  const current = props.view.sortRules[0] || null

  const setSort = React.useCallback(
    (patch: Partial<Pick<WorkspaceDataViewSortRule, 'columnId' | 'direction'>>) => {
      const existing = props.view.sortRules[0]
      const next: WorkspaceDataViewSortRule = {
        id: existing?.id || makeId(),
        columnId: patch.columnId || existing?.columnId || (props.columns[0]?.id || ''),
        direction: (patch.direction || existing?.direction || 'asc') as WorkspaceDataViewSortDirection,
      }
      if (!next.columnId) {
        props.onChangeView({ ...props.view, sortRules: [] })
        return
      }
      props.onChangeView({ ...props.view, sortRules: [next] })
    },
    [props],
  )

  return (
    <section aria-label="Sort">
      <section className={['rounded border p-2 space-y-2', UI_THEME_TOKENS.panel.border].join(' ')} aria-label="Sort rules">
        <div className={`${uiToolbarRowScrollClassName} gap-2`}>
          <label className="min-w-0 flex-1">
            <span className={['block text-xs mb-1', UI_THEME_TOKENS.text.secondary].join(' ')}>Field</span>
            <select
              className={[UI_FOCUS_RING, MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'w-full text-left'].join(' ')}
              value={current?.columnId || ''}
              onChange={e => setSort({ columnId: e.target.value })}
            >
              {props.columns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className={['block text-xs mb-1', UI_THEME_TOKENS.text.secondary].join(' ')}>Dir</span>
            <select
              className={[UI_FOCUS_RING, MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME].join(' ')}
              value={current?.direction || 'asc'}
              onChange={e => setSort({ direction: e.target.value === 'desc' ? 'desc' : 'asc' })}
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </label>
        </div>

        <div className="flex min-w-0 max-w-full items-center justify-end">
          <button
            type="button"
            className={[UI_RESPONSIVE_ACTION_ROW_CLASSNAME, 'gap-2 px-3 h-8 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}
            onClick={() => props.onChangeView({ ...props.view, sortRules: [] })}
            disabled={props.view.sortRules.length === 0}
          >
            <ArrowUpDown className={['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
            <span className={['text-xs font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>Clear</span>
          </button>
        </div>
      </section>
    </section>
  )
}
