import React from 'react'

import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import { UI_LABELS } from '@/lib/config'
import type { SchemaFieldSpec } from '@/lib/graph/flowPorts'
import { buildSchemaFieldPortKey } from '@/lib/graph/flowPorts'
import { formatFlowHandleKeyValue, readFlowHandlePath } from '@/lib/graph/flowHandlePresentation'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { patchAtIndex } from 'grph-shared/array/patchArrayItem'

type SchemaFieldRow = { id: string; title: string; type: string }

function normalizeSchemaFieldRows(schemaFields: ReadonlyArray<SchemaFieldSpec>): SchemaFieldRow[] {
  return (schemaFields || []).map(f => {
    const id = String(f.id || '').trim()
    const title = String(f.label || f.id || '').trim()
    const type = String(f.type || '').trim()
    return { id, title: title || id, type }
  })
}

function buildSchemaFieldsValue(rows: ReadonlyArray<SchemaFieldRow>): unknown[] {
  const out: unknown[] = []
  for (const row of rows) {
    const title = String(row.title || '').trim()
    if (!title) continue
    const type = String(row.type || '').trim()
    out.push({ title, ...(type ? { type } : {}) })
  }
  return out
}

export const NodeOverlayEditorSchemaTable = React.memo(function NodeOverlayEditorSchemaTable(props: {
  active: boolean
  schemaFields: ReadonlyArray<SchemaFieldSpec>
  portHandlesEnabled: boolean
  dotSizePx: number
  dotHitPx: number
  microLabelClass: string
  textSizeClass: string
  keyValueInputClass: string
  onSchemaPortHandleClick?: (args: { dir: 'in' | 'out'; portKey: string }) => void
  onCommitSchemaFields: (next: unknown[]) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}) {
  const {
    active,
    schemaFields,
    portHandlesEnabled,
    dotSizePx,
    dotHitPx,
    microLabelClass,
    textSizeClass,
    keyValueInputClass,
    onSchemaPortHandleClick,
    onCommitSchemaFields,
    onRenameSchemaFieldId,
  } = props

  const schemaSig = React.useMemo(() => {
    return (schemaFields || [])
      .map(f => `${String(f.id || '')}:${String(f.label || '')}:${String(f.type || '')}`)
      .join('|')
  }, [schemaFields])

  const [rows, setRows] = React.useState<SchemaFieldRow[]>(() => normalizeSchemaFieldRows(schemaFields || []))
  const dirtyRef = React.useRef(false)
  const focusedPrevIdByRowRef = React.useRef<Map<number, string>>(new Map())
  const lastAppliedSigRef = React.useRef(schemaSig)

  React.useEffect(() => {
    if (lastAppliedSigRef.current === schemaSig) return
    lastAppliedSigRef.current = schemaSig
    if (dirtyRef.current) return
    setRows(normalizeSchemaFieldRows(schemaFields || []))
  }, [schemaFields, schemaSig])

  const commitRows = React.useCallback(
    (nextRows: SchemaFieldRow[]) => {
      dirtyRef.current = false
      setRows(nextRows)
      onCommitSchemaFields(buildSchemaFieldsValue(nextRows))
    },
    [onCommitSchemaFields],
  )

  const commitRenameAtIndex = React.useCallback(
    (rowIndex: number) => {
      const prevId = focusedPrevIdByRowRef.current.get(rowIndex) || ''
      const next = rows[rowIndex]
      if (!next) return
      const nextTitle = String(next.title || '').trim()
      if (!nextTitle) {
        if (!prevId) return
        const nextRows = patchAtIndex(rows, rowIndex, r => ({ ...r, id: prevId, title: prevId }))
        commitRows(nextRows)
        return
      }
      if (rows.some((r, idx) => idx !== rowIndex && String(r.id || '').trim() === nextTitle)) {
        const rollback = prevId || String(next.id || '').trim()
        if (!rollback) return
        const nextRows = patchAtIndex(rows, rowIndex, r => ({ ...r, id: rollback, title: rollback }))
        commitRows(nextRows)
        return
      }

      const nextId = nextTitle
      if (prevId && prevId !== nextId) onRenameSchemaFieldId?.({ prevId, nextId })
      if (String(next.id || '').trim() === nextId) return
      const nextRows = patchAtIndex(rows, rowIndex, r => ({ ...r, id: nextId, title: nextId }))
      commitRows(nextRows)
    },
    [commitRows, onRenameSchemaFieldId, rows],
  )

  const addField = React.useCallback(() => {
    const used = new Set(rows.map(r => String(r.id || '').trim()).filter(Boolean))
    let idx = rows.length + 1
    let nextId = `column_${idx}`
    while (used.has(nextId)) {
      idx += 1
      nextId = `column_${idx}`
    }
    commitRows([...rows, { id: nextId, title: nextId, type: '' }])
  }, [commitRows, rows])

  const removeField = React.useCallback(
    (rowIndex: number) => {
      const next = rows.filter((_, idx) => idx !== rowIndex)
      commitRows(next)
    },
    [commitRows, rows],
  )

  return (
    <section className="-mx-3" aria-label={UI_LABELS.flowNodeQuickEditorSchemaFieldsLegend}>
      <table className="w-full border-collapse" aria-label={UI_LABELS.flowNodeQuickEditorSchemaFieldsLegend}>
        <caption className={cn('sr-only', microLabelClass)}>{UI_LABELS.flowNodeQuickEditorSchemaFieldsLegend}</caption>
        <tbody>
          {rows.map((row, rowIndex) => {
            const fieldId = String(row.id || '').trim()
            const portKey = buildSchemaFieldPortKey(fieldId)
            const title = String(row.title || fieldId)
            const inAria = formatFlowHandleKeyValue({ dir: 'in', portKey }) || `Input port: ${title}`
            const outAria = formatFlowHandleKeyValue({ dir: 'out', portKey }) || `Output port: ${title}`
            const dotR = Math.max(1, dotSizePx / 2)

            return (
              <tr
                key={`${fieldId || 'field'}:${rowIndex}`}
                className={cn('relative border-t', UI_THEME_TOKENS.table.cellBorder, UI_THEME_TOKENS.table.rowHover)}
              >
                <td className="py-2">
                  <section className="relative px-3">
                    <button
                      type="button"
                      aria-label={inAria}
                      title={inAria}
                      data-kg-port-handle="1"
                      data-kg-port-handle-kind="dot"
                      data-kg-port-dir="in"
                      data-kg-port-key={portKey}
                      data-kg-port-path={readFlowHandlePath('in')}
                      className={cn('absolute top-1/2 left-0', UI_THEME_TOKENS.button.text)}
                      style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(0, -50%)' }}
                      onPointerDown={e => {
                        try {
                          e.stopPropagation()
                        } catch {
                          void 0
                        }
                      }}
                      onClick={e => {
                        try {
                          e.stopPropagation()
                        } catch {
                          void 0
                        }
                        if (!active || !portHandlesEnabled) return
                        onSchemaPortHandleClick?.({ dir: 'in', portKey })
                      }}
                      disabled={!active || !portHandlesEnabled}
                    >
                      <span
                        aria-hidden={true}
                        className={cn(
                          'absolute top-1/2 left-1/2 rounded-full border',
                          UI_THEME_TOKENS.panel.bg,
                          PORT_HANDLE_STROKE_CLASS,
                        )}
                        style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, left: `${dotR}px`, transform: 'translate(-50%, -50%)' }}
                      />
                    </button>

                    <input
                      className={cn(
                        'w-full h-8 rounded-md px-2',
                        keyValueInputClass,
                        textSizeClass,
                        'text-left',
                        UI_THEME_TOKENS.input.bg,
                        UI_THEME_TOKENS.input.border,
                        UI_THEME_TOKENS.input.text,
                      )}
                      value={row.title}
                      onFocus={() => {
                        focusedPrevIdByRowRef.current.set(rowIndex, fieldId)
                      }}
                      onChange={e => {
                        dirtyRef.current = true
                        const nextValue = e.target.value
                        setRows(prev => patchAtIndex(prev, rowIndex, r => ({ ...r, title: nextValue })))
                      }}
                      onBlur={() => {
                        commitRenameAtIndex(rowIndex)
                      }}
                      disabled={!active}
                    />

                    <button
                      type="button"
                      aria-label={outAria}
                      title={outAria}
                      data-kg-port-handle="1"
                      data-kg-port-handle-kind="dot"
                      data-kg-port-dir="out"
                      data-kg-port-key={portKey}
                      data-kg-port-path={readFlowHandlePath('out')}
                      className={cn('absolute top-1/2 right-0', UI_THEME_TOKENS.button.text)}
                      style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px`, transform: 'translate(0, -50%)' }}
                      onPointerDown={e => {
                        try {
                          e.stopPropagation()
                        } catch {
                          void 0
                        }
                      }}
                      onClick={e => {
                        try {
                          e.stopPropagation()
                        } catch {
                          void 0
                        }
                        if (!active || !portHandlesEnabled) return
                        onSchemaPortHandleClick?.({ dir: 'out', portKey })
                      }}
                      disabled={!active || !portHandlesEnabled}
                    >
                      <span
                        aria-hidden={true}
                        className={cn(
                          'absolute top-1/2 left-1/2 rounded-full border',
                          UI_THEME_TOKENS.panel.bg,
                          PORT_HANDLE_STROKE_CLASS,
                        )}
                        style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, left: `calc(100% - ${dotR}px)`, transform: 'translate(-50%, -50%)' }}
                      />
                    </button>
                  </section>

                  <p className={cn('mt-1 pl-1', microLabelClass, UI_THEME_TOKENS.text.secondary)}>{portKey}</p>
                </td>

                <td className="py-2">
                  <input
                    className={cn(
                      'w-full h-8 rounded-md px-2',
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={row.type}
                    onChange={e => {
                      dirtyRef.current = true
                      const nextValue = e.target.value
                        setRows(prev => patchAtIndex(prev, rowIndex, r => ({ ...r, type: nextValue })))
                    }}
                    onBlur={() => {
                      const nextType = String(rows[rowIndex]?.type || '').trim()
                      if (nextType === String(schemaFields[rowIndex]?.type || '').trim()) {
                        dirtyRef.current = false
                        return
                      }
                      commitRows(rows.map((r, idx) => (idx === rowIndex ? { ...r, type: nextType } : r)))
                    }}
                    disabled={!active}
                  />
                </td>

                <td className="py-2 text-right align-top pr-3">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center justify-center rounded-md border',
                      UI_THEME_TOKENS.panel.border,
                      UI_THEME_TOKENS.button.hoverBg,
                      UI_THEME_TOKENS.button.text,
                    )}
                    style={{ width: '32px', height: '32px' }}
                    title={UI_LABELS.flowNodeQuickEditorSchemaRemoveField}
                    aria-label={UI_LABELS.flowNodeQuickEditorSchemaRemoveField}
                    onClick={() => removeField(rowIndex)}
                    disabled={!active}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden={true} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <section className="flex items-center justify-end gap-2 px-3 py-2" aria-label={UI_LABELS.flowNodeQuickEditorSchemaActionsLabel}>
        <button
          type="button"
          className={cn(
            'rounded-lg border px-3 py-2 font-semibold disabled:opacity-50',
            UI_THEME_TOKENS.panel.border,
            UI_THEME_TOKENS.button.hoverBg,
            UI_THEME_TOKENS.button.text,
          )}
          onClick={addField}
          disabled={!active}
        >
          {UI_LABELS.flowNodeQuickEditorSchemaAddField}
        </button>
      </section>
    </section>
  )
})
