import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphField, GraphFieldId, GraphFieldSettingsById, GraphFieldSettingsResolved, GraphFieldType } from '@/features/graph-fields/graphFields'
import { GRAPH_FIELD_TYPES, parseGraphFieldId } from '@/features/graph-fields/graphFields'
import type { GraphDataTableColumnKey } from '@/features/graph-data-table/graphDataTable'
import { isGraphDataTablePropertyColumnKey } from '@/features/graph-data-table/graphDataTable'
import {
  BaseFieldIcon,
  FieldColorIcon,
  FieldOriginIcon,
  FieldTypeBadgeIcon,
  GraphFieldsIcon,
  GripDotsIcon,
  ScopeIcon,
  VisibilityIcon,
} from '@/features/graph-fields/ui/graphFieldIcons'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_COPY, UI_LABELS } from '@/lib/config'

export type GraphFieldsListRowProps = {
  columnKey: GraphDataTableColumnKey
  label: string
  graphFieldId: GraphFieldId | null
  field: GraphField | null
  settings: GraphFieldSettingsResolved | null
  settingsById: GraphFieldSettingsById
  schema: GraphSchema | null
  schemaDefinedFieldIds: ReadonlySet<GraphFieldId>
  styleOwnerByFieldId: ReadonlyMap<GraphFieldId, string>
  nodeStyleOwnerKey: string
  edgeStyleOwnerKey: string
  nodeScopeBorderColor: string
  edgeScopeBorderColor: string
  uiPanelKeyValueTextSizeClass: string
  iconSizeClass: string
  uiIconStrokeWidth: number
  visible: boolean
  isOnlyVisibleColumn: boolean
  active: boolean
  isDragOver: boolean
  draggingCuratorColumnKey: GraphDataTableColumnKey | null
  setSelectedFieldId: (id: GraphFieldId | null) => void
  setCuratorColumnVisibility: (key: GraphDataTableColumnKey, visible: boolean) => void
  moveCuratorColumn: (from: GraphDataTableColumnKey, to: GraphDataTableColumnKey) => void
  updateGraphFieldSettings: (fieldId: GraphFieldId, patch: Partial<GraphFieldSettingsResolved>) => void
  updateNodeStyle: (type: string, style: Partial<{ color: string }>) => void
  updateEdgeStyle: (label: string, style: Partial<{ color: string; width: number }>) => void
  setDraggingCuratorColumnKey: (key: GraphDataTableColumnKey | null) => void
  setDragOverCuratorColumnKey: (key: GraphDataTableColumnKey | null) => void
}

export const GraphFieldsListRow = React.memo(function GraphFieldsListRow({
  columnKey,
  label,
  graphFieldId,
  field,
  settings,
  settingsById,
  schema,
  schemaDefinedFieldIds,
  styleOwnerByFieldId,
  nodeStyleOwnerKey,
  edgeStyleOwnerKey,
  nodeScopeBorderColor,
  edgeScopeBorderColor,
  uiPanelKeyValueTextSizeClass,
  iconSizeClass,
  uiIconStrokeWidth,
  visible,
  isOnlyVisibleColumn,
  active,
  isDragOver,
  draggingCuratorColumnKey,
  setSelectedFieldId,
  setCuratorColumnVisibility,
  moveCuratorColumn,
  updateGraphFieldSettings,
  updateNodeStyle,
  updateEdgeStyle,
  setDraggingCuratorColumnKey,
  setDragOverCuratorColumnKey,
}: GraphFieldsListRowProps) {
  const isPropertyColumn = isGraphDataTablePropertyColumnKey(columnKey)
  const isCustomField = settings?.isCustom === true

  const scope: 'node' | 'edge' | null = field
    ? field.scope
    : graphFieldId
      ? parseGraphFieldId(graphFieldId)?.scope ?? null
      : null

  let styleOwnerKey: string | null = null
  if (field && scope) {
    const candidate = styleOwnerByFieldId.get(field.id)
    styleOwnerKey = candidate ?? (scope === 'node' ? nodeStyleOwnerKey : edgeStyleOwnerKey)
  } else if (scope === 'node') {
    styleOwnerKey = nodeStyleOwnerKey
  } else if (scope === 'edge') {
    styleOwnerKey = edgeStyleOwnerKey
  }

  const borderColor =
    scope === 'node'
      ? (styleOwnerKey && schema?.nodeStyles?.[styleOwnerKey]?.color?.trim()) || nodeScopeBorderColor
      : scope === 'edge'
        ? (styleOwnerKey && schema?.edgeStyles?.[styleOwnerKey]?.color?.trim()) || edgeScopeBorderColor
        : null

  const scopeColor = borderColor || '#9CA3AF'
  const colorInputValue =
    typeof scopeColor === 'string' && scopeColor.trim().startsWith('#') ? scopeColor.trim() : '#000000'

  const scopeIconNode = field ? (
    <ScopeIcon scope={field.scope} className={`${iconSizeClass} text-gray-500`} strokeWidth={uiIconStrokeWidth} />
  ) : (
    <GraphFieldsIcon className={`${iconSizeClass} text-gray-400`} strokeWidth={uiIconStrokeWidth} />
  )

  const originIconNode = (() => {
    if (field) {
      if (isCustomField) {
        return (
          <FieldOriginIcon
            isCustom
            className="inline-flex items-center justify-center"
            iconClassName={iconSizeClass}
            strokeWidth={uiIconStrokeWidth}
          />
        )
      }
      if (schemaDefinedFieldIds.has(field.id)) {
        return (
          <BaseFieldIcon
            className="inline-flex items-center justify-center"
            iconClassName={iconSizeClass}
            strokeWidth={uiIconStrokeWidth}
          />
        )
      }
      return (
        <FieldOriginIcon
          isCustom={false}
          className="inline-flex items-center justify-center"
          iconClassName={iconSizeClass}
          strokeWidth={uiIconStrokeWidth}
        />
      )
    }
    if (!isPropertyColumn) {
      return (
        <BaseFieldIcon
          className="inline-flex items-center justify-center"
          iconClassName={iconSizeClass}
          strokeWidth={uiIconStrokeWidth}
        />
      )
    }
    const parsed = parseGraphFieldId(graphFieldId ? String(graphFieldId) : '')
    if (!parsed) return null
    const settingsEntry = settingsById[`${parsed.scope}:${parsed.key}` as GraphFieldId]
    if (!settingsEntry) return null
    const isCustom = settingsEntry.isCustom === true
    return (
      <FieldOriginIcon
        isCustom={isCustom}
        className="inline-flex items-center justify-center"
        iconClassName={iconSizeClass}
        strokeWidth={uiIconStrokeWidth}
      />
    )
  })()

  const typeBadgeNode = field ? (
    <FieldTypeBadgeIcon
      kind={field.kind}
      fieldTypeLabel={settings?.fieldType}
      className={iconSizeClass}
      strokeWidth={uiIconStrokeWidth}
    />
  ) : null

  const colorSwatchNode =
    scope === 'node' || scope === 'edge' ? (
      (() => {
        const colorLabel = scope === 'node' ? UI_COPY.graphFieldsNodeColorLabel : UI_COPY.graphFieldsEdgeColorLabel
        const tooltipText = UI_COPY.graphFieldsColorSwatchTooltip(scope)
        return (
          <Tooltip content={tooltipText} maxWidthPx={260} contentClassName="bg-gray-800/90">
            <label className="inline-flex items-center justify-center relative group h-6 w-6" aria-label={colorLabel}>
              <FieldColorIcon
                color={scopeColor}
                className="inline-flex items-center justify-center"
                iconClassName={iconSizeClass}
              />
              <input
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer bg-transparent"
                value={colorInputValue}
                onChange={e => {
                  const next = String(e.target.value || '').trim()
                  if (!next || !next.startsWith('#')) return
                  if (!scope || !styleOwnerKey) return
                  if (scope === 'node') {
                    updateNodeStyle(styleOwnerKey, { color: next })
                  } else {
                    updateEdgeStyle(styleOwnerKey, { color: next })
                  }
                }}
                aria-label={colorLabel}
              />
            </label>
          </Tooltip>
        )
      })()
    ) : (
      <FieldColorIcon
        color={scopeColor}
        className="inline-flex items-center justify-center"
        iconClassName={iconSizeClass}
      />
    )

  return (
      <div
        className={[
          'border-b border-gray-100 last:border-b-0 px-2 py-1.5',
          'flex items-center gap-2 border-l-2',
          active ? 'bg-blue-50' : 'bg-white hover:bg-gray-50',
          isDragOver ? 'ring-1 ring-blue-400' : '',
          'min-w-0 overflow-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
        style={borderColor ? { borderLeftColor: borderColor } : undefined}
        draggable
        onClick={() => {
          if (graphFieldId) setSelectedFieldId(graphFieldId)
        }}
        onDragStart={e => {
          const t = e.target as HTMLElement | null
          if (t?.tagName && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL'].includes(t.tagName)) {
            e.preventDefault()
            return
          }
          setDraggingCuratorColumnKey(columnKey)
          setDragOverCuratorColumnKey(columnKey)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(columnKey))
        }}
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverCuratorColumnKey(columnKey)
        }}
        onDrop={e => {
          e.preventDefault()
          const from = (e.dataTransfer.getData('text/plain') || '') as GraphDataTableColumnKey
          if (from) moveCuratorColumn(from, columnKey)
          setDraggingCuratorColumnKey(null)
          setDragOverCuratorColumnKey(null)
        }}
        onDragEnd={() => {
          setDraggingCuratorColumnKey(null)
          setDragOverCuratorColumnKey(null)
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragOverCuratorColumnKey(null)
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripDotsIcon className={`${iconSizeClass} text-gray-400`} />
          <div className="min-w-0 flex-1">
            <div className="min-w-0 flex items-center gap-2">
              {scopeIconNode}
              <div className="min-w-0">
                {active && field && settings ? (
                  <div className="min-w-0 flex items-center gap-2">
                    <input
                      value={settings.displayName}
                      onChange={e => updateGraphFieldSettings(field.id, { displayName: e.target.value })}
                      className="h-7 w-full min-w-0 rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                      onClick={e => e.stopPropagation()}
                    />
                    <select
                      value={settings.fieldType}
                      onChange={e => updateGraphFieldSettings(field.id, { fieldType: e.target.value as GraphFieldType })}
                      className="h-7 w-44 shrink-0 rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                      onClick={e => e.stopPropagation()}
                    >
                      {GRAPH_FIELD_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 min-w-0 text-xs text-gray-800 truncate">
                    <span className="truncate">{label}</span>
                  </div>
                )}
                <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 truncate`}>
                  {String(columnKey)}
                  {field ? ` · ${field.samples.toLocaleString()} samples` : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {draggingCuratorColumnKey === columnKey ? (
            <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>{UI_LABELS.moving}</span>
          ) : null}
          {originIconNode}
          {!active || !field || !settings ? typeBadgeNode : null}
          <span className="inline-flex items-center justify-center h-6 w-6">{colorSwatchNode}</span>
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 disabled:opacity-40"
            disabled={visible && isOnlyVisibleColumn}
            onClick={() => {
              const nextVisible = !visible
              setCuratorColumnVisibility(columnKey, nextVisible)
              if (graphFieldId) setSelectedFieldId(graphFieldId)
            }}
            aria-pressed={visible}
          >
            <VisibilityIcon hidden={!visible} iconClassName={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </button>
        </div>
      </div>
  )
})
