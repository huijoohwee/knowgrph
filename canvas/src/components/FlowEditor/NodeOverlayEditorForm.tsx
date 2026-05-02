import React from 'react'

import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  UI_COPY,
  UI_LABELS,
} from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  FLOW_SCHEMA_FIELDS_PROPERTY_KEY,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import { readNodeProperties } from '@/lib/graph/nodeProperties'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_WIDGET_FORM_ID_KEY,
  FLOW_WIDGET_TYPE_ID_KEY,
  listScopedWidgetRegistryEntries,
  resolveFrontmatterWidgetRegistrySectionState,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import {
  buildFrontmatterWidgetContractModel,
  buildFrontmatterWidgetContractRowSpecs,
} from '@/features/flow-editor-manager/frontmatterWidgetContract'
import {
  applyWidgetCompactPreviewTextUpdate,
  buildWidgetCompactPreviewViewModel,
  resolveWidgetCompactPreview,
} from '@/features/flow-editor-manager/widgetCompactPreview'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import { formatFlowHandleKeyValue, readFlowHandlePath, readFlowHandleTypeLabel } from '@/lib/graph/flowHandlePresentation'
import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'
import { NodeOverlayEditorParamsSection } from '@/components/FlowEditor/NodeOverlayEditorParamsSection'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { NodeOverlayEditorBeatByBeatSection } from '@/components/FlowEditor/NodeOverlayEditorBeatByBeatSection'
import type { GraphEdge } from '@/lib/graph/types'
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function cleanDomIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

export const NodeOverlayEditorForm = React.memo(function NodeOverlayEditorForm({
  active,
  node,
  graphMetaKind,
  edges,
  schema,
  hideFields,
  labelInputRef,
  onSetLabel,
  onSetType,
  onPatchProperties,
  onSetProperties,
  onValidate,
  onSchemaPortHandleClick,
  onRenameSchemaFieldId,
  onRegistrySelectionChange,
  connectedValuesBySchemaPath,
  registryEntry = null,
  registryEntries = [],
}: {
  active: boolean
  node: GraphNode
  graphMetaKind?: string | null
  edges?: ReadonlyArray<GraphEdge>
  schema: GraphSchema | null
  hideFields: boolean
  labelInputRef: React.RefObject<HTMLInputElement>
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onSchemaPortHandleClick?: (args: { dir: 'in' | 'out'; portKey: string }) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
  onRegistrySelectionChange?: (args: { entry: WidgetRegistryEntry | null }) => void
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  registryEntry?: WidgetRegistryEntry | null
  registryEntries?: ReadonlyArray<WidgetRegistryEntry>
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass, keyLabelClass } = usePanelTypography()
  void onSetType
  void onValidate
  const properties = readNodeProperties(node)
  const nodeTypeId = pickString(node.type).trim()
  const isRichMediaPanelWidget = nodeTypeId === 'RichMediaPanel'
  const idBase = React.useMemo(() => {
    const nodeId = cleanDomIdPart(node.id) || 'node'
    return `flow-node-quick-${nodeId}`
  }, [node.id])

  const ids = React.useMemo(() => {
    return {
      label: `${idBase}-label`,
      registrySelect: `${idBase}-registry-select`,
      registryField: (fieldKey: string) => `${idBase}-registry-field-${cleanDomIdPart(fieldKey) || 'field'}`,
      paramsJson: `${idBase}-params-json`,
      paramsJsonInput: `${idBase}-params-json-input`,
      portHandle: (portKey: string, dir: 'in' | 'out') => `${idBase}-port-${dir}-${cleanDomIdPart(portKey) || 'port'}`,
    }
  }, [idBase])

  const schemaFields = React.useMemo(() => readSchemaFieldSpecs(node), [node])
  const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'
  const showRichMediaPanelKtvRows = isRichMediaPanelWidget && hideFields && !isFrontmatterFlow
  const portHandlesEnabled = Boolean(schema?.behavior?.portHandles?.enabled) || isFrontmatterFlow

  const flowEnvelopeValueBoxClass = React.useMemo(() => {
    return cn(
      keyValueInputClass,
      textSizeClass,
      'text-left',
      'h-24',
      monospaceTextClass,
      UI_THEME_TOKENS.input.bg,
      UI_THEME_TOKENS.input.border,
      UI_THEME_TOKENS.input.text,
    )
  }, [keyValueInputClass, monospaceTextClass, textSizeClass])
  const renderKvTypeBox = React.useCallback((value: string) => {
    const text = String(value || '').trim()
    if (!text) return null
    return <NodeOverlayEditorTypePill text={text} />
  }, [])
  const frontmatterContract = React.useMemo(() => {
    return buildFrontmatterWidgetContractModel({
      node,
      edges,
      registryEntry,
    })
  }, [edges, node, registryEntry])
  const flowCompute = frontmatterContract.flowCompute
  const frontmatterContractRowSpecs = React.useMemo(() => {
    return buildFrontmatterWidgetContractRowSpecs(frontmatterContract)
  }, [frontmatterContract])
  const flowDataJson = frontmatterContract.flowDataJson
  const lastFlowDataJsonRef = React.useRef(flowDataJson)
  const [flowDataDraft, setFlowDataDraft] = React.useState(flowDataJson)
  React.useEffect(() => {
    const prev = lastFlowDataJsonRef.current
    lastFlowDataJsonRef.current = flowDataJson
    setFlowDataDraft(cur => (cur === prev ? flowDataJson : cur))
  }, [flowDataJson])
  const { sizePx: dotSizePx, hitSizePx: dotHitPx } = React.useMemo(() => {
    const m = readPortHandleUiMetrics(schema)
    return { sizePx: Math.max(10, m.sizePx), hitSizePx: Math.max(18, m.hitSizePx + 2) }
  }, [schema])
  const renderFlowContractDot = React.useCallback((args: { dir: 'in' | 'out'; linked: boolean; portKey: string }) => {
    const safeDotSize = Math.max(6, Math.floor(dotSizePx))
    const safeHit = Math.max(safeDotSize, Math.floor(dotHitPx))
    const aria = args.linked
      ? `${args.dir === 'in' ? 'Input' : 'Output'} edge-linked handle`
      : `${args.dir === 'in' ? 'Input' : 'Output'} handle`
    return (
      <button
        type="button"
        aria-label={aria}
        title={aria}
        disabled
        tabIndex={-1}
        data-kg-port-handle="1"
        data-kg-port-handle-kind="dot"
        data-kg-port-dir={args.dir}
        data-kg-port-key={args.portKey}
        className={cn('relative block', UI_THEME_TOKENS.button.text, args.linked ? 'opacity-100' : 'opacity-50')}
        style={{ width: `${safeHit}px`, height: `${safeHit}px` }}
      >
        <span
          aria-hidden={true}
          className={cn(
            'absolute top-1/2 left-1/2 rounded-full',
            PORT_HANDLE_STROKE_CLASS,
            args.linked ? 'border-2' : 'border',
          )}
          style={{
            width: `${safeDotSize}px`,
            height: `${safeDotSize}px`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: args.linked ? 'var(--kg-canvas-accent)' : 'transparent',
          }}
        />
      </button>
    )
  }, [dotHitPx, dotSizePx])

  const frontmatterWidgetRegistrySection = React.useMemo(
    () => resolveFrontmatterWidgetRegistrySectionState({
      node,
      registryEntry,
      graphMetaKind,
    }),
    [graphMetaKind, node, registryEntry],
  )
  const showFrontmatterWidgetRegistrySection = frontmatterWidgetRegistrySection.visible
  const hideFrontmatterFlowContractRows = frontmatterWidgetRegistrySection.hideFlowContractRows
  const frontmatterWidgetIdentityLabel = frontmatterWidgetRegistrySection.identityLabel

  const registryOptions = React.useMemo(
    () => {
      return listScopedWidgetRegistryEntries({
        node,
        registry: registryEntries,
        graphMetaKind,
      })
    },
    [graphMetaKind, node, registryEntries],
  )
  const registrySelectionId = registryEntry?.id || ''
  const hasRegistryOptions = registryOptions.length > 0

  const registryOptionIdsSig = React.useMemo(() => {
    return (registryOptions || []).map(e => String(e.id || '')).join('|')
  }, [registryOptions])

  const registryOptionIdSet = React.useMemo(() => {
    const parts = String(registryOptionIdsSig || '').split('|').map(s => s.trim()).filter(Boolean)
    return new Set(parts)
  }, [registryOptionIdsSig])

  React.useEffect(() => {
    if (!active) return
    if (!registrySelectionId) return
    if (registryOptionIdSet.has(registrySelectionId)) return
    onPatchProperties({
      [FLOW_WIDGET_TYPE_ID_KEY]: undefined,
      [FLOW_WIDGET_FORM_ID_KEY]: undefined,
    })
    onRegistrySelectionChange?.({ entry: null })
  }, [active, onPatchProperties, onRegistrySelectionChange, registryOptionIdSet, registrySelectionId])
  const handleRegistrySelect = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextId = String(event.target.value || '').trim()
      if (nextId === registrySelectionId) return
      if (!nextId) {
        onPatchProperties({
          [FLOW_WIDGET_TYPE_ID_KEY]: undefined,
          [FLOW_WIDGET_FORM_ID_KEY]: undefined,
        })
        onRegistrySelectionChange?.({ entry: null })
        return
      }
      const nextEntry = registryOptions.find(entry => entry.id === nextId)
      if (!nextEntry) return
      onPatchProperties({
        [FLOW_WIDGET_TYPE_ID_KEY]: nextEntry.widgetTypeId,
        [FLOW_WIDGET_FORM_ID_KEY]: nextEntry.formId,
      })
      onRegistrySelectionChange?.({ entry: nextEntry })
    },
    [onPatchProperties, onRegistrySelectionChange, registryOptions, registrySelectionId],
  )
  const emitInteractionFrame = React.useCallback(() => {
    emitFlowEditorInteractionFrame()
  }, [])

  const compactPreview = React.useMemo(() => {
    if (!hideFields || isRichMediaPanelWidget) return null
    return resolveWidgetCompactPreview({
      node,
      registryEntry,
      connectedValuesBySchemaPath,
    })
  }, [connectedValuesBySchemaPath, hideFields, isRichMediaPanelWidget, node, registryEntry])
  const compactPreviewView = React.useMemo(() => {
    return buildWidgetCompactPreviewViewModel({
      preview: compactPreview,
      node,
    })
  }, [compactPreview, node])

  const compactPreviewEditorClass = React.useMemo(() => {
    return cn(
      'w-full h-40 rounded-md border px-2 py-2',
      monospaceTextClass,
      UI_THEME_TOKENS.input.bg,
      UI_THEME_TOKENS.input.border,
      UI_THEME_TOKENS.input.text,
    )
  }, [monospaceTextClass])

  const setCompactPreviewText = React.useCallback((nextText: string) => {
    const nextProperties = applyWidgetCompactPreviewTextUpdate({
      preview: compactPreview,
      properties,
      nextText,
    })
    if (!nextProperties) return
    onSetProperties(nextProperties)
  }, [compactPreview, onSetProperties, properties])

  const renderFrontmatterPortButton = React.useCallback((dir: 'in' | 'out', portKey: string) => {
    const aria = formatFlowHandleKeyValue({ dir, portKey })
    return (
      <button
        key={`${dir}:${portKey}`}
        type="button"
        aria-label={aria}
        title={aria}
        data-kg-port-handle="1"
        data-kg-port-handle-kind="dot"
        data-kg-port-dir={dir}
        data-kg-port-key={portKey}
        data-kg-port-path={readFlowHandlePath(dir)}
        className={cn('relative block', UI_THEME_TOKENS.button.text)}
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
          onSchemaPortHandleClick?.({ dir, portKey })
        }}
        disabled={!active || !portHandlesEnabled}
      >
        <span
          aria-hidden={true}
          className={cn('absolute top-1/2 left-1/2 rounded-full border', UI_THEME_TOKENS.panel.bg, PORT_HANDLE_STROKE_CLASS)}
          style={{ width: `${dotSizePx}px`, height: `${dotSizePx}px`, transform: 'translate(-50%, -50%)' }}
        />
      </button>
    )
  }, [active, dotHitPx, dotSizePx, onSchemaPortHandleClick, portHandlesEnabled])
  const frontmatterPortRows = React.useMemo(() => {
    return frontmatterContractRowSpecs.handleRows.map(rowSpec => {
      const inputId = `${idBase}-${rowSpec.rowKey}`
      const portButtons = rowSpec.declaredPortKeys.length > 0
        ? (
            <section className="flex flex-col items-center gap-1">
              {rowSpec.declaredPortKeys.map(portKey => renderFrontmatterPortButton(rowSpec.dir, portKey))}
            </section>
          )
        : renderFlowContractDot({ dir: rowSpec.dir, linked: false, portKey: '' })
      return {
        rowKey: rowSpec.rowKey,
        labelId: `${idBase}-kv-${rowSpec.rowKey}`,
        inPortNode: rowSpec.dir === 'in' ? portButtons : undefined,
        outPortNode: rowSpec.dir === 'out' ? portButtons : undefined,
        keyNode: (
          <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
            {rowSpec.label}
          </label>
        ),
        typeNode: renderKvTypeBox(rowSpec.typeLabel),
        valueNode: (
          <PlainTextInputEditor
            id={inputId}
            value={rowSpec.valueText}
            disabled
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
      }
    })
  }, [
    frontmatterContractRowSpecs.handleRows,
    idBase,
    keyLabelClass,
    keyValueInputClass,
    monospaceTextClass,
    renderFlowContractDot,
    renderFrontmatterPortButton,
    renderKvTypeBox,
    textSizeClass,
  ])
  const frontmatterEnvelopeRows = React.useMemo(() => {
    return frontmatterContractRowSpecs.envelopeRows.map((rowSpec, fieldIndex) => {
      if (rowSpec.kind === 'handle') {
        return frontmatterPortRows.find(row => row.rowKey === rowSpec.rowKey) || null
      }
      const inputId = `${idBase}-${rowSpec.rowKey}`
      if (rowSpec.kind === 'data') {
        return {
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
              {rowSpec.fieldKey}
            </label>
          ),
          typeNode: renderKvTypeBox(rowSpec.typeLabel),
          valueNode: (
            <PlainTextInputEditor
              id={inputId}
              value={flowDataDraft}
              onChange={next => {
                const raw = String(next ?? '')
                setFlowDataDraft(raw)
                if (!active) return
                if (!raw.trim()) {
                  onPatchProperties({ data: undefined })
                  return
                }
                try {
                  const parsed = JSON.parse(raw)
                  onPatchProperties({ data: parsed })
                } catch {
                  void 0
                }
              }}
              disabled={!active}
              multiline
              className={flowEnvelopeValueBoxClass}
            />
          ),
        }
      }
      if (rowSpec.kind === 'compute') {
        return {
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
              {rowSpec.fieldKey}
            </label>
          ),
          typeNode: renderKvTypeBox(rowSpec.typeLabel),
          valueNode: (
            <PlainTextInputEditor
              id={inputId}
              value={flowCompute}
              onChange={next => onPatchProperties({ 'flow:compute': next || undefined })}
              disabled={!active}
              multiline
              className={flowEnvelopeValueBoxClass}
            />
          ),
        }
      }
      return {
        rowKey: rowSpec.rowKey,
        labelId: `${idBase}-kv-flow-envelope-field-${fieldIndex}`,
        keyNode: (
          <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
            {rowSpec.fieldKey}
          </label>
        ),
        typeNode: renderKvTypeBox(rowSpec.typeLabel),
        valueNode: (
          <PlainTextInputEditor
            id={inputId}
            value={rowSpec.valueText}
            disabled
            multiline
            className={flowEnvelopeValueBoxClass}
          />
        ),
      }
    }).filter(Boolean) as NodeOverlayEditorKvRow[]
  }, [
    active,
    flowCompute,
    flowDataDraft,
    flowEnvelopeValueBoxClass,
    frontmatterContractRowSpecs.envelopeRows,
    frontmatterPortRows,
    idBase,
    keyLabelClass,
    onPatchProperties,
    renderKvTypeBox,
  ])

  return (
    <form
      className={cn(
        'py-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden',
        'px-3',
        panelTextClass,
      )}
      aria-label={UI_LABELS.flowWidgetForm}
      onSubmit={e => e.preventDefault()}
      onScrollCapture={() => emitInteractionFrame()}
      onWheelCapture={() => emitInteractionFrame()}
    >
      <section className="min-w-0" aria-label={UI_LABELS.flowWidgetNodeLegend}>
        <NodeOverlayEditorKvTable
          ariaLabel={UI_LABELS.flowWidgetNodeLegend}
          microLabelClass={microLabelClass}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
          rows={[
            {
              rowKey: 'node-label',
              labelId: `${idBase}-kv-node-label`,
              keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.label}>label</label>,
              typeNode: renderKvTypeBox('string'),
              valueNode: (
                <input
                  ref={labelInputRef}
                  id={ids.label}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    'text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  value={String(node.label || '')}
                  onChange={e => onSetLabel(e.target.value)}
                  disabled={!active}
                />
              ),
            },
          ]}
        />
      </section>

      {compactPreview && compactPreviewView && (
        <section className="min-w-0 mt-4" aria-label={compactPreviewView.sectionAriaLabel}>
          <section
            className={cn(
              'w-full overflow-hidden rounded-lg border',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
            )}
            data-kg-widget-preview-kind={compactPreviewView.kind}
          >
            {compactPreviewView.kind === 'text' ? (
              <PlainTextInputEditor
                id={`${idBase}-compact-preview`}
                ariaLabel={compactPreviewView.textAriaLabel}
                value={compactPreviewView.textValue}
                onChange={setCompactPreviewText}
                multiline
                readOnly={compactPreviewView.readOnly}
                className={compactPreviewEditorClass}
              />
            ) : compactPreviewView.kind === 'image' ? (
              <img
                src={compactPreviewView.mediaUrl}
                alt={compactPreviewView.mediaAlt}
                loading="lazy"
                className="block w-full h-48 object-contain"
              />
            ) : (
              <video
                src={compactPreviewView.mediaUrl}
                controls
                playsInline
                preload="metadata"
                className="block w-full h-48 object-contain"
              />
            )}
          </section>
        </section>
      )}

      {hideFields && isFrontmatterFlow && !hideFrontmatterFlowContractRows && frontmatterPortRows.length > 0 && (
        <section className="min-w-0 mt-4" aria-label="Flow Handles">
          <NodeOverlayEditorKvTable
            ariaLabel="Flow Handles"
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={frontmatterPortRows}
          />
        </section>
      )}

      {!hideFields && isFrontmatterFlow && !hideFrontmatterFlowContractRows && (
        <section className="min-w-0 mt-4" aria-label="Flow Envelope">
          <NodeOverlayEditorKvTable
            ariaLabel="Flow Envelope"
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={frontmatterEnvelopeRows}
          />
        </section>
      )}

      {!isFrontmatterFlow && !isRichMediaPanelWidget && (
      <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowEditorMapping}>
        <NodeOverlayEditorKvTable
          ariaLabel={UI_LABELS.flowEditorMapping}
          microLabelClass={microLabelClass}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          forcePortDots
          rows={[
            {
              rowKey: 'mapping-registry',
              labelId: `${idBase}-kv-mapping-registry`,
              keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.registrySelect}>{UI_LABELS.flowWidget}</label>,
              typeNode: <NodeOverlayEditorTypePill text="mapping" />,
              valueNode: (
                <select
                  id={ids.registrySelect}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    'text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  value={registrySelectionId}
                  onChange={handleRegistrySelect}
                  disabled={!active || !hasRegistryOptions}
                >
                  <option value="">{hasRegistryOptions ? UI_COPY.flowWidgetSelectPlaceholder : UI_LABELS.noneLabel}</option>
                  {registryOptions.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </section>
      )}

      {!isFrontmatterFlow && !isRichMediaPanelWidget && (
        <NodeOverlayEditorBeatByBeatSection
          node={node}
          graphMetaKind={graphMetaKind}
          edges={edges || []}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          compact={hideFields}
        />
      )}

      {showRichMediaPanelKtvRows && registryEntry && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows
          showPortRows
          showTableHeader
        />
      )}

      {showFrontmatterWidgetRegistrySection && registryEntry && (
        <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowWidget}>
          <NodeOverlayEditorKvTable
            ariaLabel={UI_LABELS.flowWidget}
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={[
              {
                rowKey: 'frontmatter-widget-identity',
                labelId: `${idBase}-kv-frontmatter-widget-identity`,
                keyNode: (
                  <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-frontmatter-widget-identity`}>
                    {UI_LABELS.flowWidget}
                  </label>
                ),
                typeNode: <NodeOverlayEditorTypePill text="mapping" />,
                valueNode: (
                  <PlainTextInputEditor
                    id={`${idBase}-frontmatter-widget-identity`}
                    value={frontmatterWidgetIdentityLabel}
                    disabled
                    readOnly
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                  />
                ),
              },
            ]}
          />
        </section>
      )}

      {showFrontmatterWidgetRegistrySection && registryEntry && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows
          showPortRows
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && hideFields && registryEntry && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows={false}
          showPortRows
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && !hideFields && registryEntry && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesBySchemaPath}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showPortRows={!isFrontmatterFlow}
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && !hideFields && (
        <NodeOverlayEditorParamsSection
          active={active}
          properties={properties}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ paramsJson: ids.paramsJson, paramsJsonInput: ids.paramsJsonInput }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          onPatchProperties={onPatchProperties}
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && (schemaFields.length > 0 || (registryEntry?.widgetTypeId || '').toLowerCase().includes('schema')) && (
        <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowWidgetSchemaLegend}>
          <NodeOverlayEditorSchemaTable
            active={active}
            schemaFields={schemaFields}
            portHandlesEnabled={portHandlesEnabled}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            microLabelClass={microLabelClass}
            textSizeClass={textSizeClass}
            keyValueInputClass={keyValueInputClass}
            onSchemaPortHandleClick={onSchemaPortHandleClick}
            onRenameSchemaFieldId={onRenameSchemaFieldId}
            onCommitSchemaFields={next => {
              onPatchProperties({ [FLOW_SCHEMA_FIELDS_PROPERTY_KEY]: next })
            }}
          />
        </section>
      )}

    </form>
  )
})
