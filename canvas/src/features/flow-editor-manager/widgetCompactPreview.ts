import type { GraphNode } from '@/lib/graph/types'
import { readNodeProperties, readNodePropertyPathValue } from '@/lib/graph/nodeProperties'
import { inferMediaKindFromResourceUrl } from '@/lib/graph/mediaUrlKind'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { inferWidgetAutoRenderKind } from '@/lib/flowEditor/widgetAutoRender'
import { setObjectPath } from '@/lib/data/objectPath'
import { FRONTMATTER_FLOW_WIDGET_FIELDS_KEY } from '@/features/parsers/markdownFrontmatterFlowGraph.flowBlock'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export type WidgetCompactPreviewKind = 'text' | 'image' | 'video'

export type WidgetCompactPreviewSpec = {
  kind: WidgetCompactPreviewKind
  schemaPath: string
  portKey: string
  source: 'connected' | 'local'
  editable: boolean
  text?: string
  url?: string
}

export type WidgetCompactPreviewViewModel =
  | {
      kind: 'text'
      sectionAriaLabel: 'Widget output preview'
      textAriaLabel: 'Widget text output preview'
      textValue: string
      readOnly: boolean
    }
  | {
      kind: 'image'
      sectionAriaLabel: 'Widget output preview'
      mediaUrl: string
      mediaAlt: string
    }
  | {
      kind: 'video'
      sectionAriaLabel: 'Widget output preview'
      mediaUrl: string
    }

export function isEditableWidgetCompactPreviewText(
  preview: WidgetCompactPreviewSpec | null | undefined,
): preview is WidgetCompactPreviewSpec & { kind: 'text' } {
  return preview?.kind === 'text' && preview.editable === true
}

export function buildWidgetCompactPreviewViewModel(args: {
  preview: WidgetCompactPreviewSpec | null | undefined
  node: Pick<GraphNode, 'id' | 'label'> | null | undefined
}): WidgetCompactPreviewViewModel | null {
  const preview = args.preview
  if (!preview) return null
  if (preview.kind === 'text') {
    return {
      kind: 'text',
      sectionAriaLabel: 'Widget output preview',
      textAriaLabel: 'Widget text output preview',
      textValue: String(preview.text || ''),
      readOnly: !isEditableWidgetCompactPreviewText(preview),
    }
  }
  if (preview.kind === 'image') {
    return {
      kind: 'image',
      sectionAriaLabel: 'Widget output preview',
      mediaUrl: String(preview.url || ''),
      mediaAlt: String(args.node?.label || args.node?.id || 'Widget image output'),
    }
  }
  return {
    kind: 'video',
    sectionAriaLabel: 'Widget output preview',
    mediaUrl: String(preview.url || ''),
  }
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
  const properties = readNodeProperties(args.node)
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
  const props = readNodeProperties(node)
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

export function resolveWidgetCompactPreview(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
}): WidgetCompactPreviewSpec | null {
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
    const localValue = readNodePropertyPathValue(args.node, descriptor.schemaPath)
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
  return best
    ? {
        kind: best.kind,
        schemaPath: best.schemaPath,
        portKey: best.portKey,
        source: best.source,
        editable: best.editable,
        text: best.text,
        url: best.url,
      }
    : null
}

export function applyWidgetCompactPreviewTextUpdate(args: {
  preview: WidgetCompactPreviewSpec | null | undefined
  properties: Record<string, unknown>
  nextText: string
}): Record<string, unknown> | null {
  if (!isEditableWidgetCompactPreviewText(args.preview)) return null
  const nextRoot = setObjectPath(
    { properties: args.properties },
    args.preview.schemaPath,
    args.nextText === '' ? undefined : args.nextText,
  ) as { properties?: Record<string, unknown> }
  return nextRoot.properties || {}
}
