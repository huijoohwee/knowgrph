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
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
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
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import { setObjectPath } from '@/lib/data/objectPath'
import { inferMediaKindFromResourceUrl } from '@/lib/graph/mediaUrlKind'
import { inferWidgetAutoRenderKind } from '@/lib/flowEditor/widgetAutoRender'
import {
  getWidgetRegistryEntryLabel,
  inferTextGenerationProviderFamily,
} from '@/features/flow-editor-manager/registryTemplates'

const FRONTMATTER_FLOW_WIDGET_FIELDS_KEY = 'frontmatter:widgetFields' as const
const FRONTMATTER_FLOW_HANDLES_VALUE_KEY = 'frontmatter:handles' as const

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
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

type WidgetCompactPreviewKind = 'text' | 'image' | 'video'

type WidgetCompactPreviewSpec = {
  kind: WidgetCompactPreviewKind
  schemaPath: string
  portKey: string
  source: 'connected' | 'local'
  editable: boolean
  text?: string
  url?: string
}

type WidgetPreviewFieldSpec = {
  fieldKey: string
  fieldType: string
  schemaPath: string
}

type WidgetPreviewCandidateDescriptor = {
  portKey: string
  schemaPath: string
  outputTypeHint: string
  fieldTypeHint: string
}

function normalizePreviewSchemaPath(rawSchemaPath: unknown, fallbackKey: string): string {
  const raw = String(rawSchemaPath || fallbackKey || '').trim()
  if (!raw) return ''
  if (raw.startsWith('properties.') || raw.startsWith('metadata.') || raw === 'label' || raw === 'type') return raw
  return `properties.${raw}`
}

function normalizePreviewKindHint(rawHint: string): WidgetCompactPreviewKind | null {
  const hint = String(rawHint || '').trim().toLowerCase()
  if (!hint) return null
  if (hint.includes('image') || hint.includes('svg')) return 'image'
  if (hint.includes('video')) return 'video'
  if (
    hint.includes('text')
    || hint.includes('markdown')
    || hint.includes('textarea')
    || hint.includes('string')
    || hint.includes('html')
    || hint.includes('srcdoc')
    || hint.includes('output')
  ) {
    return 'text'
  }
  return null
}

function readWidgetPreviewFieldSpecs(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null
}): WidgetPreviewFieldSpec[] {
  const out: WidgetPreviewFieldSpec[] = []
  const seen = new Set<string>()
  const push = (fieldKey: unknown, fieldType: unknown, schemaPath: unknown) => {
    const normalizedFieldKey = String(fieldKey || '').trim()
    const normalizedSchemaPath = normalizePreviewSchemaPath(schemaPath, normalizedFieldKey)
    if (!normalizedFieldKey || !normalizedSchemaPath) return
    const dedupeKey = `${normalizedFieldKey}::${normalizedSchemaPath}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    out.push({
      fieldKey: normalizedFieldKey,
      fieldType: String(fieldType || '').trim().toLowerCase(),
      schemaPath: normalizedSchemaPath,
    })
  }
  const registryFields = Array.isArray(args.registryEntry?.fields) ? args.registryEntry!.fields : []
  for (let i = 0; i < registryFields.length; i += 1) {
    const field = registryFields[i]
    if (!field || field.isHidden === true) continue
    push(field.fieldKey, field.fieldType, field.schemaPath)
  }
  const properties = (args.node.properties || {}) as Record<string, unknown>
  const rawDeclaredFields = Array.isArray(properties[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY])
    ? (properties[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY] as unknown[])
    : []
  for (let i = 0; i < rawDeclaredFields.length; i += 1) {
    const field = rawDeclaredFields[i]
    if (!field || typeof field !== 'object') continue
    const rec = field as Record<string, unknown>
    push(rec.fieldKey, rec.fieldType, rec.schemaPath)
  }
  return out
}

function readWidgetOutputTypeHints(node: GraphNode): Record<string, string> {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props['flow:portTypes']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rec = raw as Record<string, unknown>
  const outBucket = rec.out
  if (!outBucket || typeof outBucket !== 'object' || Array.isArray(outBucket)) return {}
  const rawEntries = Object.entries(outBucket as Record<string, unknown>)
  const out: Record<string, string> = {}
  for (let i = 0; i < rawEntries.length; i += 1) {
    const [portKey, hint] = rawEntries[i]!
    const normalizedPortKey = String(portKey || '').trim()
    const normalizedHint = String(hint || '').trim()
    if (!normalizedPortKey || !normalizedHint) continue
    out[normalizedPortKey] = normalizedHint
  }
  return out
}

function pushWidgetPreviewCandidateDescriptor(
  out: WidgetPreviewCandidateDescriptor[],
  seen: Set<string>,
  next: WidgetPreviewCandidateDescriptor,
) {
  const portKey = String(next.portKey || '').trim()
  const schemaPath = String(next.schemaPath || '').trim()
  if (!portKey && !schemaPath) return
  const dedupeKey = `${portKey}::${schemaPath}`
  if (seen.has(dedupeKey)) return
  seen.add(dedupeKey)
  out.push({
    portKey,
    schemaPath,
    outputTypeHint: String(next.outputTypeHint || '').trim(),
    fieldTypeHint: String(next.fieldTypeHint || '').trim(),
  })
}

function scoreWidgetPreviewCandidate(candidate: {
  kind: WidgetCompactPreviewKind
  schemaPath: string
  portKey: string
}): number {
  const key = `${candidate.portKey}|${candidate.schemaPath}`.toLowerCase()
  if (key.includes('imageurl') || key.endsWith('.image') || key.includes('|image')) return 400
  if (key.includes('videourl') || key.endsWith('.video') || key.includes('|video')) return 380
  if (key.includes('outputsrcdoc')) return 350
  if (key.includes('output') || key.includes('text') || key.includes('markdown')) return 360
  if (candidate.kind === 'image') return 320
  if (candidate.kind === 'video') return 300
  return 260
}

function resolveWidgetCompactPreview(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): WidgetCompactPreviewSpec | null {
  const nodeTypeId = String(args.node.type || '').trim()
  if (nodeTypeId === 'TextGeneration') {
    const props = (args.node.properties || {}) as Record<string, unknown>
    const providerFamily = inferTextGenerationProviderFamily({
      provider: props.chatProvider,
      widgetTypeId: args.registryEntry?.widgetTypeId || props[FLOW_WIDGET_TYPE_ID_KEY],
      formId: args.registryEntry?.formId || props[FLOW_WIDGET_FORM_ID_KEY],
    })
    if (providerFamily === 'byteplus') return null
  }
  const fieldSpecs = readWidgetPreviewFieldSpecs(args)
  const fieldSpecByKey = new Map<string, WidgetPreviewFieldSpec>()
  const fieldSpecBySchemaPath = new Map<string, WidgetPreviewFieldSpec>()
  for (let i = 0; i < fieldSpecs.length; i += 1) {
    const field = fieldSpecs[i]!
    fieldSpecByKey.set(field.fieldKey, field)
    fieldSpecBySchemaPath.set(field.schemaPath, field)
  }

  const descriptors: WidgetPreviewCandidateDescriptor[] = []
  const descriptorKeys = new Set<string>()
  const registryPorts = Array.isArray(args.registryEntry?.ports) ? args.registryEntry!.ports : []
  for (let i = 0; i < registryPorts.length; i += 1) {
    const port = registryPorts[i]
    if (!port || port.isHidden === true || port.direction !== 'output') continue
    const portKey = String(port.portKey || '').trim()
    const schemaPath = normalizePreviewSchemaPath(
      port.schemaPath,
      fieldSpecByKey.get(portKey)?.schemaPath || portKey,
    )
    pushWidgetPreviewCandidateDescriptor(descriptors, descriptorKeys, {
      portKey,
      schemaPath,
      outputTypeHint: portKey,
      fieldTypeHint: fieldSpecBySchemaPath.get(schemaPath)?.fieldType || '',
    })
  }

  const outputTypeHints = readWidgetOutputTypeHints(args.node)
  for (const [portKey, outputTypeHint] of Object.entries(outputTypeHints)) {
    const fieldSpec = fieldSpecByKey.get(portKey)
    pushWidgetPreviewCandidateDescriptor(descriptors, descriptorKeys, {
      portKey,
      schemaPath: fieldSpec?.schemaPath || normalizePreviewSchemaPath('', portKey),
      outputTypeHint,
      fieldTypeHint: fieldSpec?.fieldType || '',
    })
  }

  const knownDefaults: Array<{ portKey: string; schemaPath: string; outputTypeHint: string }> = [
    { portKey: 'imageUrl', schemaPath: 'properties.imageUrl', outputTypeHint: 'image' },
    { portKey: 'videoUrl', schemaPath: 'properties.videoUrl', outputTypeHint: 'video' },
    { portKey: 'output', schemaPath: 'properties.output', outputTypeHint: 'text' },
    { portKey: 'outputSrcDoc', schemaPath: 'properties.outputSrcDoc', outputTypeHint: 'text' },
  ]
  for (let i = 0; i < knownDefaults.length; i += 1) {
    const item = knownDefaults[i]!
    pushWidgetPreviewCandidateDescriptor(descriptors, descriptorKeys, {
      ...item,
      fieldTypeHint: fieldSpecBySchemaPath.get(item.schemaPath)?.fieldType || '',
    })
  }

  const candidates: Array<WidgetCompactPreviewSpec & { score: number }> = []
  for (let i = 0; i < descriptors.length; i += 1) {
    const descriptor = descriptors[i]!
    const connectedValue = args.connectedValuesBySchemaPath?.[descriptor.schemaPath]?.value
    const localValue = readObjectPathValue((args.node.properties || {}) as Record<string, unknown>, descriptor.schemaPath)
    const sources: Array<{ source: 'connected' | 'local'; value: unknown }> = []
    if (typeof connectedValue !== 'undefined') sources.push({ source: 'connected', value: connectedValue })
    if (typeof localValue !== 'undefined') sources.push({ source: 'local', value: localValue })
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const sourceRec = sources[sourceIndex]!
      const explicitKind =
        inferWidgetAutoRenderKind({
          connectedValue: sourceRec.source === 'connected' ? args.connectedValuesBySchemaPath?.[descriptor.schemaPath] : null,
          schemaPath: descriptor.schemaPath,
          portKey: descriptor.portKey,
          hintTokens: [descriptor.outputTypeHint, descriptor.fieldTypeHint],
        })
        || normalizePreviewKindHint(descriptor.outputTypeHint)
        || normalizePreviewKindHint(descriptor.fieldTypeHint)
        || normalizePreviewKindHint(descriptor.portKey)
        || normalizePreviewKindHint(descriptor.schemaPath)
      const rawString = typeof sourceRec.value === 'string' ? sourceRec.value.trim() : ''
      const inferredUrlKind = rawString ? inferMediaKindFromResourceUrl(rawString) : null
      const resolvedKind: WidgetCompactPreviewKind | null =
        explicitKind
        || (inferredUrlKind === 'image' || inferredUrlKind === 'svg'
          ? 'image'
          : inferredUrlKind === 'video'
            ? 'video'
            : null)
      if (resolvedKind === 'image' || resolvedKind === 'video') {
        if (!rawString) continue
        candidates.push({
          kind: resolvedKind,
          schemaPath: descriptor.schemaPath,
          portKey: descriptor.portKey,
          source: sourceRec.source,
          editable: false,
          url: rawString,
          score: scoreWidgetPreviewCandidate({
            kind: resolvedKind,
            schemaPath: descriptor.schemaPath,
            portKey: descriptor.portKey,
          }),
        })
        continue
      }
      if (resolvedKind !== 'text') continue
      const textValue =
        typeof sourceRec.value === 'string'
          ? sourceRec.value
          : (() => {
              try {
                return JSON.stringify(sourceRec.value, null, 2) || ''
              } catch {
                return String(sourceRec.value ?? '')
              }
            })()
      if (!textValue.trim()) continue
      candidates.push({
        kind: 'text',
        schemaPath: descriptor.schemaPath,
        portKey: descriptor.portKey,
        source: sourceRec.source,
        editable: sourceRec.source === 'local' && descriptor.schemaPath !== 'properties.outputSrcDoc',
        text: textValue,
        score: scoreWidgetPreviewCandidate({
          kind: 'text',
          schemaPath: descriptor.schemaPath,
          portKey: descriptor.portKey,
        }),
      })
    }
  }

  if (candidates.length === 0) return null
  const connectedCandidates = candidates.filter(candidate => candidate.source === 'connected')
  const activeCandidates = connectedCandidates.length > 0 ? connectedCandidates : candidates
  activeCandidates.sort((a, b) => b.score - a.score)
  const best = activeCandidates[0]
  return best ? {
    kind: best.kind,
    schemaPath: best.schemaPath,
    portKey: best.portKey,
    source: best.source,
    editable: best.editable,
    text: best.text,
    url: best.url,
  } : null
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
  const isRichMediaPanelWidget = nodeTypeId === 'RichMediaPanel'
  const isFrontmatterWidgetRegistryNode =
    nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
    || nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    || nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
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

  const normalizeRegistrySchemaPath = React.useCallback((schemaPath: string | undefined, fallbackKey: string) => {
    const raw = String(schemaPath || fallbackKey || '').trim()
    if (!raw) return ''
    if (raw.startsWith('properties') || raw.startsWith('metadata') || raw.startsWith('label') || raw.startsWith('type')) return raw
    return `properties.${raw}`
  }, [])
  const flowRegistryFormId = String(properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
  const flowRegistryFormIdExpected = flowRegistryFormId || `fm:${String(node.id || '').trim()}`
  const showFrontmatterWidgetRegistrySection = Boolean(
    isFrontmatterFlow
    && isFrontmatterWidgetRegistryNode
    && registryEntry,
  )
  const hideFrontmatterFlowContractRows = showFrontmatterWidgetRegistrySection
  const frontmatterWidgetIdentityLabel = React.useMemo(() => {
    if (!showFrontmatterWidgetRegistrySection || !registryEntry) return ''
    return getWidgetRegistryEntryLabel({
      nodeTypeId: nodeTypeId || registryEntry.nodeTypeId,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    })
  }, [nodeTypeId, registryEntry, showFrontmatterWidgetRegistrySection])

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
    if (!compactPreview || compactPreview.kind !== 'text' || !compactPreview.editable) return
    const nextRoot = setObjectPath(
      { properties },
      compactPreview.schemaPath,
      nextText === '' ? undefined : nextText,
    ) as { properties?: Record<string, unknown> }
    onSetProperties(nextRoot.properties || {})
  }, [compactPreview, onSetProperties, properties])

  const handlesValue = (properties as Record<string, unknown>)[FRONTMATTER_FLOW_HANDLES_VALUE_KEY]
  const handlesRec = handlesValue && typeof handlesValue === 'object' && !Array.isArray(handlesValue)
    ? (handlesValue as Record<string, unknown>)
    : null
  const frontmatterInKeys = React.useMemo(() => {
    const inPorts = Array.isArray(handlesRec?.target) ? (handlesRec!.target as unknown[]) : []
    return Array.from(new Set(inPorts.map(v => String(v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [handlesRec])
  const frontmatterOutKeys = React.useMemo(() => {
    const outPorts = Array.isArray(handlesRec?.source) ? (handlesRec!.source as unknown[]) : []
    return Array.from(new Set(outPorts.map(v => String(v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [handlesRec])
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
    const rows: NodeOverlayEditorKvRow[] = []
    if (hasFlowTargetHandles || frontmatterInKeys.length > 0) {
      rows.push({
        rowKey: 'flow-handles-target',
        labelId: `${idBase}-kv-flow-handles-target`,
        inPortNode: frontmatterInKeys.length > 0
          ? <section className="flex flex-col items-center gap-1">{frontmatterInKeys.map(k => renderFrontmatterPortButton('in', k))}</section>
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
    if (hasFlowSourceHandles || frontmatterOutKeys.length > 0) {
      rows.push({
        rowKey: 'flow-handles-source',
        labelId: `${idBase}-kv-flow-handles-source`,
        outPortNode: frontmatterOutKeys.length > 0
          ? <section className="flex flex-col items-center gap-1">{frontmatterOutKeys.map(k => renderFrontmatterPortButton('out', k))}</section>
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
    return rows
  }, [
    flowHandleKeys.source,
    flowHandleKeys.target,
    formatFlowHandlePathValue,
    frontmatterInKeys,
    frontmatterOutKeys,
    hasFlowSourceHandles,
    hasFlowTargetHandles,
    idBase,
    keyLabelClass,
    keyValueInputClass,
    monospaceTextClass,
    renderFlowContractDot,
    renderFrontmatterPortButton,
    renderKvTypeBox,
    textSizeClass,
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

      {compactPreview && (
        <section className="min-w-0 mt-4" aria-label="Widget output preview">
          <section
            className={cn(
              'w-full overflow-hidden rounded-lg border',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
            )}
            data-kg-widget-preview-kind={compactPreview.kind}
          >
            {compactPreview.kind === 'text' ? (
              <PlainTextInputEditor
                id={`${idBase}-compact-preview`}
                ariaLabel="Widget text output preview"
                value={compactPreview.text || ''}
                onChange={setCompactPreviewText}
                multiline
                readOnly={!compactPreview.editable}
                className={compactPreviewEditorClass}
              />
            ) : compactPreview.kind === 'image' ? (
              <img
                src={compactPreview.url}
                alt={String(node.label || node.id || 'Widget image output')}
                loading="lazy"
                className="block w-full h-48 object-contain"
              />
            ) : (
              <video
                src={compactPreview.url}
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
            rows={(() => {
              const rows: NodeOverlayEditorKvRow[] = [...frontmatterPortRows]

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
              const registrySchemaPaths = (() => {
                if (!registryEntry) return null
                const out = new Set<string>()
                const fields = Array.isArray(registryEntry.fields) ? registryEntry.fields : []
                for (let i = 0; i < fields.length; i += 1) {
                  const field = fields[i] as unknown as { fieldKey?: unknown; schemaPath?: unknown }
                  const fieldKey = String(field?.fieldKey || '').trim()
                  const schemaPath = normalizeRegistrySchemaPath(
                    typeof field?.schemaPath === 'string' ? field.schemaPath : undefined,
                    fieldKey,
                  )
                  if (schemaPath) out.add(schemaPath)
                }
                const ports = Array.isArray(registryEntry.ports) ? registryEntry.ports : []
                for (let i = 0; i < ports.length; i += 1) {
                  const port = ports[i] as unknown as { portKey?: unknown; schemaPath?: unknown }
                  const portKey = String(port?.portKey || '').trim()
                  const schemaPath = normalizeRegistrySchemaPath(
                    typeof port?.schemaPath === 'string' ? port.schemaPath : undefined,
                    portKey,
                  )
                  if (schemaPath) out.add(schemaPath)
                }
                return out
              })()
              if (declaredFields.length > 0) {
                for (let fieldIndex = 0; fieldIndex < declaredFields.length; fieldIndex += 1) {
                  const spec = declaredFields[fieldIndex]
                  if (!spec || typeof spec !== 'object') continue
                  const rec = spec as Record<string, unknown>
                  const fieldKey = String(rec.fieldKey || '').trim()
                  const fieldType = String(rec.fieldType || '').trim() || 'unknown'
                  const schemaPath = String(rec.schemaPath || fieldKey).trim()
                  if (!fieldKey || !schemaPath) continue
                  const normalizedSchemaPath = normalizeRegistrySchemaPath(schemaPath, fieldKey)
                  if (registrySchemaPaths?.has(normalizedSchemaPath)) continue
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
              }

              return rows
            })()}
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
          normalizeRegistrySchemaPath={normalizeRegistrySchemaPath}
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
          normalizeRegistrySchemaPath={normalizeRegistrySchemaPath}
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
          normalizeRegistrySchemaPath={normalizeRegistrySchemaPath}
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

      {!isRichMediaPanelWidget && !isFrontmatterFlow && !hideFields && registryEntry && !(
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
