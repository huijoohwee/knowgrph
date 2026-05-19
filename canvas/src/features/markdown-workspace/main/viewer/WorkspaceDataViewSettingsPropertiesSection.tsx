import React from 'react'
import { ChevronDown, ChevronRight, Copy, Link2, Trash2 } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_FOCUS_RING } from '@/lib/ui/focusRing'
import { defaultColumnTypeForInferredKind, type MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { MarkdownDataViewColumnTypeMenu } from '@/features/markdown/ui/MarkdownDataViewColumnTypeMenu'
import { iconByColumnType } from '@/features/markdown/ui/markdownDataViewColumnTypeMenuIcons'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { WorkspaceDataViewConfig } from './workspaceDataViewConfig'
import { GripDotsIcon, VisibilityIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_COLOR_PRIMARY_BLUE_INDICATOR } from '@/features/toolbar/ui/toolbarStyles'
import { reorderList } from '@/lib/reorder'
import { DetailsMenu } from '@/components/ui/DetailsMenu'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { WORKSPACE_DATA_VIEW_GRAPH_ROLE_OPTIONS, inferRoleForColumn } from './workspaceDataViewGraphRoles'
import type { WorkspaceDataViewGraphColumnRole } from './workspaceDataViewConfig'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'

export function WorkspaceDataViewSettingsPropertiesSection(props: {
  canMutate: boolean
  columns: readonly MarkdownDataViewColumn[]
  view: WorkspaceDataViewConfig
  onChangeView: (next: WorkspaceDataViewConfig) => void
  onDuplicateColumn?: (columnId: string) => void
  onDeleteColumn?: (columnId: string) => void
  onRenameColumn?: (columnId: string, nextName: string) => void
}) {
  const MAP_SELECT_CHEVRON_ALIGN_CLASS = 'mr-0'
  const COLUMN_NAME_EDIT_INPUT_CLASS = [
    'h-7 px-2 rounded border text-sm min-w-0 flex-1',
    'overflow-x-auto whitespace-nowrap [text-overflow:clip]',
    UI_FOCUS_RING,
    UI_THEME_TOKENS.input.bg,
    UI_THEME_TOKENS.input.border,
    UI_THEME_TOKENS.input.text,
  ].join(' ')
  const [draggingColumnId, setDraggingColumnId] = React.useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = React.useState<string | null>(null)
  const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState('')
  const [expandedColumnId, setExpandedColumnId] = React.useState<string | null>(null)

  const allIds = React.useMemo(() => props.columns.map(c => c.id), [props.columns])

  const visibleIds = React.useMemo(() => {
    const raw = props.view.visibleColumnIds
    if (!raw) return allIds
    const set = new Set(raw)
    const normalized = raw.filter(id => allIds.includes(id))
    for (const id of allIds) {
      if (!set.has(id)) continue
      if (normalized.includes(id)) continue
      normalized.push(id)
    }
    return normalized
  }, [allIds, props.view.visibleColumnIds])

  const hiddenIds = React.useMemo(() => {
    const visibleSet = new Set(visibleIds)
    return allIds.filter(id => !visibleSet.has(id))
  }, [allIds, visibleIds])

  const setVisibleIds = React.useCallback(
    (nextVisibleIds: readonly string[]) => {
      const normalized = nextVisibleIds.filter(id => allIds.includes(id))
      const isDefaultAllVisibleOrder =
        normalized.length === allIds.length && normalized.every((id, idx) => id === allIds[idx])
      props.onChangeView({
        ...props.view,
        visibleColumnIds: isDefaultAllVisibleOrder ? null : [...normalized],
      })
    },
    [allIds, props],
  )

  const setColumnVisible = React.useCallback(
    (columnId: string, visible: boolean) => {
      if (visible) {
        if (visibleIds.includes(columnId)) return
        setVisibleIds([...visibleIds, columnId])
        return
      }
      if (!visibleIds.includes(columnId)) return
      setVisibleIds(visibleIds.filter(id => id !== columnId))
    },
    [setVisibleIds, visibleIds],
  )

  const moveVisibleColumn = React.useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return
      const fromIndex = visibleIds.indexOf(fromId)
      const toIndex = visibleIds.indexOf(toId)
      if (fromIndex < 0 || toIndex < 0) return
      const next = reorderList(visibleIds, fromIndex, toIndex)
      setVisibleIds(next)
    },
    [setVisibleIds, visibleIds],
  )
  const setColumnType = React.useCallback(
    (args: { column: MarkdownDataViewColumn; nextType: MarkdownDataViewColumnType }) => {
      const defaultType = defaultColumnTypeForInferredKind(args.column.kind)
      const nextMap = { ...(props.view.columnTypesById ?? {}) }
      if (args.nextType === defaultType) delete nextMap[args.column.id]
      else nextMap[args.column.id] = args.nextType
      const normalized = Object.keys(nextMap).length ? nextMap : null
      props.onChangeView({
        ...props.view,
        columnTypesById: normalized,
      })
    },
    [props],
  )
  const setColumnGraphRole = React.useCallback(
    (columnId: string, role: WorkspaceDataViewGraphColumnRole) => {
      const nextMap = { ...(props.view.graphRolesByColumnId ?? {}) }
      nextMap[columnId] = role
      props.onChangeView({
        ...props.view,
        graphRolesByColumnId: nextMap,
      })
    },
    [props],
  )

  const icon14 = ['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')

  const startRename = React.useCallback(
    (columnId: string, currentName: string) => {
      if (!props.canMutate) return
      if (!props.onRenameColumn) return
      setEditingColumnId(columnId)
      setEditingName(String(currentName ?? ''))
    },
    [props.canMutate, props.onRenameColumn],
  )

  const commitRename = React.useCallback(
    (columnId: string) => {
      if (!props.canMutate) return
      if (!props.onRenameColumn) return
      const next = String(editingName ?? '').trim()
      setEditingColumnId(null)
      if (!next) return
      props.onRenameColumn(columnId, next)
    },
    [editingName, props],
  )

  return (
    <section aria-label="Properties">
      <section className="space-y-1" aria-label="Properties chooser">
        {visibleIds.map(columnId => {
          const c = props.columns.find(x => x.id === columnId)
          if (!c) return null
          const visible = true
          const type = (props.view.columnTypesById && props.view.columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
          const graphRole = (props.view.graphRolesByColumnId && props.view.graphRolesByColumnId[c.id]) || inferRoleForColumn(c.name)
          const Icon = iconByColumnType[type]
          const isDragOver = dragOverColumnId === c.id && draggingColumnId && draggingColumnId !== c.id
          const isExpanded = expandedColumnId === c.id

          return (
            <div
              key={c.id}
              className={[
                'relative px-2 py-1 rounded border',
                UI_THEME_TOKENS.panel.border,
                UI_THEME_TOKENS.button.hoverBg,
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={editingColumnId !== c.id}
              onDragStart={e => {
                const t = e.target as HTMLElement | null
                if (t?.tagName && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL'].includes(t.tagName)) {
                  e.preventDefault()
                  return
                }
                setDraggingColumnId(c.id)
                setDragOverColumnId(c.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(c.id))
              }}
              onDragOver={e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverColumnId(c.id)
              }}
              onDrop={e => {
                e.preventDefault()
                const from = String(e.dataTransfer.getData('text/plain') || '').trim()
                if (from) moveVisibleColumn(from, c.id)
                setDraggingColumnId(null)
                setDragOverColumnId(null)
              }}
              onDragEnd={() => {
                setDraggingColumnId(null)
                setDragOverColumnId(null)
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverColumnId(null)
                }
              }}
            >
              {isDragOver ? (
                <div className="absolute left-2 right-2 bottom-0 h-[2px]" style={{ backgroundColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }} />
              ) : null}

              <div className={`${UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME} gap-2`}>
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <GripDotsIcon className={['w-4 h-4 shrink-0', UI_THEME_TOKENS.text.tertiary].join(' ')} />

                  <DetailsMenu
                    ariaLabel={`Property type: ${c.name}`}
                    detailsClassName="relative"
                    summaryClassName={[
                      'list-none cursor-pointer inline-flex items-center justify-center w-7 h-7 rounded',
                      UI_THEME_TOKENS.button.hoverBg,
                    ].join(' ')}
                    menuClassName="kg-column-header-children kg-click-expand-menu-children mt-1"
                    summary={<Icon className={icon14} aria-hidden="true" />}
                    menu={({ close }) => (
                      <MarkdownDataViewColumnTypeMenu
                        ariaLabel={`Property type: ${c.name}`}
                        value={type}
                        className="w-[240px]"
                        onSelect={(next) => {
                          setColumnType({ column: c, nextType: next })
                          close()
                        }}
                      />
                    )}
                  />

                  {editingColumnId === c.id ? (
                    <input
                      autoFocus
                      className={COLUMN_NAME_EDIT_INPUT_CLASS}
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => commitRename(c.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename(c.id)
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setEditingColumnId(null)
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={['text-sm min-w-0 text-left', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}
                      onClick={() => setExpandedColumnId(prev => (prev === c.id ? null : c.id))}
                      onDoubleClick={() => startRename(c.id, c.name)}
                      aria-expanded={isExpanded}
                      aria-controls={`property-map-panel-${c.id}`}
                    >
                      {c.name}
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    onClick={() => setColumnVisible(c.id, false)}
                    aria-pressed={visible}
                    aria-label="Hide"
                  >
                    <VisibilityIcon hidden={!visible} iconClassName="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    onClick={() => props.onDuplicateColumn?.(c.id)}
                    disabled={!props.canMutate || !props.onDuplicateColumn}
                    aria-label="Duplicate"
                  >
                    <Copy className={icon14} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    onClick={() => props.onDeleteColumn?.(c.id)}
                    disabled={!props.canMutate || !props.onDeleteColumn || props.columns.length <= 1}
                    aria-label="Delete"
                  >
                    <Trash2 className={icon14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                    onClick={() => setExpandedColumnId(prev => (prev === c.id ? null : c.id))}
                    aria-label={isExpanded ? 'Collapse property details' : 'Expand property details'}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className={icon14} aria-hidden="true" /> : <ChevronRight className={icon14} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              {isExpanded ? (
                <section id={`property-map-panel-${c.id}`} className="mt-2">
                  <div className="flex min-w-0 max-w-full items-start gap-2">
                    <span className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span
                      className={['inline-flex items-center justify-center w-7 h-7 rounded shrink-0', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                      aria-label="Table-to-graph map"
                    >
                      <Link2 className={icon14} aria-hidden="true" />
                    </span>
                    <label className="block flex-1 min-w-0">
                      <span className="sr-only">Table-to-graph map</span>
                      <div className="relative">
                        <select
                          className={[UI_FOCUS_RING, MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'w-full text-left', MAP_SELECT_CHEVRON_ALIGN_CLASS].join(' ')}
                          value={graphRole}
                          onChange={e => {
                            setColumnGraphRole(c.id, e.target.value as WorkspaceDataViewGraphColumnRole)
                          }}
                          disabled={!props.canMutate || props.view.graphEnabled !== true}
                        >
                          {WORKSPACE_DATA_VIEW_GRAPH_ROLE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                </section>
              ) : null}
            </div>
          )
        })}

        {hiddenIds.length ? (
          <section className="mt-2" aria-label="Hidden properties">
            <div className={['text-xs font-medium px-2 py-1', UI_THEME_TOKENS.text.secondary].join(' ')}>Hidden</div>
            <div className="space-y-1">
              {hiddenIds.map(columnId => {
                const c = props.columns.find(x => x.id === columnId)
                if (!c) return null
                const visible = false
                const type = (props.view.columnTypesById && props.view.columnTypesById[c.id]) || defaultColumnTypeForInferredKind(c.kind)
                const graphRole = (props.view.graphRolesByColumnId && props.view.graphRolesByColumnId[c.id]) || inferRoleForColumn(c.name)
                const Icon = iconByColumnType[type]
                const isExpanded = expandedColumnId === c.id
                return (
                  <div key={c.id} className={['px-2 py-1 rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg].join(' ')}>
                    <div className={`${UI_RESPONSIVE_ELEMENT_ROW_CLASSNAME} gap-2`}>
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <GripDotsIcon className={['w-4 h-4 shrink-0 opacity-30', UI_THEME_TOKENS.text.tertiary].join(' ')} />
                        <span className={['inline-flex items-center justify-center w-7 h-7 rounded opacity-70'].join(' ')}>
                          <Icon className={icon14} aria-hidden="true" />
                        </span>
                        {editingColumnId === c.id ? (
                          <input
                            autoFocus
                            className={COLUMN_NAME_EDIT_INPUT_CLASS}
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onBlur={() => commitRename(c.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitRename(c.id)
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditingColumnId(null)
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className={['text-sm min-w-0 text-left', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}
                            onClick={() => setExpandedColumnId(prev => (prev === c.id ? null : c.id))}
                            onDoubleClick={() => startRename(c.id, c.name)}
                            aria-expanded={isExpanded}
                            aria-controls={`property-map-panel-${c.id}`}
                          >
                            {c.name}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                          onClick={() => setColumnVisible(c.id, true)}
                          aria-pressed={visible}
                          aria-label="Show"
                        >
                          <VisibilityIcon hidden={!visible} iconClassName="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                          onClick={() => props.onDuplicateColumn?.(c.id)}
                          disabled={!props.canMutate || !props.onDuplicateColumn}
                          aria-label="Duplicate"
                        >
                          <Copy className={icon14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                          onClick={() => props.onDeleteColumn?.(c.id)}
                          disabled={!props.canMutate || !props.onDeleteColumn || props.columns.length <= 1}
                          aria-label="Delete"
                        >
                          <Trash2 className={icon14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={['inline-flex items-center justify-center w-8 h-8 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                          onClick={() => setExpandedColumnId(prev => (prev === c.id ? null : c.id))}
                          aria-label={isExpanded ? 'Collapse property details' : 'Expand property details'}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronDown className={icon14} aria-hidden="true" /> : <ChevronRight className={icon14} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    {isExpanded ? (
                      <section id={`property-map-panel-${c.id}`} className="mt-2">
                        <div className="flex min-w-0 max-w-full items-start gap-2">
                          <span className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span
                            className={['inline-flex items-center justify-center w-7 h-7 rounded shrink-0', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                            aria-label="Table-to-graph map"
                          >
                            <Link2 className={icon14} aria-hidden="true" />
                          </span>
                          <label className="block flex-1 min-w-0">
                            <span className="sr-only">Table-to-graph map</span>
                            <div className="relative">
                              <select
                                className={[UI_FOCUS_RING, MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'w-full text-left', MAP_SELECT_CHEVRON_ALIGN_CLASS].join(' ')}
                                value={graphRole}
                                onChange={e => {
                                  setColumnGraphRole(c.id, e.target.value as WorkspaceDataViewGraphColumnRole)
                                }}
                                disabled={!props.canMutate || props.view.graphEnabled !== true}
                              >
                                {WORKSPACE_DATA_VIEW_GRAPH_ROLE_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                        </div>
                      </section>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </section>
    </section>
  )
}
