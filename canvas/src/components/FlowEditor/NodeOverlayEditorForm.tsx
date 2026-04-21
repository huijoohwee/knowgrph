import React from 'react'

import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_EDITOR_ASPECT_RATIO_OPTIONS,
  FLOW_EDITOR_DURATION_SECONDS_OPTIONS,
  FLOW_EDITOR_RESOLUTION_OPTIONS,
  getFlowEditorSmartNodeModelOptions,
  UI_COPY,
  UI_LABELS,
  type FlowEditorSmartNodeProperties,
} from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_SCHEMA_FIELDS_PROPERTY_KEY,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import {
  FLOW_WIDGET_FORM_ID_KEY,
  FLOW_WIDGET_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import { formatFlowHandleKeyValue, formatFlowHandleValueList, readFlowHandlePath, readFlowHandleTypeLabel } from '@/lib/graph/flowHandlePresentation'
import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'
import { NodeOverlayEditorParamsSection } from '@/components/FlowEditor/NodeOverlayEditorParamsSection'
import { NodeOverlayEditorKvTable, NodeOverlayEditorTypePill, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { NodeOverlayEditorBeatByBeatSection } from '@/components/FlowEditor/NodeOverlayEditorBeatByBeatSection'
import type { GraphEdge } from '@/lib/graph/types'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'

const FRONTMATTER_FLOW_WIDGET_FIELDS_KEY = 'frontmatter:widgetFields' as const
const FRONTMATTER_FLOW_HANDLES_VALUE_KEY = 'frontmatter:handles' as const

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function pickBool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false
}

function pickNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function cleanDomIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readObjectPathValue(root: Record<string, unknown>, schemaPathRaw: string): unknown {
  const raw = String(schemaPathRaw || '').trim()
  if (!raw) return undefined
  const normalized = raw.startsWith('properties.') ? raw.slice('properties.'.length) : raw
  if (Object.prototype.hasOwnProperty.call(root, normalized)) return root[normalized]
  const parts = normalized.split('.').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return undefined
  let cur: unknown = root
  for (let i = 0; i < parts.length; i += 1) {
    if (!isRecord(cur)) return undefined
    cur = (cur as Record<string, unknown>)[parts[i]]
  }
  return cur
}

function parseHandleListInput(raw: string): string[] {
  const s = String(raw || '').trim()
  if (!s) return []
  const body = s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s
  const out = body
    .split(',')
    .map(part => part.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
    .map(v => String(v || '').trim())
    .filter(Boolean)
  return Array.from(new Set(out))
}

function isSmartMediaRegistryEntry(entry: WidgetRegistryEntry | null | undefined): boolean {
  if (!entry) return false
  if (String(entry.formId || '').trim() === 'imageGeneration') return true
  if (String(entry.formId || '').trim() === 'videoGeneration') return true
  const fields = Array.isArray(entry.fields) ? entry.fields : []
  if (fields.length === 0) return false
  const smartFieldKeySet = new Set([
    'model',
    'prompt',
    'aspect_ratio',
    'duration',
    'resolution',
    'generate_audio',
    'fast',
    'reference_image',
  ])
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i] as Record<string, unknown>
    const key = String(field?.fieldKey || '').trim()
    if (smartFieldKeySet.has(key)) return true
  }
  return false
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
  const properties = (node.properties || {}) as Record<string, unknown>
  const nodeTypeId = pickString(node.type).trim()
  const idBase = React.useMemo(() => {
    const nodeId = cleanDomIdPart(node.id) || 'node'
    return `flow-node-quick-${nodeId}`
  }, [node.id])

  const ids = React.useMemo(() => {
    return {
      label: `${idBase}-label`,
      type: `${idBase}-type`,
      model: `${idBase}-model`,
      prompt: `${idBase}-prompt`,
      aspect: `${idBase}-aspect`,
      duration: `${idBase}-duration`,
      resolution: `${idBase}-resolution`,
      generateAudio: `${idBase}-generate-audio`,
      fast: `${idBase}-fast`,
      referenceImage: `${idBase}-reference-image`,
      registrySelect: `${idBase}-registry-select`,
      registryField: (fieldKey: string) => `${idBase}-registry-field-${cleanDomIdPart(fieldKey) || 'field'}`,
      paramsJson: `${idBase}-params-json`,
      paramsJsonInput: `${idBase}-params-json-input`,
      portHandle: (portKey: string, dir: 'in' | 'out') => `${idBase}-port-${dir}-${cleanDomIdPart(portKey) || 'port'}`,
    }
  }, [idBase])

  const schemaFields = React.useMemo(() => readSchemaFieldSpecs(node), [node])
  const nodeFormId = typeof properties[FLOW_WIDGET_FORM_ID_KEY] === 'string' ? String(properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim() : ''
  const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow' || (nodeFormId && nodeFormId.startsWith('fm:'))
  const portHandlesEnabled = Boolean(schema?.behavior?.portHandles?.enabled) || isFrontmatterFlow
  const smartMediaMode = React.useMemo<'image' | 'video' | null>(() => {
    if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'image'
    if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'video'
    const entryFormId = String(registryEntry?.formId || '').trim()
    if (entryFormId === 'imageGeneration' || nodeFormId === 'imageGeneration') return 'image'
    if (entryFormId === 'videoGeneration' || nodeFormId === 'videoGeneration') return 'video'
    return null
  }, [nodeFormId, nodeTypeId, registryEntry?.formId])
  const smartModelOptions = React.useMemo(() => getFlowEditorSmartNodeModelOptions(smartMediaMode), [smartMediaMode])

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
  const flowPortTypes = React.useMemo(() => {
    const raw = properties['flow:portTypes']
    if (!isRecord(raw)) return { target: [] as string[], source: [] as string[] }
    const inPortsRaw = isRecord(raw.in) ? raw.in : {}
    const outPortsRaw = isRecord(raw.out) ? raw.out : {}
    const target = Object.keys(inPortsRaw).map(k => String(k || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    const source = Object.keys(outPortsRaw).map(k => String(k || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    return { target, source }
  }, [properties])
  const connectedFlowHandles = React.useMemo(() => {
    const target = new Set<string>()
    const source = new Set<string>()
    const nodeId = String(node.id || '').trim()
    const list = Array.isArray(edges) ? edges : []
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i]
      const src = String(e?.source || '').trim()
      const tgt = String(e?.target || '').trim()
      const props = (e?.properties || {}) as Record<string, unknown>
      const srcKey = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
      const tgtKey = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
      if (src === nodeId && srcKey) source.add(srcKey)
      if (tgt === nodeId && tgtKey) target.add(tgtKey)
    }
    return {
      target: Array.from(target).sort((a, b) => a.localeCompare(b)),
      source: Array.from(source).sort((a, b) => a.localeCompare(b)),
    }
  }, [edges, node.id])
  const flowRegistryHandles = React.useMemo(() => {
    const ports = Array.isArray(registryEntry?.ports) ? registryEntry!.ports : []
    const target = new Set<string>()
    const source = new Set<string>()
    for (let i = 0; i < ports.length; i += 1) {
      const p = ports[i]
      if (!p || p.isHidden === true) continue
      const key = String(p.portKey || '').trim()
      if (!key) continue
      if (p.direction === 'input') target.add(key)
      else if (p.direction === 'output') source.add(key)
    }
    return {
      target: Array.from(target).sort((a, b) => a.localeCompare(b)),
      source: Array.from(source).sort((a, b) => a.localeCompare(b)),
    }
  }, [registryEntry])
  const flowHandleKeys = React.useMemo(() => {
    const target = connectedFlowHandles.target.length > 0
      ? connectedFlowHandles.target
      : (flowRegistryHandles.target.length > 0 ? flowRegistryHandles.target : flowPortTypes.target)
    const source = connectedFlowHandles.source.length > 0
      ? connectedFlowHandles.source
      : (flowRegistryHandles.source.length > 0 ? flowRegistryHandles.source : flowPortTypes.source)
    return { target, source }
  }, [
    connectedFlowHandles.source,
    connectedFlowHandles.target,
    flowPortTypes.source,
    flowPortTypes.target,
    flowRegistryHandles.source,
    flowRegistryHandles.target,
  ])
  const flowCompute = pickString(properties['flow:compute'])
  const hasFlowCompute = Object.prototype.hasOwnProperty.call(properties, 'flow:compute')
  const hasFlowData = Object.prototype.hasOwnProperty.call(properties, 'data')
  const hasFlowTargetHandles = flowHandleKeys.target.length > 0
  const hasFlowSourceHandles = flowHandleKeys.source.length > 0
  const formatFlowHandlePathValue = (handles: ReadonlyArray<string>): string => formatFlowHandleValueList(handles)
  const flowDataJson = React.useMemo(() => {
    const raw = properties.data
    if (typeof raw === 'string') return raw
    if (typeof raw === 'undefined') return ''
    try {
      return JSON.stringify(raw, null, 2) || ''
    } catch {
      return ''
    }
  }, [properties.data])
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

  const model = pickString(properties.model)
  const prompt = pickString(properties.prompt)
  const aspectRatio = pickString(properties.aspect_ratio)
  const duration = pickNumber(properties.duration)
  const resolution = pickString(properties.resolution)
  const generateAudio = pickBool(properties.generate_audio)
  const fast = pickBool(properties.fast)
  const referenceImage = pickString(properties.reference_image)

  const normalizeRegistrySchemaPath = React.useCallback((schemaPath: string | undefined, fallbackKey: string) => {
    const raw = String(schemaPath || fallbackKey || '').trim()
    if (!raw) return ''
    if (raw.startsWith('properties') || raw.startsWith('metadata') || raw.startsWith('label') || raw.startsWith('type')) return raw
    return `properties.${raw}`
  }, [])
  const flowRegistryFormId = String(properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
  const flowRegistryFormIdExpected = flowRegistryFormId || `fm:${String(node.id || '').trim()}`

  const registryOptions = React.useMemo(
    () => {
      const all = (registryEntries || []).filter(
        entry => entry && entry.isEnabled && entry.nodeTypeId === nodeTypeId,
      )
      if (!isFrontmatterFlow) return all
      const expected = String(flowRegistryFormIdExpected || '').trim()
      if (!expected) return []
      return all.filter(entry => String(entry.formId || '').trim() === expected)
    },
    [flowRegistryFormIdExpected, isFrontmatterFlow, nodeTypeId, registryEntries],
  )
  const registrySelectionId = registryEntry?.id || ''
  const hasRegistryOptions = registryOptions.length > 0
  const hasSmartMediaSelection = React.useMemo(() => {
    if (isSmartMediaRegistryEntry(registryEntry)) return true
    const formId = String(properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
    return formId === 'imageGeneration' || formId === 'videoGeneration' || formId === 'widget'
  }, [properties, registryEntry])
  const showSmartMediaFields = !hideFields && (!isFrontmatterFlow || hasSmartMediaSelection)

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
  const interactionFrameRafRef = React.useRef<number | null>(null)
  const emitInteractionFrame = React.useCallback(() => {
    if (typeof window === 'undefined') return
    if (interactionFrameRafRef.current != null) return
    interactionFrameRafRef.current = requestAnimationFrame(() => {
      interactionFrameRafRef.current = null
      try {
        window.dispatchEvent(new Event(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
      } catch {
        void 0
      }
    })
  }, [])

  React.useEffect(() => {
    return () => {
      if (interactionFrameRafRef.current == null) return
      try {
        cancelAnimationFrame(interactionFrameRafRef.current)
      } catch {
        void 0
      }
      interactionFrameRafRef.current = null
    }
  }, [])

  return (
    <form
      className={cn('px-3 py-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden', panelTextClass)}
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
              rowKey: 'node-type',
              labelId: `${idBase}-kv-node-type`,
              keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.type}>type</label>,
              typeNode: renderKvTypeBox('string'),
              valueNode: (
                <input
                  id={ids.type}
                  className={cn(
                    keyValueInputClass,
                    textSizeClass,
                    'text-left',
                    UI_THEME_TOKENS.input.bg,
                    UI_THEME_TOKENS.input.border,
                    UI_THEME_TOKENS.input.text,
                  )}
                  value={String(node.type || '')}
                  readOnly
                  disabled
                />
              ),
            },
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

      {showSmartMediaFields && (
        <section className="min-w-0 mt-4" aria-label={UI_LABELS.flowWidgetSmartFieldsLegend}>
          <NodeOverlayEditorKvTable
            ariaLabel={UI_LABELS.flowWidgetSmartFieldsLegend}
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={[
              {
                rowKey: 'smart-model',
                labelId: `${idBase}-kv-smart-model`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.model}>{UI_LABELS.flowWidgetModel}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.model}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={model}
                    onChange={e => onPatchProperties({ model: (e.target.value || undefined) as FlowEditorSmartNodeProperties['model'] })}
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowWidgetSelectPlaceholder}</option>
                    {smartModelOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-prompt',
                labelId: `${idBase}-kv-smart-prompt`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.prompt}>{UI_LABELS.flowWidgetPrompt}</label>,
                typeNode: <NodeOverlayEditorTypePill text="text" />,
                valueNode: (
                  <PlainTextInputEditor
                    id={ids.prompt}
                    value={prompt}
                    onChange={nextPrompt => onPatchProperties({ prompt: nextPrompt })}
                    disabled={!active}
                    multiline
                    className={cn(
                      'w-full h-32 px-2 py-1 rounded-md border',
                      monospaceTextClass,
                    )}
                  />
                ),
              },
              {
                rowKey: 'smart-aspect',
                labelId: `${idBase}-kv-smart-aspect`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.aspect}>{UI_LABELS.flowWidgetAspectRatio}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.aspect}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={aspectRatio}
                    onChange={e =>
                      onPatchProperties({
                        aspect_ratio: (e.target.value || undefined) as FlowEditorSmartNodeProperties['aspect_ratio'],
                      })
                    }
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowWidgetSelectPlaceholder}</option>
                    {FLOW_EDITOR_ASPECT_RATIO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-duration',
                labelId: `${idBase}-kv-smart-duration`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.duration}>{UI_LABELS.flowWidgetDuration}</label>,
                typeNode: <NodeOverlayEditorTypePill text="int" />,
                valueNode: (
                  <select
                    id={ids.duration}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={duration === null ? '' : String(duration)}
                    onChange={e => {
                      const next = Number.parseInt(e.target.value, 10)
                      onPatchProperties({ duration: Number.isFinite(next) ? next : undefined })
                    }}
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowWidgetSelectPlaceholder}</option>
                    {FLOW_EDITOR_DURATION_SECONDS_OPTIONS.map(o => (
                      <option key={o.value} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-resolution',
                labelId: `${idBase}-kv-smart-resolution`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.resolution}>{UI_LABELS.flowWidgetResolution}</label>,
                typeNode: <NodeOverlayEditorTypePill text="enum" />,
                valueNode: (
                  <select
                    id={ids.resolution}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={resolution}
                    onChange={e =>
                      onPatchProperties({ resolution: (e.target.value || undefined) as FlowEditorSmartNodeProperties['resolution'] })
                    }
                    disabled={!active}
                  >
                    <option value="">{UI_COPY.flowWidgetSelectPlaceholder}</option>
                    {FLOW_EDITOR_RESOLUTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                rowKey: 'smart-generate-audio',
                labelId: `${idBase}-kv-smart-generate-audio`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.generateAudio}>{UI_LABELS.flowWidgetGenerateAudio}</label>,
                typeNode: <NodeOverlayEditorTypePill text="bool" />,
                valueNode: (
                <section className="w-full flex items-center">
                  <input
                    id={ids.generateAudio}
                    type="checkbox"
                    checked={generateAudio}
                    onChange={e => onPatchProperties({ generate_audio: e.target.checked })}
                    disabled={!active}
                  />
                </section>
                ),
              },
              {
                rowKey: 'smart-fast',
                labelId: `${idBase}-kv-smart-fast`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.fast}>{UI_LABELS.flowWidgetFast}</label>,
                typeNode: <NodeOverlayEditorTypePill text="bool" />,
                valueNode: (
                <section className="w-full flex items-center">
                  <input
                    id={ids.fast}
                    type="checkbox"
                    checked={fast}
                    onChange={e => onPatchProperties({ fast: e.target.checked })}
                    disabled={!active}
                  />
                </section>
                ),
              },
              {
                rowKey: 'smart-reference-image',
                labelId: `${idBase}-kv-smart-reference-image`,
                keyNode: <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={ids.referenceImage}>{UI_LABELS.flowWidgetReferenceImage}</label>,
                typeNode: <NodeOverlayEditorTypePill text="text" />,
                valueNode: (
                  <input
                    id={ids.referenceImage}
                    className={cn(
                      keyValueInputClass,
                      textSizeClass,
                      'text-left',
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.text,
                    )}
                    value={referenceImage}
                    onChange={e => onPatchProperties({ reference_image: e.target.value || undefined })}
                    placeholder={UI_COPY.flowWidgetReferenceImagePlaceholder}
                    disabled={!active}
                  />
                ),
              },
            ]}
          />
        </section>
      )}

      {!hideFields && isFrontmatterFlow && (
        <section className="min-w-0 mt-4" aria-label="Flow Envelope">
          <NodeOverlayEditorKvTable
            ariaLabel="Flow Envelope"
            microLabelClass={microLabelClass}
            dotSizePx={dotSizePx}
            dotHitPx={dotHitPx}
            forcePortDots
            rows={(() => {
              const rows: NodeOverlayEditorKvRow[] = []

              const handlesValue = (properties as Record<string, unknown>)['frontmatter:handles']
              const handlesRec = handlesValue && typeof handlesValue === 'object' && !Array.isArray(handlesValue)
                ? (handlesValue as Record<string, unknown>)
                : null
              const inPorts = Array.isArray(handlesRec?.target) ? (handlesRec!.target as unknown[]) : []
              const outPorts = Array.isArray(handlesRec?.source) ? (handlesRec!.source as unknown[]) : []
              const inKeys = Array.from(new Set(inPorts.map(v => String(v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
              const outKeys = Array.from(new Set(outPorts.map(v => String(v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))

              const renderPortButton = (dir: 'in' | 'out', portKey: string) => {
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
              }

              if (hasFlowTargetHandles || inKeys.length > 0) {
                rows.push({
                  rowKey: 'flow-handles-target',
                  labelId: `${idBase}-kv-flow-handles-target`,
                  inPortNode: inKeys.length > 0
                    ? <section className="flex flex-col items-center gap-1">{inKeys.map(k => renderPortButton('in', k))}</section>
                    : renderFlowContractDot({ dir: 'in', linked: false, portKey: '' }),
                  keyNode: (
                    <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-flow-handles-target`}>
                      {readFlowHandlePath('in')}
                    </label>
                  ),
                  typeNode: renderKvTypeBox(readFlowHandleTypeLabel('in')),
                  valueNode: (
                    <PlainTextInputEditor
                      id={`${idBase}-flow-handles-target`}
                      value={formatFlowHandlePathValue(flowHandleKeys.target)}
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
                })
              }

              if (hasFlowSourceHandles || outKeys.length > 0) {
                rows.push({
                  rowKey: 'flow-handles-source',
                  labelId: `${idBase}-kv-flow-handles-source`,
                  outPortNode: outKeys.length > 0
                    ? <section className="flex flex-col items-center gap-1">{outKeys.map(k => renderPortButton('out', k))}</section>
                    : renderFlowContractDot({ dir: 'out', linked: false, portKey: '' }),
                  keyNode: (
                    <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-flow-handles-source`}>
                      {readFlowHandlePath('out')}
                    </label>
                  ),
                  typeNode: renderKvTypeBox(readFlowHandleTypeLabel('out')),
                  valueNode: (
                    <PlainTextInputEditor
                      id={`${idBase}-flow-handles-source`}
                      value={formatFlowHandlePathValue(flowHandleKeys.source)}
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
                })
              }

              if (hasFlowData) {
                rows.push({
                  rowKey: 'flow-envelope-data',
                  labelId: `${idBase}-kv-flow-envelope-data`,
                  keyNode: (
                    <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-flow-envelope-data`}>
                      data
                    </label>
                  ),
                  typeNode: renderKvTypeBox('object'),
                  valueNode: (
                    <PlainTextInputEditor
                      id={`${idBase}-flow-envelope-data`}
                      value={flowDataJson}
                      disabled
                      multiline
                      className={flowEnvelopeValueBoxClass}
                    />
                  ),
                })
              }

              if (hasFlowCompute) {
                rows.push({
                  rowKey: 'flow-envelope-compute',
                  labelId: `${idBase}-kv-flow-envelope-compute`,
                  keyNode: (
                    <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-flow-envelope-compute`}>
                      compute
                    </label>
                  ),
                  typeNode: renderKvTypeBox('function'),
                  valueNode: (
                    <PlainTextInputEditor
                      id={`${idBase}-flow-envelope-compute`}
                      value={flowCompute}
                      onChange={next => onPatchProperties({ 'flow:compute': next || undefined })}
                      disabled={!active}
                      multiline
                      className={flowEnvelopeValueBoxClass}
                    />
                  ),
                })
              }

              const rawDeclaredFields = (properties as Record<string, unknown>)[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY]
              const declaredFields = Array.isArray(rawDeclaredFields) ? rawDeclaredFields : []
              for (let fieldIndex = 0; fieldIndex < declaredFields.length; fieldIndex += 1) {
                const spec = declaredFields[fieldIndex]
                if (!spec || typeof spec !== 'object') continue
                const rec = spec as Record<string, unknown>
                const fieldKey = String(rec.fieldKey || '').trim()
                const fieldType = String(rec.fieldType || '').trim() || 'unknown'
                const schemaPath = String(rec.schemaPath || fieldKey).trim()
                if (!fieldKey || !schemaPath) continue
                if (
                  schemaPath === FRONTMATTER_FLOW_HANDLES_VALUE_KEY ||
                  schemaPath === 'flow:compute' ||
                  schemaPath === 'data' ||
                  fieldKey === 'handles' ||
                  fieldKey === 'compute' ||
                  fieldKey === 'data'
                ) {
                  continue
                }
                const rawValue = readObjectPathValue(properties as Record<string, unknown>, schemaPath)
                if (typeof rawValue === 'undefined') continue
                const valueText = typeof rawValue === 'string'
                  ? rawValue
                  : (() => {
                      try {
                        return JSON.stringify(rawValue, null, 2) || ''
                      } catch {
                        return String(rawValue)
                      }
                    })()
                rows.push({
                  rowKey: `flow-envelope-field-${fieldKey}-${fieldIndex}`,
                  labelId: `${idBase}-kv-flow-envelope-field-${fieldIndex}`,
                  keyNode: (
                    <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={`${idBase}-flow-envelope-field-${fieldIndex}`}>
                      {fieldKey}
                    </label>
                  ),
                  typeNode: renderKvTypeBox(fieldType),
                  valueNode: (
                    <PlainTextInputEditor
                      id={`${idBase}-flow-envelope-field-${fieldIndex}`}
                      value={valueText}
                      disabled
                      multiline
                      className={flowEnvelopeValueBoxClass}
                    />
                  ),
                })
              }

              return rows
            })()}
          />
        </section>
      )}

      {!isFrontmatterFlow && (
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

      {!isFrontmatterFlow && (
        <NodeOverlayEditorBeatByBeatSection
          node={node}
          graphMetaKind={graphMetaKind}
          edges={edges || []}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          compact={hideFields}
        />
      )}

      {!isFrontmatterFlow && !hideFields && registryEntry && !(
        isFrontmatterFlow &&
        String(registryEntry.formId || '').trim() === `fm:${String(node.id || '').trim()}` &&
        Array.isArray(registryEntry.fields) &&
        registryEntry.fields.length > 0 &&
        registryEntry.fields.every(f => {
          const k = String((f as { fieldKey?: unknown })?.fieldKey || '').trim()
          return k === 'type' || k === 'label' || k === 'handles' || k === 'data' || k === 'compute'
        })
      ) && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={properties}
          registryEntry={registryEntry}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          normalizeRegistrySchemaPath={normalizeRegistrySchemaPath}
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

      {!isFrontmatterFlow && !hideFields && (
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

      {!isFrontmatterFlow && (schemaFields.length > 0 || (registryEntry?.widgetTypeId || '').toLowerCase().includes('schema')) && (
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
