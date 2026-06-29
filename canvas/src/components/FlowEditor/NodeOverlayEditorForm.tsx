import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import RichMediaPanel from '@/components/RichMediaPanel'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import {
  resolveMediaPreviewSurfaceCardProps,
  resolveMediaPreviewSurfaceSelectionProps,
} from '@/lib/cards/mediaPreviewSurfaceSelection'
import type { GraphNode, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  UI_COPY,
  UI_LABELS,
} from '@/lib/config'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_SCHEMA_FIELDS_PROPERTY_KEY,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
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
  applyWidgetFieldValueUpdate,
  coerceWidgetFieldValue,
  formatWidgetFieldValueText,
  normalizeWidgetFieldSchemaPath,
  readWidgetFieldValueText,
} from '@/features/flow-editor-manager/widgetFieldMutation'
import {
  applyWidgetCompactPreviewTextUpdate,
  buildWidgetCompactPreviewViewModel,
  resolveWidgetCompactPreview,
} from '@/features/flow-editor-manager/widgetCompactPreview'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import {
  formatFlowHandleAccessibleName,
  formatFlowHandleKtvKeyLabel,
  formatFlowHandleSemanticKey,
  readFlowHandlePath,
} from '@/lib/graph/flowHandlePresentation'
import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'
import { NodeOverlayEditorParamsSection } from '@/components/FlowEditor/NodeOverlayEditorParamsSection'
import { NodeOverlayEditorKvTable, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import { FlowEditorInlineValueEditor } from '@/components/FlowEditor/FlowEditorInlineValueEditor'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { NodeOverlayEditorBeatByBeatSection } from '@/components/FlowEditor/NodeOverlayEditorBeatByBeatSection'
import type { GraphEdge } from '@/lib/graph/types'
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import { PORT_HANDLE_STROKE_CLASS } from '@/components/FlowEditor/portHandleUi'
import {
  handleWidgetInnerPanelScrollCapture,
  handleWidgetInnerPanelWheelCapture,
  RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE,
} from '@/components/FlowEditor/flowWidgetOverlayShared'
import type { RichMediaWidgetPreviewState } from '@/components/FlowEditor/useRichMediaWidgetPreview'
import { hashArrayOfObjectsSignature, hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'
import {
  buildRichMediaPanelOverlayState,
  buildRichMediaPanelPreviewSpec,
  getRichMediaPanelNodeLabel,
} from '@/lib/render/richMediaSsot'
import { PANEL_FRAME_EMBEDDED_SURFACE_STYLE } from '@/lib/ui/panelFrame'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ChatModelCredentialControls } from '@/features/chat/ChatModelCredentialControls'
import { resolveSharedChatModelSelect } from '@/features/chat/chatModelCredentialResolver'
import { shouldRenderFloatingChatApiKeyPrompt } from '@/features/chat/floatingPanelChat/floatingPanelChatApiKeyPrompt'
import { getChatProviderLabel } from '@/lib/chatEndpoint'
import { cleanTimelinePreviewDocumentKey } from '@/components/timeline/useTimelinePreviewBootstrap'
import {
  TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT,
  type TimelineTransportPlaybackRequestDetail,
} from '@/components/timeline/videoSequenceTimeline'
import {
  resolveRichMediaTimelineDurationUnits,
  resolveRichMediaTimelineMediaTargetSeconds,
} from '@/lib/render/richMediaTimelineSync'

const EMPTY_GRAPH_EDGES: ReadonlyArray<GraphEdge> = []

type FrontmatterPortKvRow = NodeOverlayEditorKvRow & {
  dir: 'in' | 'out'
  portKey: string
  schemaPath: string
  normalizedSchemaPath: string
}

function buildWidgetRegistryEntrySemanticSignature(entry: WidgetRegistryEntry | null | undefined): string {
  if (!entry) return hashSignatureParts(['widget-registry-entry', 0])
  return hashSignatureParts([
    'widget-registry-entry',
    String(entry.id || '').trim(),
    String(entry.nodeTypeId || '').trim(),
    String(entry.widgetTypeId || '').trim(),
    String(entry.formId || '').trim(),
    String(entry.updatedAt || '').trim(),
    hashArrayOfObjectsSignature(entry.fields ?? [], {
      maxItems: Math.max(16, Array.isArray(entry.fields) ? entry.fields.length : 0),
      maxKeysPerItem: 8,
    }),
    hashArrayOfObjectsSignature(entry.ports ?? [], {
      maxItems: Math.max(16, Array.isArray(entry.ports) ? entry.ports.length : 0),
      maxKeysPerItem: 8,
    }),
  ])
}

function buildWidgetRegistryEntriesSemanticSignature(
  registryEntries: ReadonlyArray<WidgetRegistryEntry> | null | undefined,
): string {
  const entries = Array.isArray(registryEntries) ? registryEntries : []
  return hashArrayOfObjectsSignature(
    entries.map(entry => ({
      id: String(entry?.id || '').trim(),
      nodeTypeId: String(entry?.nodeTypeId || '').trim(),
      widgetTypeId: String(entry?.widgetTypeId || '').trim(),
      formId: String(entry?.formId || '').trim(),
      updatedAt: String(entry?.updatedAt || '').trim(),
      entrySignature: buildWidgetRegistryEntrySemanticSignature(entry),
    })),
    { maxItems: Math.max(24, entries.length), maxKeysPerItem: 6 },
  )
}

function buildGraphEdgesSemanticSignature(edges: ReadonlyArray<GraphEdge> | null | undefined): string {
  const edgeList = Array.isArray(edges) ? edges : []
  return hashArrayOfObjectsSignature(
    edgeList.map(edge => {
      const props =
        edge && typeof edge === 'object' && !Array.isArray(edge)
          ? ((edge as { properties?: unknown }).properties as Record<string, unknown> | null | undefined)
          : null
      return {
        id: String((edge as { id?: unknown })?.id || '').trim(),
        source: readEdgeEndpointId(edge?.source),
        target: readEdgeEndpointId(edge?.target),
        sourcePortKey:
          typeof props?.[FLOW_EDGE_SOURCE_PORT_KEY] === 'string'
            ? String(props?.[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
            : '',
        targetPortKey:
          typeof props?.[FLOW_EDGE_TARGET_PORT_KEY] === 'string'
            ? String(props?.[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
            : '',
      }
    }),
    { maxItems: Math.max(24, edgeList.length), maxKeysPerItem: 5 },
  )
}

function buildConnectedValuesSemanticSignature(
  connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | null | undefined,
): string {
  const record =
    connectedValuesBySchemaPath && typeof connectedValuesBySchemaPath === 'object' && !Array.isArray(connectedValuesBySchemaPath)
      ? (connectedValuesBySchemaPath as Record<string, unknown>)
      : {}
  const keys = Object.keys(record).sort()
  return hashArrayOfObjectsSignature(
    keys.map(path => {
      const entry = record[path] as Record<string, unknown> | null | undefined
      const value = entry?.value
      return {
        path,
        valueType: typeof value,
        valueText:
          typeof value === 'string'
            ? value
            : typeof value === 'number' && Number.isFinite(value)
              ? String(value)
              : typeof value === 'boolean'
                ? (value ? '1' : '0')
                : '',
        valueSignature: hashRecordSignature32(value, { maxEntries: 60, maxDepth: 2 }),
      }
    }),
    { maxItems: Math.max(24, keys.length), maxKeysPerItem: 4 },
  )
}

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
  richMediaWidgetPreview,
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
  richMediaWidgetPreview?: RichMediaWidgetPreviewState
  registryEntry?: WidgetRegistryEntry | null
  registryEntries?: ReadonlyArray<WidgetRegistryEntry>
}) {
  const { panelTextClass, microLabelClass, monospaceTextClass, textSizeClass, keyValueInputClass, keyLabelClass } = usePanelTypography()
  const {
    chatProvider,
    chatAuthMode,
    chatApiKey,
    setChatApiKey,
    chatModel,
    selectNode,
    setSelectionSource,
    timelineTransportDocumentKey,
    timelineTransportPosition,
    timelineTransportPlaying,
    timelineTransportPlaybackRate,
    markdownDocumentName,
    graphData,
    graphDataRevision,
  } = useGraphStore(
    useShallow(s => ({
      chatProvider: s.chatProvider,
      chatAuthMode: s.chatAuthMode,
      chatApiKey: s.chatApiKey,
      setChatApiKey: s.setChatApiKey,
      chatModel: s.chatModel,
      selectNode: s.selectNode,
      setSelectionSource: s.setSelectionSource,
      timelineTransportDocumentKey: s.timelineTransportDocumentKey || '',
      timelineTransportPosition: Number.isFinite(s.timelineTransportPosition) ? s.timelineTransportPosition : 0,
      timelineTransportPlaying: s.timelineTransportPlaying === true,
      timelineTransportPlaybackRate: s.timelineTransportPlaybackRate || 1,
      markdownDocumentName: s.markdownDocumentName || '',
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision || 0,
    })),
  )
  void onSetType
  void onValidate
  const properties = readNodeProperties(node)
  const propertiesSignature = React.useMemo(() => {
    return hashRecordSignature32(properties, { maxEntries: 80, maxDepth: 2 })
  }, [properties])
  const propertiesSnapshotRef = React.useRef<{ key: number; value: Record<string, unknown> } | null>(null)
  if (propertiesSnapshotRef.current?.key !== propertiesSignature) {
    propertiesSnapshotRef.current = {
      key: propertiesSignature,
      value: properties,
    }
  }
  const propertiesSnapshot = propertiesSnapshotRef.current.value
  const nodeTypeId = pickString(node.type).trim()
  const nodeHelperSignature = React.useMemo(() => {
    return hashSignatureParts([
      'node-overlay-editor-form-node',
      String(node.id || '').trim(),
      nodeTypeId,
      String(node.label || '').trim(),
      propertiesSignature,
    ])
  }, [node.id, node.label, nodeTypeId, propertiesSignature])
  const nodeHelperSnapshotRef = React.useRef<{
    key: string
    value: Pick<GraphNode, 'id' | 'type' | 'label' | 'properties'>
  } | null>(null)
  if (nodeHelperSnapshotRef.current?.key !== nodeHelperSignature) {
    nodeHelperSnapshotRef.current = {
      key: nodeHelperSignature,
      value: {
        id: node.id,
        type: node.type,
        label: node.label,
        properties: propertiesSnapshot as Record<string, JSONValue>,
      },
    }
  }
  const nodeHelperSnapshot = nodeHelperSnapshotRef.current.value
  const selectCompactMediaPreviewNode = React.useCallback((event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const id = String(nodeHelperSnapshot.id || '').trim()
    if (!id) return
    setSelectionSource('editor')
    selectNode(id)
  }, [nodeHelperSnapshot.id, selectNode, setSelectionSource])
  const safeEdges = edges || EMPTY_GRAPH_EDGES
  const edgesSignature = React.useMemo(() => buildGraphEdgesSemanticSignature(safeEdges), [safeEdges])
  const edgesSnapshotRef = React.useRef<{ key: string; value: ReadonlyArray<GraphEdge> } | null>(null)
  if (edgesSnapshotRef.current?.key !== edgesSignature) {
    edgesSnapshotRef.current = {
      key: edgesSignature,
      value: safeEdges,
    }
  }
  const edgesSnapshot = edgesSnapshotRef.current.value
  const registryEntrySignature = React.useMemo(
    () => buildWidgetRegistryEntrySemanticSignature(registryEntry),
    [registryEntry],
  )
  const registryEntrySnapshotRef = React.useRef<{ key: string; value: WidgetRegistryEntry | null } | null>(null)
  if (registryEntrySnapshotRef.current?.key !== registryEntrySignature) {
    registryEntrySnapshotRef.current = {
      key: registryEntrySignature,
      value: registryEntry ?? null,
    }
  }
  const registryEntrySnapshot = registryEntrySnapshotRef.current.value
  const registryEntriesSignature = React.useMemo(
    () => buildWidgetRegistryEntriesSemanticSignature(registryEntries),
    [registryEntries],
  )
  const registryEntriesSnapshotRef = React.useRef<{ key: string; value: ReadonlyArray<WidgetRegistryEntry> } | null>(null)
  if (registryEntriesSnapshotRef.current?.key !== registryEntriesSignature) {
    registryEntriesSnapshotRef.current = {
      key: registryEntriesSignature,
      value: registryEntries,
    }
  }
  const registryEntriesSnapshot = registryEntriesSnapshotRef.current.value
  const connectedValuesSignature = React.useMemo(
    () => buildConnectedValuesSemanticSignature(connectedValuesBySchemaPath),
    [connectedValuesBySchemaPath],
  )
  const connectedValuesSnapshotRef = React.useRef<{
    key: string
    value: FlowConnectedValuesBySchemaPath | undefined
  } | null>(null)
  if (connectedValuesSnapshotRef.current?.key !== connectedValuesSignature) {
    connectedValuesSnapshotRef.current = {
      key: connectedValuesSignature,
      value: connectedValuesBySchemaPath,
    }
  }
  const connectedValuesSnapshot = connectedValuesSnapshotRef.current.value
  const isRichMediaPanelWidget = nodeTypeId === 'RichMediaPanel'
  const widgetModelSelect = React.useMemo(() => resolveSharedChatModelSelect({
    chatProvider,
    chatModel: pickString(propertiesSnapshot.chatModel).trim() || chatModel,
  }), [chatModel, chatProvider, propertiesSnapshot.chatModel])
  const widgetApiKeyPrompt = React.useMemo(() => {
    if (!shouldRenderFloatingChatApiKeyPrompt({ chatAuthMode, chatProvider })) return null
    return {
      providerLabel: getChatProviderLabel(chatProvider),
      value: chatApiKey || '',
      onChange: setChatApiKey,
    }
  }, [chatApiKey, chatAuthMode, chatProvider, setChatApiKey])
  const idBase = React.useMemo(() => {
    const nodeId = cleanDomIdPart(nodeHelperSnapshot.id) || 'node'
    return `flow-node-quick-${nodeId}`
  }, [nodeHelperSnapshot.id])

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
  const liveNodeLabel = String(nodeHelperSnapshot.label || '')
  const labelEditInProgressRef = React.useRef(false)
  const [labelDraft, setLabelDraft] = React.useState(liveNodeLabel)
  React.useEffect(() => {
    if (labelEditInProgressRef.current) return
    setLabelDraft(liveNodeLabel)
  }, [liveNodeLabel])
  const commitLabelDraft = React.useCallback((nextDraft?: string) => {
    const nextLabel = typeof nextDraft === 'string' ? nextDraft : labelDraft
    if (nextLabel === liveNodeLabel) return
    onSetLabel(nextLabel)
  }, [labelDraft, liveNodeLabel, onSetLabel])

  const schemaFields = React.useMemo(() => readSchemaFieldSpecs(nodeHelperSnapshot), [nodeHelperSnapshot])
  const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'
  const showRichMediaPanelViewer = isRichMediaPanelWidget && !hideFields
  const showRichMediaPanelKtvRows = isRichMediaPanelWidget && hideFields && !isFrontmatterFlow
  const portHandlesEnabled = Boolean(schema?.behavior?.portHandles?.enabled) || isFrontmatterFlow
  const fallbackRichMediaPanelState = React.useMemo(() => {
    if (!showRichMediaPanelViewer || richMediaWidgetPreview?.richMediaPanelState) return null
    return buildRichMediaPanelOverlayState({
      node: nodeHelperSnapshot as GraphNode,
      connectedValuesBySchemaPath: connectedValuesSnapshot,
    }) || null
  }, [connectedValuesSnapshot, nodeHelperSnapshot, richMediaWidgetPreview?.richMediaPanelState, showRichMediaPanelViewer])
  const richMediaPanelState = richMediaWidgetPreview?.richMediaPanelState || fallbackRichMediaPanelState
  const fallbackRichMediaPreview = React.useMemo(() => {
    if (!showRichMediaPanelViewer || richMediaWidgetPreview?.richMediaPreview || !richMediaPanelState) return null
    return buildRichMediaPanelPreviewSpec({
      node: nodeHelperSnapshot as GraphNode,
      connectedValuesBySchemaPath: connectedValuesSnapshot,
      panel: richMediaPanelState,
    })
  }, [connectedValuesSnapshot, nodeHelperSnapshot, richMediaPanelState, richMediaWidgetPreview?.richMediaPreview, showRichMediaPanelViewer])
  const richMediaPreview = richMediaWidgetPreview?.richMediaPreview || fallbackRichMediaPreview
  const richMediaPanelViewSize = richMediaWidgetPreview?.richMediaPanelViewSize || RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE
  const handleRichMediaPanelChange = richMediaWidgetPreview?.handleRichMediaPanelChange
  const handleRichMediaResizeStart = richMediaWidgetPreview?.handleRichMediaResizeStart
  const handleRichMediaResize = richMediaWidgetPreview?.handleRichMediaResize
  const handleRichMediaResizeEnd = richMediaWidgetPreview?.handleRichMediaResizeEnd
  const handleRichMediaContentSize = richMediaWidgetPreview?.handleRichMediaContentSize
  const handleFallbackRichMediaResize = React.useCallback(() => {
    emitFlowEditorInteractionFrame()
  }, [])

  const flowEnvelopeValueBoxClass = React.useMemo(() => {
    return cn(
      textSizeClass,
      'text-left',
      monospaceTextClass,
      UI_THEME_TOKENS.input.bg,
      UI_THEME_TOKENS.input.border,
      UI_THEME_TOKENS.input.text,
    )
  }, [monospaceTextClass, textSizeClass])
  const frontmatterWidgetRegistrySection = React.useMemo(
    () => resolveFrontmatterWidgetRegistrySectionState({
      node: nodeHelperSnapshot,
      registryEntry: registryEntrySnapshot,
      graphMetaKind,
    }),
    [graphMetaKind, nodeHelperSnapshot, registryEntrySnapshot],
  )
  const showFrontmatterWidgetRegistrySection = frontmatterWidgetRegistrySection.visible
  const hideFrontmatterFlowContractRows = frontmatterWidgetRegistrySection.hideFlowContractRows
  const frontmatterWidgetIdentityLabel = frontmatterWidgetRegistrySection.identityLabel
  const frontmatterContract = React.useMemo(() => {
    return buildFrontmatterWidgetContractModel({
      node: nodeHelperSnapshot,
      edges: edgesSnapshot,
      registryEntry: registryEntrySnapshot,
      suppressRegistryBackedDeclaredFields: showFrontmatterWidgetRegistrySection,
    })
  }, [edgesSnapshot, nodeHelperSnapshot, registryEntrySnapshot, showFrontmatterWidgetRegistrySection])
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
  const registryOptions = React.useMemo(
    () => {
      return listScopedWidgetRegistryEntries({
        node: nodeHelperSnapshot,
        registry: registryEntriesSnapshot,
        graphMetaKind,
      })
    },
    [graphMetaKind, nodeHelperSnapshot, registryEntriesSnapshot],
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
    if (!hideFields) return null
    return resolveWidgetCompactPreview({
      node: nodeHelperSnapshot as GraphNode,
      registryEntry: registryEntrySnapshot,
      connectedValuesBySchemaPath: connectedValuesSnapshot,
    })
  }, [connectedValuesSnapshot, hideFields, nodeHelperSnapshot, registryEntrySnapshot])
  const compactPreviewView = React.useMemo(() => {
    return buildWidgetCompactPreviewViewModel({
      preview: compactPreview,
      node: nodeHelperSnapshot,
    })
  }, [compactPreview, nodeHelperSnapshot])
  const compactMediaPreviewSelectionProps = React.useMemo(
    () => resolveMediaPreviewSurfaceSelectionProps({
      enabled: !!compactPreviewView && compactPreviewView.kind !== 'text',
      ariaLabel: compactPreviewView && compactPreviewView.kind !== 'text'
        ? `${String(nodeHelperSnapshot.label || getRichMediaPanelNodeLabel())} media preview`
        : undefined,
      onSelect: selectCompactMediaPreviewNode,
    }),
    [compactPreviewView, nodeHelperSnapshot.label, selectCompactMediaPreviewNode],
  )
  const compactMediaPreviewCardProps = React.useMemo(
    () => resolveMediaPreviewSurfaceCardProps({
      enabled: !!compactPreviewView && compactPreviewView.kind !== 'text',
      interactive: compactPreviewView?.kind === 'video' || compactPreviewView?.kind === 'audio',
    }),
    [compactPreviewView],
  )
  const compactPreviewMediaElementRef = React.useRef<HTMLMediaElement | null>(null)
  const [compactPreviewMediaElement, setCompactPreviewMediaElement] = React.useState<HTMLMediaElement | null>(null)
  const timelineDocumentKey = React.useMemo(
    () => cleanTimelinePreviewDocumentKey(markdownDocumentName),
    [markdownDocumentName],
  )
  const timelineDurationUnits = React.useMemo(
    () => resolveRichMediaTimelineDurationUnits(graphData),
    [graphData, graphDataRevision],
  )
  const compactPreviewKind = compactPreviewView?.kind || 'text'
  const compactPreviewIsPlayableMedia = compactPreviewKind === 'video' || compactPreviewKind === 'audio'
  const compactPreviewMediaUrl = compactPreviewView && compactPreviewView.kind !== 'text'
    ? compactPreviewView.mediaUrl
    : ''
  const compactPreviewMediaElementHandler = React.useCallback((element: HTMLMediaElement | null) => {
    compactPreviewMediaElementRef.current = element
    setCompactPreviewMediaElement(prev => (prev === element ? prev : element))
  }, [])
  const syncCompactPreviewMediaToTimeline = React.useCallback((
    media: HTMLMediaElement,
    override?: Partial<TimelineTransportPlaybackRequestDetail>,
  ) => {
    if (!compactPreviewIsPlayableMedia) return
    const documentKey = cleanTimelinePreviewDocumentKey(override?.documentKey || timelineTransportDocumentKey)
    if (!timelineDocumentKey || documentKey !== timelineDocumentKey) return
    const positionSource = typeof override?.position === 'number' ? override.position : timelineTransportPosition
    const playing = typeof override?.playing === 'boolean' ? override.playing : timelineTransportPlaying
    const playbackRateSource = typeof override?.playbackRate === 'number' ? override.playbackRate : timelineTransportPlaybackRate
    const playbackRate = Number.isFinite(playbackRateSource) && playbackRateSource > 0 ? playbackRateSource : 1
    const mediaDuration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0
    const targetSecondsRaw = resolveRichMediaTimelineMediaTargetSeconds({
      mediaDurationSeconds: mediaDuration,
      positionUnits: Number.isFinite(positionSource) ? Math.max(0, positionSource) : 0,
      timelineDurationUnits,
    })
    const targetSeconds = mediaDuration > 0 ? Math.min(mediaDuration, targetSecondsRaw) : targetSecondsRaw
    const currentTime = Number.isFinite(media.currentTime) ? media.currentTime : 0
    if (!playing || Math.abs(currentTime - targetSeconds) > 0.18) {
      try {
        media.currentTime = targetSeconds
      } catch {
        void 0
      }
    }
    if (media.playbackRate !== playbackRate) media.playbackRate = playbackRate
    if (playing) {
      if (media.paused) {
        try {
          const maybePromise = media.play()
          if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(() => undefined)
        } catch {
          void 0
        }
      }
      return
    }
    if (!media.paused) {
      try {
        media.pause()
      } catch {
        void 0
      }
    }
  }, [
    compactPreviewIsPlayableMedia,
    timelineDocumentKey,
    timelineDurationUnits,
    timelineTransportDocumentKey,
    timelineTransportPlaybackRate,
    timelineTransportPlaying,
    timelineTransportPosition,
  ])
  React.useEffect(() => {
    if (!compactPreviewIsPlayableMedia) return
    const media = compactPreviewMediaElement || compactPreviewMediaElementRef.current
    if (!media) return
    const syncCompactPreviewMedia = () => syncCompactPreviewMediaToTimeline(media)
    syncCompactPreviewMedia()
    media.addEventListener('loadedmetadata', syncCompactPreviewMedia)
    media.addEventListener('durationchange', syncCompactPreviewMedia)
    return () => {
      media.removeEventListener('loadedmetadata', syncCompactPreviewMedia)
      media.removeEventListener('durationchange', syncCompactPreviewMedia)
    }
  }, [
    compactPreviewIsPlayableMedia,
    compactPreviewMediaElement,
    compactPreviewMediaUrl,
    syncCompactPreviewMediaToTimeline,
  ])
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePlaybackRequest = (event: Event) => {
      const detail = (event as CustomEvent<TimelineTransportPlaybackRequestDetail>).detail
      if (!detail || cleanTimelinePreviewDocumentKey(detail.documentKey) !== timelineDocumentKey) return
      const media = compactPreviewMediaElementRef.current
      if (media) syncCompactPreviewMediaToTimeline(media, detail)
    }
    window.addEventListener(TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT, handlePlaybackRequest)
    return () => window.removeEventListener(TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT, handlePlaybackRequest)
  }, [
    syncCompactPreviewMediaToTimeline,
    timelineDocumentKey,
  ])

  const compactPreviewEditorClass = React.useMemo(() => {
    return cn(
      'w-full h-40 rounded-md border px-2 py-2 overflow-y-auto overflow-x-hidden',
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

  const renderFrontmatterPortButton = React.useCallback((
    dir: 'in' | 'out',
    portKey: string,
    accessibleName?: string,
    schemaPath?: string,
  ) => {
    const aria = String(accessibleName || '').trim() || formatFlowHandleSemanticKey({ dir, portKey })
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
        data-kg-port-schema-path={String(schemaPath || '').trim() || undefined}
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
  const frontmatterEnvelopeFieldSchemaPathSet = React.useMemo(() => {
    const out = new Set<string>()
    frontmatterContractRowSpecs.envelopeRows.forEach(rowSpec => {
      if (rowSpec.kind !== 'field') return
      const schemaPath = normalizeWidgetFieldSchemaPath(rowSpec.schemaPath, rowSpec.fieldKey)
      if (schemaPath) out.add(schemaPath)
    })
    return out
  }, [frontmatterContractRowSpecs.envelopeRows])
  const frontmatterPortRows = React.useMemo<FrontmatterPortKvRow[]>(() => {
    return frontmatterContractRowSpecs.handleRows.flatMap(rowSpec => {
      const portKeys = rowSpec.portKeys
        .map(portKey => String(portKey || '').trim())
        .filter(Boolean)
      if (portKeys.length === 0) return []
      const occurrenceCounts = new Map<string, number>()
      portKeys.forEach(portKey => {
        occurrenceCounts.set(portKey, (occurrenceCounts.get(portKey) || 0) + 1)
      })
      const occurrenceIndexes = new Map<string, number>()
      return portKeys.map((portKey, index) => {
        const occurrenceCount = occurrenceCounts.get(portKey) || 1
        const occurrenceIndex = occurrenceIndexes.get(portKey) || 0
        occurrenceIndexes.set(portKey, occurrenceIndex + 1)
        const schemaPath = portKey
        const normalizedSchemaPath = normalizeWidgetFieldSchemaPath(schemaPath, portKey)
        const accessibleName = formatFlowHandleAccessibleName({
          dir: rowSpec.dir,
          portKey,
          schemaPath,
          occurrenceIndex,
          occurrenceCount,
        })
        const rowKey = `${rowSpec.rowKey}-${index}-${cleanDomIdPart(portKey) || 'port'}`
        const inputId = `${idBase}-${rowKey}`
        const portButton = renderFrontmatterPortButton(rowSpec.dir, portKey, accessibleName, schemaPath)
        const keyLabel = formatFlowHandleKtvKeyLabel({ dir: rowSpec.dir, portKey }) || accessibleName
        const connectedPortValue = rowSpec.dir === 'in'
          ? connectedValuesSnapshot?.[normalizedSchemaPath]?.value
          : undefined
        const connectedPortValueText = typeof connectedPortValue !== 'undefined'
          ? formatWidgetFieldValueText(connectedPortValue)
          : ''
        const portValueText = readWidgetFieldValueText({
          properties: propertiesSnapshot,
          schemaPath,
          fallbackKey: portKey,
        })
        return {
          rowKey,
          dir: rowSpec.dir,
          portKey,
          schemaPath,
          normalizedSchemaPath,
          labelId: `${idBase}-kv-${rowKey}`,
          inPortNode: rowSpec.dir === 'in' ? portButton : undefined,
          outPortNode: rowSpec.dir === 'out' ? portButton : undefined,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId} title={accessibleName || keyLabel}>
              {keyLabel}
            </label>
          ),
          valueNode: (
            <PlainTextInputEditor
              id={inputId}
              data-kg-authored-value-contract="value={portValueText}"
              value={portValueText || connectedPortValueText}
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
    })
  }, [
    frontmatterContractRowSpecs.handleRows,
    idBase,
    keyLabelClass,
    keyValueInputClass,
    monospaceTextClass,
    connectedValuesSnapshot,
    propertiesSnapshot,
    renderFrontmatterPortButton,
    textSizeClass,
  ])
  const frontmatterFieldPortNodesBySchemaPath = React.useMemo(() => {
    const out = new Map<string, Pick<NodeOverlayEditorKvRow, 'inPortNode' | 'outPortNode'>>()
    frontmatterPortRows.forEach(row => {
      if (!row.normalizedSchemaPath || !frontmatterEnvelopeFieldSchemaPathSet.has(row.normalizedSchemaPath)) return
      const current = out.get(row.normalizedSchemaPath) || {}
      out.set(row.normalizedSchemaPath, {
        ...current,
        ...(row.dir === 'in' ? { inPortNode: row.inPortNode } : { outPortNode: row.outPortNode }),
      })
    })
    return out
  }, [frontmatterEnvelopeFieldSchemaPathSet, frontmatterPortRows])
  const frontmatterEnvelopeRows = React.useMemo<NodeOverlayEditorKvRow[]>(() => {
    return frontmatterContractRowSpecs.envelopeRows.flatMap<NodeOverlayEditorKvRow>((rowSpec, fieldIndex) => {
      if (rowSpec.kind === 'handle') {
        return frontmatterPortRows.filter(row => (
          (row.rowKey === rowSpec.rowKey || row.rowKey.startsWith(`${rowSpec.rowKey}-`))
          && !frontmatterEnvelopeFieldSchemaPathSet.has(row.normalizedSchemaPath)
        ))
      }
      const inputId = `${idBase}-${rowSpec.rowKey}`
      // data-row contract marker: rowKey: 'flow-data'
      if (rowSpec.kind === 'data' || rowSpec.rowKey === 'flow-data') {
        return [{
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          showInPortDot: false,
          showOutPortDot: false,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
              {rowSpec.fieldKey}
            </label>
          ),
          valueNode: (
            <FlowEditorInlineValueEditor
              id={inputId}
              value={flowDataDraft}
              active={active}
              multiline
              className={flowEnvelopeValueBoxClass}
              onCommit={next => {
                const raw = String(next ?? '')
                setFlowDataDraft(raw)
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
            />
          ),
        }]
      }
      // compute-row contract marker: rowKey: 'flow-compute'
      if (rowSpec.kind === 'compute' || rowSpec.rowKey === 'flow-compute') {
        return [{
          rowKey: rowSpec.rowKey,
          labelId: `${idBase}-kv-${rowSpec.rowKey}`,
          showInPortDot: false,
          showOutPortDot: false,
          keyNode: (
            <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
              {rowSpec.fieldKey}
            </label>
          ),
          valueNode: (
            <FlowEditorInlineValueEditor
              id={inputId}
              value={flowCompute}
              active={active}
              multiline
              className={flowEnvelopeValueBoxClass}
              onCommit={next => onPatchProperties({ 'flow:compute': next || undefined })}
            />
          ),
        }]
      }
      const fieldSchemaPath = normalizeWidgetFieldSchemaPath(
        rowSpec.kind === 'field' ? rowSpec.schemaPath : '',
        rowSpec.fieldKey,
      )
      const mergedPortNodes = frontmatterFieldPortNodesBySchemaPath.get(fieldSchemaPath)
      return [{
        rowKey: rowSpec.rowKey,
        labelId: `${idBase}-kv-flow-envelope-field-${fieldIndex}`,
        inPortNode: mergedPortNodes?.inPortNode,
        outPortNode: mergedPortNodes?.outPortNode,
        keyNode: (
          <label className={cn(keyLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor={inputId}>
            {rowSpec.fieldKey}
          </label>
        ),
        valueNode: (
          <FlowEditorInlineValueEditor
            id={inputId}
            value={rowSpec.valueText}
            active={active}
            multiline
            className={flowEnvelopeValueBoxClass}
            onCommit={next => {
              if (!fieldSchemaPath) return
              const raw = String(next ?? '')
              const nextValue = raw.trim()
                ? coerceWidgetFieldValue({ fieldType: rowSpec.typeLabel, value: raw })
                : undefined
              onSetProperties(applyWidgetFieldValueUpdate({
                properties: propertiesSnapshot,
                schemaPath: fieldSchemaPath,
                nextValue,
              }))
            }}
          />
        ),
      }]
    }).filter(Boolean) as NodeOverlayEditorKvRow[]
  }, [
    active,
    flowCompute,
    flowDataDraft,
    flowEnvelopeValueBoxClass,
    frontmatterContractRowSpecs.envelopeRows,
    frontmatterEnvelopeFieldSchemaPathSet,
    frontmatterFieldPortNodesBySchemaPath,
    frontmatterPortRows,
    idBase,
    keyLabelClass,
    onPatchProperties,
    onSetProperties,
    propertiesSnapshot,
  ])

  return (
    <form
      data-kg-media-scroll-surface="1"
      className={cn(
        UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME,
        'py-0',
        'px-3',
        panelTextClass,
      )}
      aria-label={UI_LABELS.flowWidgetForm}
      onSubmit={e => e.preventDefault()}
      onScrollCapture={() => handleWidgetInnerPanelScrollCapture(emitInteractionFrame)}
      onWheelCapture={e => handleWidgetInnerPanelWheelCapture(e, emitInteractionFrame)}
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
                  value={labelDraft}
                  onFocus={() => {
                    labelEditInProgressRef.current = true
                  }}
                  onChange={e => {
                    const nextLabel = String(e.target.value || '')
                    setLabelDraft(nextLabel)
                  }}
                  onBlur={e => {
                    labelEditInProgressRef.current = false
                    const nextLabel = String(e.currentTarget.value || '')
                    setLabelDraft(nextLabel)
                    commitLabelDraft(nextLabel)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const nextLabel = String(e.currentTarget.value || '')
                      labelEditInProgressRef.current = false
                      setLabelDraft(nextLabel)
                      commitLabelDraft(nextLabel)
                      e.currentTarget.blur()
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      labelEditInProgressRef.current = false
                      setLabelDraft(liveNodeLabel)
                      e.currentTarget.blur()
                    }
                  }}
                  disabled={!active}
                />
              ),
            },
          ]}
        />
      </section>

      <section
        className="min-w-0 mt-4 space-y-1"
        aria-label={`Model for flow widget ${String(nodeHelperSnapshot.label || nodeHelperSnapshot.id || '')}`}
      >
        <p className={cn('m-0 text-[10px] font-semibold uppercase tracking-[0.08em]', UI_THEME_TOKENS.text.tertiary)}>
          {UI_COPY.chatModelSelectLabel}
        </p>
        <ChatModelCredentialControls
          apiKeyPrompt={widgetApiKeyPrompt}
          modelId={widgetModelSelect.modelId}
          modelOptions={widgetModelSelect.options}
          onModelChanged={nextModel => onPatchProperties({ chatModel: nextModel })}
          disabled={!active}
          uiPanelMicroLabelTextSizeClass={microLabelClass}
        />
      </section>

      {showRichMediaPanelViewer && (
        <section
          data-kg-widget-body="1"
          data-kg-rich-media-render-surface="1"
          data-kg-rich-media-scroll-owner="panel"
          data-kg-media-scroll-surface="1"
          className="relative min-h-0 mt-4 overflow-y-auto overflow-x-hidden"
          style={{
            width: `${richMediaPanelViewSize.width}px`,
            maxWidth: '100%',
            height: `${richMediaPanelViewSize.height}px`,
            overscrollBehaviorX: 'none',
            overscrollBehaviorY: 'contain',
            pointerEvents: 'auto',
            scrollbarGutter: 'stable',
          }}
        >
          <RichMediaPanel
            overlayId={String(nodeHelperSnapshot.id || '')}
            title={String(nodeHelperSnapshot.label || getRichMediaPanelNodeLabel())}
            url={richMediaPreview?.url || ''}
            srcDoc={richMediaPreview?.srcDoc}
            openUrl={richMediaPreview?.openUrl || richMediaPreview?.url || ''}
            kind={richMediaPreview?.kind || 'iframe'}
            interactive={richMediaPreview?.interactive !== false}
            resizable={true}
            onResizeStart={handleRichMediaResizeStart || handleFallbackRichMediaResize}
            onResize={handleRichMediaResize || handleFallbackRichMediaResize}
            onResizeEnd={handleRichMediaResizeEnd || handleFallbackRichMediaResize}
            panel={richMediaPanelState || undefined}
            widgetToolbarActive={false}
            onPanelChange={handleRichMediaPanelChange}
            frameMode="surface"
            scrollOwner="panel"
            flowEditorInteractionMode={true}
            flowEditorFrontmatterDocumentMode={isFrontmatterFlow}
            onInlineContentSize={handleRichMediaContentSize}
            style={PANEL_FRAME_EMBEDDED_SURFACE_STYLE}
          />
        </section>
      )}

      {compactPreview && compactPreviewView && (
        <section className="min-w-0 mt-4" aria-label={compactPreviewView.sectionAriaLabel}>
          <section
            className={cn(
              'w-full overflow-hidden rounded-lg border',
              UI_THEME_TOKENS.input.bg,
              UI_THEME_TOKENS.input.border,
            )}
            data-kg-widget-preview-kind={compactPreviewView.kind}
            {...compactMediaPreviewSelectionProps}
          >
            {compactPreviewView.kind === 'text' ? (
              <CardInlineTextEditor
                value={compactPreviewView.textValue}
                ariaLabel={compactPreviewView.textAriaLabel}
                placeholder="Add preview text"
                canEdit={active && !compactPreviewView.readOnly}
                editActivation="click"
                multiline
                rows={6}
                markdownPreview="auto"
                onCommit={setCompactPreviewText}
                displayClassName={compactPreviewEditorClass}
                editorClassName={compactPreviewEditorClass}
              />
            ) : (
              <CardMediaPreview
                kind={compactPreviewView.kind}
                url={compactPreviewView.mediaUrl}
                title={
                  compactPreviewView.kind === 'image'
                    ? compactPreviewView.mediaAlt
                    : String(nodeHelperSnapshot.label || getRichMediaPanelNodeLabel())
                }
                {...compactMediaPreviewCardProps}
                fit="contain"
                className="block h-48 w-full"
                mediaClassName="block h-48 w-full"
                videoControls={compactMediaPreviewCardProps.interactive && compactPreviewView.kind === 'video'}
                onMediaElement={compactPreviewIsPlayableMedia ? compactPreviewMediaElementHandler : undefined}
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

      {!isRichMediaPanelWidget && (
        <NodeOverlayEditorBeatByBeatSection
          node={node}
          graphMetaKind={graphMetaKind}
          edges={edgesSnapshot}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          compact={hideFields}
        />
      )}

      {showRichMediaPanelKtvRows && registryEntrySnapshot && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={propertiesSnapshot}
          registryEntry={registryEntrySnapshot}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesSnapshot}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows
          showPortRows
          showTableHeader
        />
      )}

      {showFrontmatterWidgetRegistrySection && registryEntrySnapshot && (
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

      {showFrontmatterWidgetRegistrySection && registryEntrySnapshot && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={propertiesSnapshot}
          registryEntry={registryEntrySnapshot}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesSnapshot}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows
          showPortRows
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && hideFields && registryEntrySnapshot && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={propertiesSnapshot}
          registryEntry={registryEntrySnapshot}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesSnapshot}
          onSetProperties={onSetProperties}
          onSchemaPortHandleClick={onSchemaPortHandleClick}
          showFieldRows={false}
          showPortRows
        />
      )}

      {!isRichMediaPanelWidget && !isFrontmatterFlow && !hideFields && registryEntrySnapshot && (
        <NodeOverlayEditorRegistrySection
          active={active}
          properties={propertiesSnapshot}
          registryEntry={registryEntrySnapshot}
          microLabelClass={microLabelClass}
          monospaceTextClass={monospaceTextClass}
          textSizeClass={textSizeClass}
          keyValueInputClass={keyValueInputClass}
          keyLabelClass={keyLabelClass}
          ids={{ registryField: ids.registryField }}
          dotSizePx={dotSizePx}
          dotHitPx={dotHitPx}
          portHandlesEnabled={portHandlesEnabled}
          connectedValuesBySchemaPath={connectedValuesSnapshot}
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

      {!isRichMediaPanelWidget && !isFrontmatterFlow && (schemaFields.length > 0 || (registryEntrySnapshot?.widgetTypeId || '').toLowerCase().includes('schema')) && (
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
