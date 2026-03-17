import React from 'react'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { JSONValue } from '@/lib/graph/types'
import { isJsonValue } from '@/lib/graph/jsonValue'
import {
  getRowFieldText,
  stringifyPreview,
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableRowDensity,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { FrozenAreaResizeHandle, FROZEN_DATA_COLUMN_LEFT } from './GraphDataTableHeader'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MarkdownStructuredTextEditor } from '@/features/markdown/ui/MarkdownStructuredTextEditor'
import type { PanelTypography } from '@/lib/ui/panelTypography'

interface BodyCellProps {
  columnKey: GraphDataTableColumnKey
  row: UnifiedRow
  isActive: boolean
  rowDensity: GraphDataTableRowDensity
  width?: number
  isColumnSelected?: boolean
  expandedCellRowId: string | null
  expandedCellColumnKey: GraphDataTableColumnKey | null
  onToggleExpandCell?: (columnKey: GraphDataTableColumnKey, rowId: string) => void
  bodyCellBaseClassName: string
  textInputClassName: string
  monoTextInputClassName: string
  uiPanelMonospaceTextClass: string
  panelTypography: PanelTypography
  activeNode: GraphNode | undefined
  activeEdge: GraphEdge | undefined
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  showFrozenResizeHandle: boolean
  onStartFrozenAreaDrag?: (clientX: number) => void
  fieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonRecord(text: string): Record<string, JSONValue> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    if (!isRecord(parsed)) return null
    if (!isJsonValue(parsed)) return null
    return parsed as Record<string, JSONValue>
  } catch {
    return null
  }
}

function CellJsonEditor({
  initialValue,
  onSave,
}: {
  initialValue: unknown
  onSave: (val: Record<string, JSONValue>) => void
}) {
  const [text, setText] = React.useState(() => JSON.stringify(initialValue ?? {}, null, 2))
  
  return (
    <section
      className={`h-32 min-w-[300px] border ${UI_THEME_TOKENS.panel.border} rounded overflow-hidden ${UI_THEME_TOKENS.panel.bg} shadow-lg relative z-10`}
      aria-label="Cell JSON Editor"
    >
      <MarkdownStructuredTextEditor
        value={text}
        onChange={setText}
        language="json"
        uri={`inmemory://cell/editor/${Math.random().toString(36).slice(2)}`}
        className="w-full h-full"
        onBlur={() => {
          const next = parseJsonRecord(text)
          if (!next) return
          onSave(next)
        }}
      />
    </section>
  )
}

export const BodyCell = React.memo(function BodyCell({
  columnKey,
  row,
  isActive,
  rowDensity,
  width,
  isColumnSelected,
  expandedCellRowId,
  expandedCellColumnKey,
  onToggleExpandCell,
  bodyCellBaseClassName,
  textInputClassName,
  monoTextInputClassName,
  uiPanelMonospaceTextClass,
  panelTypography,
  activeNode,
  activeEdge,
  updateNode,
  updateEdge,
  freezeFirstDataColumn,
  showFrozenResizeHandle,
  onStartFrozenAreaDrag,
  fieldSettingsByColumnKey,
}: BodyCellProps) {
  const widthStyle: React.CSSProperties | undefined =
    width != null ? { width, minWidth: width } : undefined
  const cellStyle: React.CSSProperties | undefined = isColumnSelected
    ? { ...(widthStyle || {}), backgroundColor: 'rgba(59,130,246,0.08)' }
    : widthStyle
  const isExpandedCell =
    rowDensity === 'expanded' ||
    (rowDensity === 'compact' &&
      expandedCellRowId === row.id &&
      expandedCellColumnKey === columnKey)
  if (columnKey === 'kind') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${UI_THEME_TOKENS.text.secondary} ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-16 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.kind}
      </td>
    )
  }

  if (columnKey === 'id') {
    const isFrozen = freezeFirstDataColumn === 'id'
    const overflowClass = isExpandedCell
      ? 'whitespace-pre-wrap break-words'
      : 'truncate max-w-52 overflow-hidden whitespace-nowrap'
    const style: React.CSSProperties | undefined = isFrozen
      ? { ...(cellStyle || {}), left: FROZEN_DATA_COLUMN_LEFT }
      : cellStyle
    return (
      <td
        className={`${bodyCellBaseClassName} relative ${
          isFrozen ? `sticky z-0 ${UI_THEME_TOKENS.panel.bg}` : ''
        } ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary} ${overflowClass}`}
        style={style}
        title={row.id}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.id}
        {showFrozenResizeHandle && (
          <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} panelTypography={panelTypography} />
        )}
      </td>
    )
  }

  if (columnKey === 'label') {
    const isFrozen = freezeFirstDataColumn === 'label'
    const overflowClass = isExpandedCell
      ? 'whitespace-pre-wrap break-words'
      : 'truncate overflow-hidden whitespace-nowrap'
    const style: React.CSSProperties | undefined = isFrozen
      ? { ...(cellStyle || {}), left: FROZEN_DATA_COLUMN_LEFT }
      : cellStyle
    return (
      <td
        className={`${bodyCellBaseClassName} relative ${
          isFrozen ? 'sticky z-0' : ''
        } ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.table.cellBorder} ${overflowClass}`}
        style={style}
        title={row.label}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {isActive ? (
          <input
            defaultValue={row.label}
            onBlur={event => {
              const next = event.target.value
              if (row.kind === 'node') updateNode(row.id, { label: next })
              else updateEdge(row.id, { label: next })
            }}
            className={textInputClassName}
          />
        ) : (
          row.label
        )}
        {showFrozenResizeHandle && (
          <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} panelTypography={panelTypography} />
        )}
      </td>
    )
  }

  if (columnKey === 'type') {
    const overflowClass = isExpandedCell
      ? 'whitespace-pre-wrap break-words'
      : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
    return (
      <td
        className={`${bodyCellBaseClassName} ${UI_THEME_TOKENS.text.secondary} ${overflowClass}`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.kind === 'node' ? (
          isActive ? (
            <input
              defaultValue={row.type}
              onBlur={event => updateNode(row.id, { type: event.target.value })}
              className={textInputClassName}
            />
          ) : (
            row.type
          )
        ) : (
          ''
        )}
      </td>
    )
  }

  if (columnKey === 'source') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary} ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.kind === 'edge' ? (
          isActive ? (
            <input
              defaultValue={row.source}
              onBlur={event => updateEdge(row.id, { source: event.target.value })}
              className={monoTextInputClassName}
              list="node-ids"
            />
          ) : (
            row.source
          )
        ) : (
          ''
        )}
      </td>
    )
  }

  if (columnKey === 'target') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary} ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.kind === 'edge' ? (
          isActive ? (
            <input
              defaultValue={row.target}
              onBlur={event => updateEdge(row.id, { target: event.target.value })}
              className={monoTextInputClassName}
              list="node-ids"
            />
          ) : (
            row.target
          )
        ) : (
          ''
        )}
      </td>
    )
  }

  if (columnKey === 'properties') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary} align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {isActive ? (
          <CellJsonEditor
            initialValue={row.properties}
            onSave={(next) => {
              if (row.kind === 'node') {
                if (!activeNode) return
                updateNode(row.id, { properties: next })
              } else {
                if (!activeEdge) return
                updateEdge(row.id, { properties: next })
              }
            }}
          />
        ) : (
          stringifyPreview(row.properties)
        )}
      </td>
    )
  }

  if (columnKey === 'metadata') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.secondary} align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {isActive ? (
          <CellJsonEditor
            initialValue={row.metadata}
            onSave={(next) => {
              if (row.kind === 'node') {
                if (!activeNode) return
                updateNode(row.id, { metadata: next })
              } else {
                if (!activeEdge) return
                updateEdge(row.id, { metadata: next })
              }
            }}
          />
        ) : (
          stringifyPreview(row.metadata)
        )}
      </td>
    )
  }

  if (columnKey === 'codebasePath') {
    return (
      <td
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary} align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        style={cellStyle}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {getRowFieldText(row, columnKey)}
      </td>
    )
  }

  if (isGraphDataTablePropertyColumnKey(columnKey)) {
    const parsed = parseGraphDataTablePropertyColumnKey(columnKey)
    const settings = fieldSettingsByColumnKey.get(columnKey)
    const isMultiSelect = settings?.fieldType === 'Multi-select'

    if (parsed && row.kind === parsed.scope && isMultiSelect) {
      const raw =
        row.properties?.[parsed.propertyKey as keyof typeof row.properties]
      const values = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === 'string')
        : []

      const options = settings.selectOptions ?? []
      const optionSet = options.length > 0 ? new Set(options) : null
      const filteredValues =
        optionSet != null
          ? values.filter(v => optionSet.has(v))
          : values

      return (
        <td
          className={`${bodyCellBaseClassName} ${UI_THEME_TOKENS.text.primary} ${
            isExpandedCell
              ? 'whitespace-pre-wrap break-words'
              : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
          }`}
          style={cellStyle}
          onClick={() => {
            if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
              onToggleExpandCell(columnKey, row.id)
            }
          }}
        >
          {filteredValues.length === 0 ? (
            ''
          ) : (
            <div className="flex flex-wrap gap-1">
              {filteredValues.map((value, i) => (
                <span
                  key={`${value}-${i}`}
                  className={`inline-flex items-center rounded-full ${UI_THEME_TOKENS.badge.chip} px-2 py-0.5 leading-tight ${UI_THEME_TOKENS.text.primary} max-w-full`}
                >
                  {value}
                </span>
              ))}
            </div>
          )}
        </td>
      )
    }
  }

  return (
    <td
      className={`${bodyCellBaseClassName} ${UI_THEME_TOKENS.text.primary} ${
        isExpandedCell
          ? 'whitespace-pre-wrap break-words'
          : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
      }`}
      style={cellStyle}
      onClick={() => {
        if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
          onToggleExpandCell(columnKey, row.id)
        }
      }}
    >
      {getRowFieldText(row, columnKey)}
    </td>
  )
})
