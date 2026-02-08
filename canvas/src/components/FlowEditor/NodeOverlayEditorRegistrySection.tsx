import React from 'react'

import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { getObjectPath, setObjectPath } from '@/lib/data/objectPath'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

function formatConnectedValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function coerceValueForFieldType(args: { fieldType: string; value: unknown }): unknown {
  const ft = String(args.fieldType || '').trim().toLowerCase()
  const v = args.value
  if (ft === 'boolean' || ft === 'bool') return typeof v === 'boolean' ? v : Boolean(v)
  if (ft === 'number' || ft === 'int' || ft === 'integer' || ft === 'float') {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number.parseFloat(v)
      return Number.isFinite(n) ? n : undefined
    }
    return undefined
  }
  if (ft === 'json') return v
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function isEmptyFieldValue(args: { fieldType: string; value: unknown }): boolean {
  const ft = String(args.fieldType || '').trim().toLowerCase()
  const v = args.value
  if (typeof v === 'undefined' || v === null) return true
  if (ft === 'boolean' || ft === 'bool') return false
  if (ft === 'number' || ft === 'int' || ft === 'integer' || ft === 'float') return false
  if (typeof v === 'string') return v.trim().length === 0
  return false
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object' || a === null || b === null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export const NodeOverlayEditorRegistrySection = React.memo(function NodeOverlayEditorRegistrySection(props: {
  active: boolean
  properties: Record<string, unknown>
  registryEntry: NodeQuickEditorRegistryEntry
  microLabelClass: string
  monospaceTextClass: string
  textSizeClass: string
  keyValueInputClass: string
  keyLabelClass: string
  normalizeRegistrySchemaPath: (schemaPath: string | undefined, fallbackKey: string) => string
  ids: { registryField: (fieldKey: string) => string }
  dotSizePx: number
  dotHitPx: number
  portHandlesEnabled: boolean
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  onSetProperties: (properties: Record<string, unknown>) => void
  onSchemaPortHandleClick?: (args: { dir: 'in' | 'out'; portKey: string }) => void
}) {
  const {
    active,
    properties,
    registryEntry,
    microLabelClass,
    monospaceTextClass,
    textSizeClass,
    keyValueInputClass,
    keyLabelClass,
    normalizeRegistrySchemaPath,
    ids,
    dotSizePx,
    dotHitPx,
    portHandlesEnabled,
    connectedValuesBySchemaPath,
    onSetProperties,
    onSchemaPortHandleClick,
  } = props

  const registryFields = (registryEntry?.fields || []).filter(
    f => (f as { isHidden?: boolean }).isHidden !== true,
  )
  const registryPorts = (registryEntry?.ports || []).filter(
    p => (p as { isHidden?: boolean }).isHidden !== true,
  )

  const rows: NodeOverlayEditorKvRow[] = []

  const [autoApplyConnected, setAutoApplyConnected] = React.useState(false)

  const applyConnectedToEmptyFields = React.useCallback(() => {
    if (!active) return
    if (!connectedValuesBySchemaPath) return
    let nextRoot: { properties: Record<string, unknown> } = { properties }
    let changed = false

    for (let idx = 0; idx < registryFields.length; idx += 1) {
      const f = registryFields[idx]
      const path = normalizeRegistrySchemaPath(f.schemaPath, f.fieldKey)
      if (!path) continue
      const connected = connectedValuesBySchemaPath[path]
      if (!connected) continue
      const fieldType = String(f.fieldType || '').trim().toLowerCase()
      const cur = getObjectPath(nextRoot, path)
      if (!isEmptyFieldValue({ fieldType, value: cur })) continue
      const nextValue = coerceValueForFieldType({ fieldType, value: connected.value })
      if (typeof nextValue === 'undefined') continue
      if (valuesEqual(cur, nextValue)) continue
      nextRoot = setObjectPath(nextRoot, path, nextValue) as { properties: Record<string, unknown> }
      changed = true
    }

    if (!changed) return
    onSetProperties(nextRoot.properties || {})
  }, [active, connectedValuesBySchemaPath, normalizeRegistrySchemaPath, onSetProperties, properties, registryFields])

  React.useEffect(() => {
    if (!autoApplyConnected) return
    applyConnectedToEmptyFields()
  }, [applyConnectedToEmptyFields, autoApplyConnected, connectedValuesBySchemaPath])

  for (let idx = 0; idx < registryFields.length; idx += 1) {
    const f = registryFields[idx]
    const rowKey = `${String(f.fieldKey || '')}:${idx}`
    const path = normalizeRegistrySchemaPath(f.schemaPath, f.fieldKey)
    const cur = path ? getObjectPath({ properties }, path) : undefined
    const connected = path ? connectedValuesBySchemaPath?.[path] : undefined
    const label = String(f.label || f.fieldKey)
    const fieldType = String(f.fieldType || '').trim().toLowerCase()
    const id = ids.registryField(String(f.fieldKey || idx))
    const labelId = `registry-field-${String(f.fieldKey || idx)}-${idx}`

    const setValue = (nextValue: unknown) => {
      if (!path) return
      const nextRoot = setObjectPath({ properties }, path, nextValue)
      const nextProps = (nextRoot as { properties?: Record<string, unknown> }).properties || {}
      onSetProperties(nextProps)
    }

    const keyNode = (
      <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={id}>
        {label}
      </label>
    )

    const typeNode = <NodeOverlayEditorTypePill text={fieldType || 'text'} />

    const connectedValueText = connected ? formatConnectedValue(connected.value) : ''
    const connectedMeta = connectedValueText
      ? (
          <section className={cn('mt-1 flex items-center justify-between gap-2', microLabelClass)} aria-label={UI_COPY.flowNodeQuickEditorConnectedValueLabel}>
            <p className={cn('min-w-0 truncate', UI_THEME_TOKENS.text.tertiary)}>{UI_COPY.flowNodeQuickEditorConnectedValuePrefix}{connectedValueText}</p>
            <button
              type="button"
              className={cn('shrink-0 rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
              onClick={() => setValue(coerceValueForFieldType({ fieldType, value: connected.value }))}
              disabled={!active}
              aria-label={UI_COPY.flowNodeQuickEditorApplyConnectedValueLabel}
              title={UI_COPY.flowNodeQuickEditorApplyConnectedValueLabel}
            >
              {UI_LABELS.apply}
            </button>
          </section>
        )
      : null

    if (fieldType === 'boolean' || fieldType === 'bool') {
      const checked = typeof cur === 'boolean' ? cur : false
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <section className="flex items-center">
              <input id={id} type="checkbox" checked={checked} onChange={e => setValue(e.target.checked)} disabled={!active} />
            </section>
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    if (fieldType === 'number' || fieldType === 'int' || fieldType === 'integer' || fieldType === 'float') {
      const v = typeof cur === 'number' && Number.isFinite(cur) ? String(cur) : ''
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <input
              id={id}
              type="number"
              className={cn(
                keyValueInputClass,
                textSizeClass,
                'text-left',
                UI_THEME_TOKENS.input.bg,
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.input.text,
              )}
              value={v}
              placeholder={!v && connectedValueText ? connectedValueText : undefined}
              onChange={e => {
                const raw = e.target.value
                if (!raw.trim()) {
                  setValue(undefined)
                  return
                }
                const num = Number.parseFloat(raw)
                setValue(Number.isFinite(num) ? num : undefined)
              }}
              disabled={!active}
            />
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    if (fieldType === 'json') {
      const v = typeof cur === 'string' ? cur : typeof cur === 'undefined' ? '' : JSON.stringify(cur)
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <textarea
              id={id}
              className={cn(
                'w-full h-24 px-2 py-1 rounded-md border',
                monospaceTextClass,
                UI_THEME_TOKENS.input.bg,
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.input.text,
              )}
              value={v}
              placeholder={!v && connectedValueText ? connectedValueText : undefined}
              onChange={e => setValue(e.target.value || undefined)}
              disabled={!active}
            />
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    const v = typeof cur === 'string' ? cur : typeof cur === 'number' ? String(cur) : ''
    rows.push({
      rowKey,
      labelId,
      keyNode,
      typeNode,
      valueNode: (
        <section className="w-full">
          <input
            id={id}
            className={cn(
              keyValueInputClass,
              textSizeClass,
              'text-left',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            value={v}
            placeholder={!v && connectedValueText ? connectedValueText : undefined}
            onChange={e => {
              const raw = e.target.value
              setValue(raw.trim() ? raw : undefined)
            }}
            disabled={!active}
          />
          {connectedMeta}
        </section>
      ),
    })
  }

  const portRows: NodeOverlayEditorKvRow[] = React.useMemo(() => {
    const out: NodeOverlayEditorKvRow[] = []
    for (let idx = 0; idx < registryPorts.length; idx += 1) {
      const p = registryPorts[idx]
      const portKey = String(p.portKey || '').trim()
      if (!portKey) continue
      const isIn = p.direction === 'input'
      const aria = `${isIn ? 'Input' : 'Output'} port: ${portKey}`

      const portButton = (
        <button
          type="button"
          aria-label={aria}
          title={aria}
          className={cn('relative', UI_THEME_TOKENS.button.text)}
          style={{ width: `${dotHitPx}px`, height: `${dotHitPx}px` }}
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
            onSchemaPortHandleClick?.({ dir: isIn ? 'in' : 'out', portKey })
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
            style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }}
          />
        </button>
      )

      out.push({
        rowKey: `port:${p.direction}:${portKey}:${idx}`,
        labelId: `registry-port-${p.direction}-${portKey}-${idx}`,
        inPortNode: isIn ? portButton : null,
        outPortNode: !isIn ? portButton : null,
        keyNode: <span className={cn('min-w-0 truncate', UI_THEME_TOKENS.text.primary)}>{portKey}</span>,
        typeNode: <NodeOverlayEditorTypePill text={isIn ? 'in' : 'out'} />,
        valueNode: <span aria-hidden={true} />,
      })
    }
    return out
  }, [active, dotHitPx, dotSizePx, onSchemaPortHandleClick, portHandlesEnabled, registryPorts])

  if (!registryEntry) return null
  if (registryFields.length === 0 && portRows.length === 0) return null

  const hasAnyConnectedValues = !!connectedValuesBySchemaPath && Object.keys(connectedValuesBySchemaPath).length > 0

  return (
    <section className="min-w-0 mt-4" aria-label="Node Quick Editor Registry">

      {hasAnyConnectedValues && registryFields.length > 0 ? (
        <section className={cn('flex flex-wrap items-center justify-between gap-2 mb-2', microLabelClass)} aria-label={UI_COPY.flowNodeQuickEditorConnectedControlsLabel}>
          <label className={cn('inline-flex items-center gap-2', UI_THEME_TOKENS.text.secondary)}>
            <input
              type="checkbox"
              checked={autoApplyConnected}
              onChange={e => setAutoApplyConnected(e.target.checked)}
              disabled={!active}
            />
            {UI_COPY.flowNodeQuickEditorAutoApplyConnectedValuesLabel}
          </label>
          <button
            type="button"
            className={cn('shrink-0 rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
            onClick={applyConnectedToEmptyFields}
            disabled={!active}
            aria-label={UI_COPY.flowNodeQuickEditorApplyConnectedValuesToEmptyFieldsLabel}
            title={UI_COPY.flowNodeQuickEditorApplyConnectedValuesToEmptyFieldsLabel}
          >
            {UI_LABELS.apply}
            {' '}
            {UI_COPY.flowNodeQuickEditorApplyAllSuffix}
          </button>
        </section>
      ) : null}

      {rows.length > 0 && (
        <NodeOverlayEditorKvTable
          ariaLabel="Registry fields"
          microLabelClass={microLabelClass}
          rows={rows}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
        />
      )}

      {portRows.length > 0 && (
        <NodeOverlayEditorKvTable
          ariaLabel="Registry ports"
          microLabelClass={microLabelClass}
          rows={portRows}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
        />
      )}
    </section>
  )
})
