import React from 'react'

import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import type { WidgetRegistryEntry, WidgetRegistryFieldOption } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { getObjectPath, setObjectPath } from '@/lib/data/objectPath'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { formatFlowHandleKeyValue, readFlowHandlePath, readFlowHandleTypeLabel } from '@/lib/graph/flowHandlePresentation'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import {
  inferTextGenerationProviderFamily,
  resolveEffectiveTextGenerationWidgetProperties,
} from '@/features/flow-editor-manager/registryTemplates'
import {
  getBytePlusChatApiRowAnchorId,
  resolveBytePlusTextWidgetChatApiRowKey,
} from '@/features/panels/views/byteplusChatApiDocs'
import {
  resolveOpenAiTextWidgetChatApiRowKey,
} from '@/features/integrations/openaiResponsesSsot'
import { getOpenAiChatApiRowAnchorId } from '@/features/panels/views/openaiChatApiDocs'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'

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

function normalizeJsonLikeValueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'undefined') return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const JsonLikeValueEditor = React.memo(function JsonLikeValueEditor(props: {
  id: string
  value: unknown
  active: boolean
  placeholder?: string
  className: string
  mode: 'json' | 'object'
  onCommit: (nextValue: unknown) => void
}) {
  const normalize = React.useCallback((v: unknown) => normalizeJsonLikeValueText(v), [])
  const lastNormalizedRef = React.useRef<string>(normalize(props.value))
  const [text, setText] = React.useState(() => lastNormalizedRef.current)

  React.useEffect(() => {
    const nextNormalized = normalize(props.value)
    if (text === lastNormalizedRef.current) {
      setText(nextNormalized)
    }
    lastNormalizedRef.current = nextNormalized
  }, [normalize, props.value, text])

  return (
    <PlainTextInputEditor
      id={props.id}
      className={props.className}
      multiline
      value={text}
      placeholder={props.placeholder}
      onChange={next => setText(next)}
      onBlur={() => {
        if (!props.active) return
        const raw = String(text || '')
        if (!raw.trim()) {
          props.onCommit(undefined)
          return
        }
        if (props.mode === 'json') {
          props.onCommit(raw)
          return
        }
        try {
          const parsed = JSON.parse(raw)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setText(lastNormalizedRef.current)
            return
          }
          props.onCommit(parsed)
        } catch {
          setText(lastNormalizedRef.current)
        }
      }}
      disabled={!props.active}
    />
  )
})

export const NodeOverlayEditorRegistrySection = React.memo(function NodeOverlayEditorRegistrySection(props: {
  active: boolean
  properties: Record<string, unknown>
  registryEntry: WidgetRegistryEntry
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
  showFieldRows?: boolean
  showPortRows?: boolean
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
    showFieldRows = true,
    showPortRows = true,
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
  const globalTextDefaults = useGraphStore(
    useShallow(s => ({
      chatProvider: s.chatProvider,
      chatAuthMode: s.chatAuthMode,
      chatEndpointUrl: s.chatEndpointUrl,
      chatModel: s.chatModel,
      chatTemperature: s.chatTemperature,
      chatMaxCompletionTokens: s.chatMaxCompletionTokens,
      chatServiceTier: s.chatServiceTier,
      chatStream: s.chatStream,
      chatMessagesJson: s.chatMessagesJson,
      chatReasoningEffort: s.chatReasoningEffort,
      chatThinkingType: s.chatThinkingType,
      chatThinkingJson: s.chatThinkingJson,
      chatFrequencyPenalty: s.chatFrequencyPenalty,
      chatPresencePenalty: s.chatPresencePenalty,
      chatTopP: s.chatTopP,
      chatLogprobs: s.chatLogprobs,
      chatTopLogprobs: s.chatTopLogprobs,
      chatParallelToolCalls: s.chatParallelToolCalls,
      chatStopJson: s.chatStopJson,
      chatStreamOptionsJson: s.chatStreamOptionsJson,
      chatResponseFormatJson: s.chatResponseFormatJson,
      chatLogitBiasJson: s.chatLogitBiasJson,
      chatToolsJson: s.chatToolsJson,
      chatToolChoiceJson: s.chatToolChoiceJson,
    })),
  )

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

  const openIntegrationLink = React.useCallback((args: { searchQuery: string; anchorId: string }) => {
    const normalizedSearchQuery = String(args.searchQuery || '').trim()
    const normalizedAnchorId = String(args.anchorId || '').trim()
    if (!normalizedSearchQuery || !normalizedAnchorId || typeof window === 'undefined') return
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(new CustomEventCtor(MAIN_PANEL_OPEN_EVENT, {
      detail: {
        tab: 'integrations' as const,
        searchQuery: normalizedSearchQuery,
        anchorId: normalizedAnchorId,
      },
    }))
  }, [])

  const openBytePlusIntegrationLink = React.useCallback((searchQuery: string) => {
    const normalizedSearchQuery = String(searchQuery || '').trim()
    if (!normalizedSearchQuery) return
    openIntegrationLink({
      searchQuery: normalizedSearchQuery,
      anchorId: getBytePlusChatApiRowAnchorId(normalizedSearchQuery),
    })
  }, [openIntegrationLink])

  const openOpenAiIntegrationLink = React.useCallback((searchQuery: string) => {
    const normalizedSearchQuery = String(searchQuery || '').trim()
    if (!normalizedSearchQuery) return
    openIntegrationLink({
      searchQuery: normalizedSearchQuery,
      anchorId: getOpenAiChatApiRowAnchorId(normalizedSearchQuery),
    })
  }, [openIntegrationLink])

  const canLinkToBytePlusChatApi = React.useMemo(() => {
    if (String(registryEntry.nodeTypeId || '').trim() !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) return false
    return inferTextGenerationProviderFamily({
      provider: properties.chatProvider,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    }) === 'byteplus'
  }, [properties.chatProvider, registryEntry.formId, registryEntry.nodeTypeId, registryEntry.widgetTypeId])

  const canLinkToOpenAiChatApi = React.useMemo(() => {
    if (String(registryEntry.nodeTypeId || '').trim() !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) return false
    return inferTextGenerationProviderFamily({
      provider: properties.chatProvider,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    }) === 'openai'
  }, [properties.chatProvider, registryEntry.formId, registryEntry.nodeTypeId, registryEntry.widgetTypeId])
  const effectiveProperties = React.useMemo(() => {
    if (String(registryEntry.nodeTypeId || '').trim() !== FLOW_TEXT_GENERATION_NODE_TYPE_ID) return properties
    const providerFamily = inferTextGenerationProviderFamily({
      provider: properties.chatProvider,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    })
    return resolveEffectiveTextGenerationWidgetProperties({
      providerFamily,
      localProperties: properties,
      globalProperties: globalTextDefaults,
    })
  }, [globalTextDefaults, properties, registryEntry.formId, registryEntry.nodeTypeId, registryEntry.widgetTypeId])

  React.useEffect(() => {
    if (!autoApplyConnected) return
    applyConnectedToEmptyFields()
  }, [applyConnectedToEmptyFields, autoApplyConnected, connectedValuesBySchemaPath])

  for (let idx = 0; idx < registryFields.length; idx += 1) {
    const f = registryFields[idx]
    const rowKey = `${String(f.fieldKey || '')}:${idx}`
    const path = normalizeRegistrySchemaPath(f.schemaPath, f.fieldKey)
    const cur = path ? getObjectPath({ properties }, path) : undefined
    const effectiveCur = path ? getObjectPath({ properties: effectiveProperties }, path) : undefined
    const connected = path ? connectedValuesBySchemaPath?.[path] : undefined
    const label = String(f.label || f.fieldKey)
    const fieldType = String(f.fieldType || '').trim().toLowerCase()
    const fieldOptions = Array.isArray((f as { options?: WidgetRegistryFieldOption[] }).options)
      ? ((f as { options?: WidgetRegistryFieldOption[] }).options || [])
      : []
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
          <section
            className={cn(
              'mt-1 flex items-center justify-between gap-2',
              microLabelClass,
            )}
            aria-label={UI_COPY.flowWidgetConnectedValueLabel}
          >
            <p className={cn('min-w-0 truncate', UI_THEME_TOKENS.text.tertiary)}>{UI_COPY.flowWidgetConnectedValuePrefix}{connectedValueText}</p>
            <button
              type="button"
              className={cn('shrink-0 rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
              onClick={() => setValue(coerceValueForFieldType({ fieldType, value: connected.value }))}
              disabled={!active}
              aria-label={UI_COPY.flowWidgetApplyConnectedValueLabel}
              title={UI_COPY.flowWidgetApplyConnectedValueLabel}
            >
              {UI_LABELS.apply}
            </button>
          </section>
        )
      : null

    if (fieldType === 'boolean' || fieldType === 'bool') {
      const checked = typeof cur === 'boolean' ? cur : false
      const effectiveChecked = typeof effectiveCur === 'boolean' ? effectiveCur : checked
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <section className="flex items-center">
              <input id={id} type="checkbox" checked={effectiveChecked} onChange={e => setValue(e.target.checked)} disabled={!active} />
            </section>
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    if (fieldType === 'select') {
      const effectiveValue = typeof effectiveCur === 'number' && Number.isFinite(effectiveCur)
        ? String(effectiveCur)
        : String(effectiveCur ?? '').trim()
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <select
              id={id}
              className={cn(
                keyValueInputClass,
                textSizeClass,
                'text-left',
                UI_THEME_TOKENS.input.bg,
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.input.text,
              )}
              value={effectiveValue}
              onChange={e => {
                const raw = String(e.target.value || '').trim()
                if (!raw) {
                  setValue(undefined)
                  return
                }
                const matchedOption = fieldOptions.find(option => String(option?.value ?? '').trim() === raw)
                setValue(matchedOption ? matchedOption.value : raw)
              }}
              disabled={!active}
            >
              <option value="">Select…</option>
              {fieldOptions.map(option => {
                const optionValue = String(option?.value ?? '').trim()
                if (!optionValue) return null
                return (
                  <option key={optionValue} value={optionValue}>
                    {String(option?.label || optionValue)}
                  </option>
                )
              })}
            </select>
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    if (fieldType === 'number' || fieldType === 'int' || fieldType === 'integer' || fieldType === 'float') {
      const v = typeof effectiveCur === 'number' && Number.isFinite(effectiveCur) ? String(effectiveCur) : ''
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

    if (fieldType === 'json' || fieldType === 'object') {
      const mode = fieldType === 'object' ? 'object' : 'json'
      const v = normalizeJsonLikeValueText(effectiveCur)
      rows.push({
        rowKey,
        labelId,
        keyNode,
        typeNode,
        valueNode: (
          <section className="w-full">
            <JsonLikeValueEditor
              id={id}
              mode={mode}
              value={effectiveCur}
              active={active}
              placeholder={!v && connectedValueText ? connectedValueText : undefined}
              className={cn(
                'w-full h-24 px-2 py-1 rounded-md border',
                monospaceTextClass,
                UI_THEME_TOKENS.input.bg,
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.input.text,
              )}
              onCommit={next => setValue(next)}
            />
            {connectedMeta}
          </section>
        ),
      })
      continue
    }

    const v = typeof effectiveCur === 'string' ? effectiveCur : typeof effectiveCur === 'number' ? String(effectiveCur) : ''
    rows.push({
      rowKey,
      labelId,
      keyNode,
      typeNode,
      valueNode: (
        <section className="w-full">
          <PlainTextInputEditor
            id={id}
            className={cn(
              keyValueInputClass,
              textSizeClass,
              'text-left',
              fieldType === 'textarea' ? 'h-24 px-2 py-1' : '',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
            multiline={fieldType === 'textarea'}
            rows={fieldType === 'textarea' ? 4 : undefined}
            value={v}
            placeholder={!v && connectedValueText ? connectedValueText : undefined}
            onChange={raw => {
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
      const portValueId = ids.registryField(`port-${p.direction}-${portKey}`)
      const handlePath = readFlowHandlePath(isIn ? 'in' : 'out')
      const handleType = readFlowHandleTypeLabel(isIn ? 'in' : 'out')
      const handlePathValue = formatFlowHandleKeyValue({ dir: isIn ? 'in' : 'out', portKey })
      const aria = handlePathValue
      const bytePlusPortLinkSearch = canLinkToBytePlusChatApi
        ? resolveBytePlusTextWidgetChatApiRowKey({
            schemaPath: String(p.schemaPath || '').trim(),
            portKey,
          })
        : null
      const openAiPortLinkSearch = canLinkToOpenAiChatApi
        ? resolveOpenAiTextWidgetChatApiRowKey({
            schemaPath: String(p.schemaPath || '').trim(),
            portKey,
          })
        : null
      const handlePortNavigate = bytePlusPortLinkSearch
        ? () => openBytePlusIntegrationLink(bytePlusPortLinkSearch)
        : openAiPortLinkSearch
          ? () => openOpenAiIntegrationLink(openAiPortLinkSearch)
          : undefined

      const portButton = (
        <button
          type="button"
          aria-label={aria}
          title={aria}
          data-kg-port-handle="1"
          data-kg-port-handle-kind="dot"
          data-kg-port-dir={isIn ? 'in' : 'out'}
          data-kg-port-key={portKey}
          data-kg-port-path={handlePath}
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
            if (handlePortNavigate) {
              handlePortNavigate()
              return
            }
            if (!active || !portHandlesEnabled) return
            onSchemaPortHandleClick?.({ dir: isIn ? 'in' : 'out', portKey })
          }}
          disabled={handlePortNavigate ? false : (!active || !portHandlesEnabled)}
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
        onInPortClick: handlePortNavigate,
        onKeyClick: handlePortNavigate,
        onTypeClick: handlePortNavigate,
        onValueClick: handlePortNavigate,
        onOutPortClick: handlePortNavigate,
        inPortNode: isIn ? portButton : null,
        outPortNode: !isIn ? portButton : null,
        keyNode: (
          <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={portValueId}>
            {handlePath}
          </label>
        ),
        typeNode: <NodeOverlayEditorTypePill text={handleType} />,
        valueNode: (
          <PlainTextInputEditor
            id={portValueId}
            ariaLabel={aria}
            value={portKey}
            disabled
            readOnly
            className={cn(
              keyValueInputClass,
              textSizeClass,
              'text-left',
              monospaceTextClass,
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
              UI_THEME_TOKENS.input.text,
            )}
          />
        ),
      })
    }
    return out
  }, [active, canLinkToBytePlusChatApi, canLinkToOpenAiChatApi, dotHitPx, dotSizePx, ids, keyLabelClass, keyValueInputClass, monospaceTextClass, onSchemaPortHandleClick, openBytePlusIntegrationLink, openOpenAiIntegrationLink, portHandlesEnabled, registryPorts, textSizeClass])

  if (!registryEntry) return null
  const visibleFieldRows = showFieldRows ? rows : []
  const visiblePortRows = showPortRows ? portRows : []
  if (visibleFieldRows.length === 0 && visiblePortRows.length === 0) return null

  const hasAnyConnectedValues = !!connectedValuesBySchemaPath && Object.keys(connectedValuesBySchemaPath).length > 0

  return (
    <section className="min-w-0 mt-4" aria-label="Widget Registry">

      {hasAnyConnectedValues && visibleFieldRows.length > 0 ? (
        <section className={cn('flex flex-wrap items-center justify-between gap-2 mb-2', microLabelClass)} aria-label={UI_COPY.flowWidgetConnectedControlsLabel}>
          <label className={cn('inline-flex items-center gap-2', UI_THEME_TOKENS.text.secondary)}>
            <input
              type="checkbox"
              checked={autoApplyConnected}
              onChange={e => setAutoApplyConnected(e.target.checked)}
              disabled={!active}
            />
            {UI_COPY.flowWidgetAutoApplyConnectedValuesLabel}
          </label>
          <button
            type="button"
            className={cn('shrink-0 rounded border px-2 py-1', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.button.text)}
            onClick={applyConnectedToEmptyFields}
            disabled={!active}
            aria-label={UI_COPY.flowWidgetApplyConnectedValuesToEmptyFieldsLabel}
            title={UI_COPY.flowWidgetApplyConnectedValuesToEmptyFieldsLabel}
          >
            {UI_LABELS.apply}
            {' '}
            {UI_COPY.flowWidgetApplyAllSuffix}
          </button>
        </section>
      ) : null}

      {visibleFieldRows.length > 0 && (
        <NodeOverlayEditorKvTable
          ariaLabel="Registry fields"
          microLabelClass={microLabelClass}
          rows={visibleFieldRows}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
        />
      )}

      {showPortRows && (!(canLinkToBytePlusChatApi || canLinkToOpenAiChatApi) || showFieldRows === false) && visiblePortRows.length > 0 && (
        <NodeOverlayEditorKvTable
          ariaLabel="Registry ports"
          microLabelClass={microLabelClass}
          rows={visiblePortRows}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
        />
      )}
    </section>
  )
})
