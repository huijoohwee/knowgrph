import React from 'react'
import { ArrowUpDown, Copy, Filter, LayoutGrid, SlidersHorizontal, Table as TableIcon, Trash2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewConfig, WorkspaceDataViewLayout } from './workspaceDataViewConfig'
import { WorkspaceDataViewSettingsGraphSection } from './WorkspaceDataViewSettingsGraphSection'
import { WorkspaceDataViewSettingsPropertiesSection } from './WorkspaceDataViewSettingsPropertiesSection'
import { WorkspaceDataViewSettingsFilterSection } from './WorkspaceDataViewSettingsFilterSection'
import { WorkspaceDataViewSettingsSortSection } from './WorkspaceDataViewSettingsSortSection'
import { LayoutChoice } from './WorkspaceDataViewSettingsPrimitives'

export function WorkspaceDataViewSettingsDialog(props: {
  open: boolean
  canMutate: boolean
  viewerLayout: WorkspaceDataViewLayout
  columns: readonly MarkdownDataViewColumn[]
  groupByColumnId: string | null
  viewConfig: WorkspaceDataViewConfig
  setViewConfig: (next: WorkspaceDataViewConfig) => void
  onChangeLayout: (layout: WorkspaceDataViewLayout) => void
  onDuplicateColumn?: (columnId: string) => void
  onDeleteColumn?: (columnId: string) => void
  onRenameColumn?: (columnId: string, nextName: string) => void
  onClose: () => void
}) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null)
  const [activePanel, setActivePanel] = React.useState<'layout' | 'properties' | 'filter' | 'sort' | 'group' | 'duplicate' | 'delete'>('properties')

  React.useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (props.open) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
      setActivePanel('properties')
    }
  }, [props.open])

  const shownCount = React.useMemo(() => {
    return props.viewConfig.visibleColumnIds ? props.viewConfig.visibleColumnIds.length : props.columns.length
  }, [props.columns.length, props.viewConfig.visibleColumnIds])

  const groupableColumns = React.useMemo(() => {
    return props.columns.filter(c => c.kind === 'select' || c.kind === 'multi-select')
  }, [props.columns])

  return (
    <dialog
      ref={dialogRef}
      className={[
        'rounded-lg p-0 border shadow-xl w-[720px] max-w-[92vw] h-[560px] max-h-[85vh] overflow-hidden',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
      onMouseDown={e => {
        const el = dialogRef.current
        if (!el) return
        if (e.target === el) props.onClose()
      }}
      onCancel={e => {
        e.preventDefault()
        props.onClose()
      }}
      aria-label={MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}
    >
      <div className="h-full flex flex-col">
        <header className={['flex items-center gap-2 px-4 py-3 border-b', UI_THEME_TOKENS.panel.divider].join(' ')}>
          <h3 className={['text-base font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>{MARKDOWN_DATA_VIEW_COPY.viewSettingsLabel}</h3>
          <button
            type="button"
            className={['ml-auto inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
            aria-label="Close"
            onClick={() => props.onClose()}
          >
            <span className={UI_THEME_TOKENS.text.secondary}>✕</span>
          </button>
        </header>

        <main className="flex flex-1 min-h-0">
          <nav
            className={['w-[220px] border-r p-2 overflow-y-auto', UI_THEME_TOKENS.panel.divider].join(' ')}
            aria-label="View settings sections"
          >
            {([
              { key: 'layout' as const, label: 'Layout', icon: <LayoutGrid className="w-4 h-4" aria-hidden="true" /> },
              { key: 'properties' as const, label: 'Properties', icon: <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />, value: `${shownCount} shown` },
              { key: 'filter' as const, label: MARKDOWN_DATA_VIEW_COPY.filterLabel, icon: <Filter className="w-4 h-4" aria-hidden="true" /> },
              { key: 'sort' as const, label: MARKDOWN_DATA_VIEW_COPY.sortLabel, icon: <ArrowUpDown className="w-4 h-4" aria-hidden="true" /> },
              { key: 'group' as const, label: 'Group', icon: <LayoutGrid className="w-4 h-4" aria-hidden="true" /> },
              { key: 'duplicate' as const, label: 'Duplicate', icon: <Copy className="w-4 h-4" aria-hidden="true" /> },
              { key: 'delete' as const, label: 'Delete', icon: <Trash2 className="w-4 h-4" aria-hidden="true" /> },
            ] as const).map(item => {
              const active = activePanel === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    'w-full flex items-center gap-2 px-2 py-2 rounded text-sm',
                    active
                      ? [UI_THEME_TOKENS.button.activeBg, UI_THEME_TOKENS.button.activeText].join(' ')
                      : [UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.primary].join(' '),
                  ].join(' ')}
                  onMouseEnter={() => setActivePanel(item.key)}
                  onFocus={() => setActivePanel(item.key)}
                >
                  <span className={active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.icon.color}>{item.icon}</span>
                  <span className="min-w-0 truncate">{item.label}</span>
                  {'value' in item && item.value ? (
                    <span className={['ml-auto text-xs', active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary].join(' ')}>{item.value}</span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <section className="flex-1 p-4 overflow-y-auto" aria-label="View settings panel">
          {activePanel === 'layout' ? (
            <section className="space-y-4" aria-label="Layout">
              <label className="block">
                <span className={['block text-xs mb-1', UI_THEME_TOKENS.text.secondary].join(' ')}>View name</span>
                <input
                  className={['w-full text-sm px-3 py-2 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
                  value={props.viewConfig.name}
                  onChange={e => props.setViewConfig({ ...props.viewConfig, name: e.target.value })}
                  placeholder="View name"
                />
              </label>

              <div>
                <div className={['flex items-center gap-2 text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>
                  <LayoutGrid className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
                  <span>Layout</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <LayoutChoice
                    active={props.viewerLayout === 'table'}
                    label={MARKDOWN_DATA_VIEW_COPY.tableViewLabel}
                    icon={<TableIcon className="w-6 h-6" aria-hidden="true" />}
                    onClick={() => props.onChangeLayout('table')}
                  />
                  <LayoutChoice
                    active={props.viewerLayout === 'kanban'}
                    label={MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel}
                    icon={<LayoutGrid className="w-6 h-6" aria-hidden="true" />}
                    onClick={() => props.onChangeLayout('kanban')}
                  />
                </div>
              </div>

              <WorkspaceDataViewSettingsGraphSection
                canMutate={props.canMutate}
                columns={props.columns}
                view={props.viewConfig}
                onChangeView={props.setViewConfig}
              />
            </section>
          ) : null}

          {activePanel === 'properties' ? (
            <WorkspaceDataViewSettingsPropertiesSection
              canMutate={props.canMutate}
              columns={props.columns}
              view={props.viewConfig}
              onChangeView={props.setViewConfig}
              onDuplicateColumn={props.onDuplicateColumn}
              onDeleteColumn={props.onDeleteColumn}
              onRenameColumn={props.onRenameColumn}
            />
          ) : null}

          {activePanel === 'filter' ? (
            <WorkspaceDataViewSettingsFilterSection columns={props.columns} view={props.viewConfig} onChangeView={props.setViewConfig} />
          ) : null}

          {activePanel === 'sort' ? (
            <WorkspaceDataViewSettingsSortSection columns={props.columns} view={props.viewConfig} onChangeView={props.setViewConfig} />
          ) : null}

          {activePanel === 'group' ? (
            <section aria-label="Group" className="space-y-2">
              <div className={['text-sm font-medium', UI_THEME_TOKENS.text.primary].join(' ')}>Group by</div>
              <select
                className={['w-full h-8 px-2 rounded border', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text].join(' ')}
                value={props.viewConfig.groupByColumnId || ''}
                onChange={e => props.setViewConfig({ ...props.viewConfig, groupByColumnId: e.target.value || null })}
              >
                <option value="">None</option>
                {groupableColumns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className={['text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>Grouping is available for Select / Multi-select properties.</div>
            </section>
          ) : null}

          {activePanel === 'duplicate' ? (
            <section aria-label="Duplicate" className="space-y-2">
              <div className={['text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>Duplicate view is not available yet.</div>
            </section>
          ) : null}

          {activePanel === 'delete' ? (
            <section aria-label="Delete" className="space-y-2">
              <div className={['text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>Delete view is not available yet.</div>
            </section>
          ) : null}
          </section>
        </main>
      </div>
    </dialog>
  )
}
