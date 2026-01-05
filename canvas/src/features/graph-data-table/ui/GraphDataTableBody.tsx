import React from 'react'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
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

interface BodyCellProps {
  columnKey: GraphDataTableColumnKey
  row: UnifiedRow
  isActive: boolean
  rowDensity: GraphDataTableRowDensity
  expandedCellRowId: string | null
  expandedCellColumnKey: GraphDataTableColumnKey | null
  onToggleExpandCell?: (columnKey: GraphDataTableColumnKey, rowId: string) => void
  bodyCellBaseClassName: string
  textInputClassName: string
  monoTextInputClassName: string
  textareaClassName: string
  uiPanelMonospaceTextClass: string
  activeNode: GraphNode | undefined
  activeEdge: GraphEdge | undefined
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  showFrozenResizeHandle: boolean
  onStartFrozenAreaDrag?: (clientX: number) => void
  fieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
}

export const BodyCell = React.memo(function BodyCell({
  columnKey,
  row,
  isActive,
  rowDensity,
  expandedCellRowId,
  expandedCellColumnKey,
  onToggleExpandCell,
  bodyCellBaseClassName,
  textInputClassName,
  monoTextInputClassName,
  textareaClassName,
  uiPanelMonospaceTextClass,
  activeNode,
  activeEdge,
  updateNode,
  updateEdge,
  freezeFirstDataColumn,
  showFrozenResizeHandle,
  onStartFrozenAreaDrag,
  fieldSettingsByColumnKey,
}: BodyCellProps) {
  const isExpandedCell =
    rowDensity === 'expanded' ||
    (rowDensity === 'compact' &&
      expandedCellRowId === row.id &&
      expandedCellColumnKey === columnKey)
  if (columnKey === 'kind') {
    return (
      <td
        className={`${bodyCellBaseClassName} text-gray-700 ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-16 overflow-hidden whitespace-nowrap'
        }`}
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
    return (
      <td
        className={`${bodyCellBaseClassName} relative ${
          isFrozen ? 'sticky z-0 bg-white' : ''
        } ${uiPanelMonospaceTextClass} text-gray-900 ${overflowClass}`}
        style={isFrozen ? { left: FROZEN_DATA_COLUMN_LEFT } : undefined}
        title={row.id}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {row.id}
        {showFrozenResizeHandle && (
          <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} />
        )}
      </td>
    )
  }

  if (columnKey === 'label') {
    const isFrozen = freezeFirstDataColumn === 'label'
    const overflowClass = isExpandedCell
      ? 'whitespace-pre-wrap break-words'
      : 'truncate overflow-hidden whitespace-nowrap'
    return (
      <td
        className={`${bodyCellBaseClassName} relative ${
          isFrozen ? 'sticky z-0' : ''
        } text-gray-900 w-60 border-gray-100 ${overflowClass}`}
        style={isFrozen ? { left: FROZEN_DATA_COLUMN_LEFT } : undefined}
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
          <FrozenAreaResizeHandle onStartDrag={onStartFrozenAreaDrag} />
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
        className={`${bodyCellBaseClassName} text-gray-700 ${overflowClass}`}
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
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} text-gray-900 ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
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
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} text-gray-900 ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
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
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} text-gray-700 align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {isActive ? (
          <textarea
            defaultValue={JSON.stringify(row.properties ?? {}, null, 2)}
            onBlur={event => {
              try {
                const next = JSON.parse(event.target.value)
                if (row.kind === 'node') {
                  if (!activeNode) return
                  updateNode(row.id, { properties: next })
                } else {
                  if (!activeEdge) return
                  updateEdge(row.id, { properties: next })
                }
              } catch {
                void 0
              }
            }}
            rows={3}
            className={textareaClassName}
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
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} text-gray-700 align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
        onClick={() => {
          if (rowDensity === 'compact' && !isActive && onToggleExpandCell) {
            onToggleExpandCell(columnKey, row.id)
          }
        }}
      >
        {isActive ? (
          <textarea
            defaultValue={JSON.stringify(row.metadata ?? {}, null, 2)}
            onBlur={event => {
              try {
                const next = JSON.parse(event.target.value)
                if (row.kind === 'node') {
                  if (!activeNode) return
                  updateNode(row.id, { metadata: next })
                } else {
                  if (!activeEdge) return
                  updateEdge(row.id, { metadata: next })
                }
              } catch {
                void 0
              }
            }}
            rows={3}
            className={textareaClassName}
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
        className={`${bodyCellBaseClassName} ${uiPanelMonospaceTextClass} text-gray-700 align-top ${
          isExpandedCell
            ? 'whitespace-pre-wrap break-words'
            : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
        }`}
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
          className={`${bodyCellBaseClassName} text-gray-700 ${
            isExpandedCell
              ? 'whitespace-pre-wrap break-words'
              : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
          }`}
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
              {filteredValues.map(value => (
                <span
                  key={value}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] leading-tight text-gray-800 max-w-full"
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
      className={`${bodyCellBaseClassName} text-gray-700 ${
        isExpandedCell
          ? 'whitespace-pre-wrap break-words'
          : 'truncate max-w-40 overflow-hidden whitespace-nowrap'
      }`}
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
