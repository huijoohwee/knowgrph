import { hashText } from '@/features/parsers/hash'
import type { CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  buildRenderableIframeUrl,
  buildRenderableMediaThumbnailUrl,
  inferMediaKindFromResourceUrl,
} from '@/lib/graph/mediaUrlKind'
import type {
  StrybldrBox,
  StrybldrDetectionProvider,
  StrybldrElement,
  StrybldrEvidenceKind,
  StrybldrVideoHandoff,
  StrybldrVideoHandoffCard,
  StrybldrSource,
  StrybldrStoryboardDocument,
} from './strybldrTypes'
const STRYBLDR_JSON_FENCE_RE = /```(?:json\s+)?strybldr-storyboard\s*\n([\s\S]*?)\n```/i
const asJson = (value: unknown): JSONValue => value as JSONValue
const cleanText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizePath = (raw: unknown): string => String(raw || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()

const shortHash = (value: unknown): string => hashText(String(value ?? '')).slice(0, 12)

const yamlQuote = (value: string): string => `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const CORPUS_MEDIA_KINDS = new Set([
  'code',
  'sql',
  'script',
  'doc',
  'paper',
  'image',
  'video',
  'data',
  'model',
  'unknown',
])

const readCorpusMediaKind = (value: unknown): CorpusSourceUnit['mediaKind'] => {
  const raw = cleanText(value)
  return CORPUS_MEDIA_KINDS.has(raw) ? raw as CorpusSourceUnit['mediaKind'] : 'unknown'
}

const uniqueCleanTexts = (values: readonly unknown[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = cleanText(value)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const titleCase = (value: string): string => {
  const text = cleanText(value)
  if (!text) return ''
  return text
    .split(/[\s_.-]+/g)
    .filter(Boolean)
    .map(token => token.slice(0, 1).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

const basenameWithoutExt = (value: string): string => {
  const base = normalizePath(value).split('/').filter(Boolean).pop() || value || 'image'
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

export const isStrybldrStoryboardMarkdown = (text: string): boolean => {
  const raw = String(text || '')
  return /^\s*---[\s\S]*?\bkgStrybldrStoryboard:\s*true\b[\s\S]*?---/m.test(raw) || STRYBLDR_JSON_FENCE_RE.test(raw)
}

export const buildStrybldrRunId = (sources: readonly Pick<StrybldrSource, 'sourceUnitId' | 'workspacePath' | 'textHash'>[]): string => {
  const signature = sources
    .map(source => [source.sourceUnitId, source.workspacePath, source.textHash].map(v => cleanText(v)).join(':'))
    .sort()
    .join('|')
  return `strybldr-${shortHash(signature || 'empty')}`
}

export const buildStrybldrWorkspaceDocumentName = (source: Pick<StrybldrSource, 'originalName' | 'relativePath'>): string => {
  const base = basenameWithoutExt(source.originalName || source.relativePath || 'storyboard')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'storyboard'
  return `${base}.strybldr.md`
}

export const toStrybldrSource = (unit: CorpusSourceUnit, opts?: { mediaUrl?: string | null }): StrybldrSource => ({
  sourceUnitId: cleanText(unit.id),
  workspacePath: normalizePath(unit.workspacePath),
  relativePath: normalizePath(unit.relativePath || unit.originalName || unit.workspacePath),
  originalName: cleanText(unit.originalName || unit.relativePath || unit.workspacePath || 'image'),
  mediaKind: unit.mediaKind,
  mimeHint: unit.mimeHint || null,
  byteSize: Math.max(0, Number(unit.byteSize || 0)),
  textHash: cleanText(unit.textHash),
  mediaUrl: cleanText(opts?.mediaUrl) || null,
})

const sourceLabel = (source: StrybldrSource): string => titleCase(basenameWithoutExt(source.originalName || source.relativePath)) || 'Source'

const sourceKindLabel = (source: Pick<StrybldrSource, 'mediaKind'>): string => {
  switch (source.mediaKind) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'paper':
      return 'paper'
    case 'model':
      return 'model'
    case 'data':
      return 'data'
    case 'code':
    case 'script':
    case 'sql':
      return 'code'
    case 'doc':
      return 'document'
    default:
      return 'source'
  }
}

const buildStrybldrSourceMediaFields = (source: StrybldrSource): {
  mediaUrl: string
  sourceUrl: string
  renderUrl: string
  thumbnailUrl: string
  references: string[]
} => {
  const mediaUrl = cleanText(source.mediaUrl) || cleanText(source.originalName)
  const sourceUrl = /^https?:\/\//i.test(mediaUrl) ? mediaUrl : ''
  const renderUrl = buildRenderableIframeUrl(mediaUrl)
  const thumbnailUrl = buildRenderableMediaThumbnailUrl(mediaUrl)
  const references = uniqueCleanTexts([
    source.workspacePath || source.relativePath || source.originalName,
    sourceUrl,
    thumbnailUrl,
  ])
  return { mediaUrl, sourceUrl, renderUrl, thumbnailUrl, references }
}

const createFallbackElements = (source: StrybldrSource, sourceIndex: number): StrybldrElement[] => {
  const label = sourceLabel(source)
  const elementBase = `${source.sourceUnitId || source.workspacePath}:${source.textHash || source.originalName}`
  const sourceBox: StrybldrBox = { xmin: 0, ymin: 0, xmax: 1, ymax: 1, unit: 'percentage' }
  return [
    {
      id: `strybldr-el-${shortHash(`${elementBase}:subject`)}`,
      sourceUnitId: source.sourceUnitId,
      label: 'Primary subject',
      confidence: 0.1,
      sourceBox,
      evidenceKind: 'source-metadata',
      provider: 'fallback',
      order: sourceIndex * 10 + 1,
      summary: `Primary story evidence inferred from ${label}.`,
      action: 'Confirm or replace this element after reviewing source evidence.',
      prompt: `Describe the primary story subject in ${label} as a video storyboard element.`,
    },
    {
      id: `strybldr-el-${shortHash(`${elementBase}:composition`)}`,
      sourceUnitId: source.sourceUnitId,
      label: 'Composition',
      confidence: 0.1,
      sourceBox,
      evidenceKind: 'source-metadata',
      provider: 'fallback',
      order: sourceIndex * 10 + 2,
      summary: `Story composition placeholder for ${label}.`,
      action: 'Break the source into foreground, midground, background, or narrative beats.',
      prompt: `Create a concise shot plan from the available ${sourceKindLabel(source)} evidence in ${label}.`,
    },
  ]
}

export const buildStrybldrStoryboardDocument = (args: {
  sourceUnits: readonly CorpusSourceUnit[]
  mediaUrlBySourceUnitId?: Readonly<Record<string, string | null | undefined>>
  elements?: readonly StrybldrElement[]
  createdAtMs?: number | null
}): StrybldrStoryboardDocument => {
  const sources = args.sourceUnits
    .map(unit => toStrybldrSource(unit, { mediaUrl: args.mediaUrlBySourceUnitId?.[unit.id] || null }))
  const runId = buildStrybldrRunId(sources)
  const explicitElements = Array.isArray(args.elements) ? args.elements.slice() : []
  const fallbackElements = explicitElements.length > 0
    ? []
    : sources.flatMap((source, index) => createFallbackElements(source, index))
  return {
    version: 1,
    runId,
    createdAtMs: Number.isFinite(Number(args.createdAtMs)) ? Number(args.createdAtMs) : Date.now(),
    sources,
    elements: explicitElements.length > 0 ? explicitElements : fallbackElements,
  }
}

export const serializeStrybldrStoryboardMarkdown = (doc: StrybldrStoryboardDocument): string => {
  const first = doc.sources[0] || null
  const title = first ? `${sourceLabel(first)} Strybldr` : 'Strybldr'
  const json = JSON.stringify(doc, null, 2)
  return [
    '---',
    'kgStrybldrStoryboard: true',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "strybldr"',
    `strybldrRunId: ${yamlQuote(doc.runId)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '```json strybldr-storyboard',
    json,
    '```',
    '',
  ].join('\n')
}

const readParsedObject = (value: unknown): StrybldrStoryboardDocument | null => {
  if (!value || typeof value !== 'object') return null
  const rec = value as Partial<StrybldrStoryboardDocument>
  const sources = Array.isArray(rec.sources)
    ? rec.sources
        .map((item): StrybldrSource | null => {
          if (!item || typeof item !== 'object') return null
          const source = item as Partial<StrybldrSource>
          const sourceUnitId = cleanText(source.sourceUnitId)
          const workspacePath = normalizePath(source.workspacePath)
          const originalName = cleanText(source.originalName || source.relativePath || workspacePath)
          if (!sourceUnitId || !originalName) return null
          return {
            sourceUnitId,
            workspacePath,
            relativePath: normalizePath(source.relativePath || originalName),
            originalName,
            mediaKind: source.mediaKind === 'image' ? 'image' : source.mediaKind || 'unknown',
            mimeHint: cleanText(source.mimeHint) || null,
            byteSize: Math.max(0, Number(source.byteSize || 0)),
            textHash: cleanText(source.textHash),
            mediaUrl: cleanText(source.mediaUrl) || null,
          }
        })
        .filter((item): item is StrybldrSource => !!item)
    : []
  if (sources.length === 0) return null
  const sourceIds = new Set(sources.map(source => source.sourceUnitId))
  const elements = Array.isArray(rec.elements)
    ? rec.elements
        .map((item, index): StrybldrElement | null => {
          if (!item || typeof item !== 'object') return null
          const el = item as Partial<StrybldrElement>
          const sourceUnitId = cleanText(el.sourceUnitId)
          if (!sourceUnitId || !sourceIds.has(sourceUnitId)) return null
          const label = cleanText(el.label) || `Element ${index + 1}`
          return {
            id: cleanText(el.id) || `strybldr-el-${shortHash(`${sourceUnitId}:${label}:${index}`)}`,
            sourceUnitId,
            label,
            confidence: Math.max(0, Math.min(1, Number(el.confidence || 0))),
            sourceBox: el.sourceBox || null,
            evidenceKind: el.evidenceKind || 'source-metadata',
            provider: el.provider || 'fallback',
            order: Number.isFinite(Number(el.order)) ? Number(el.order) : index,
            prompt: cleanText(el.prompt) || null,
            action: cleanText(el.action) || null,
            summary: cleanText(el.summary) || null,
          }
        })
        .filter((item): item is StrybldrElement => !!item)
    : []
  return {
    version: 1,
    runId: cleanText(rec.runId) || buildStrybldrRunId(sources),
    createdAtMs: Number.isFinite(Number(rec.createdAtMs)) ? Number(rec.createdAtMs) : 0,
    sources,
    elements: elements.length > 0 ? elements : sources.flatMap(createFallbackElements),
    notes: cleanText(rec.notes) || null,
  }
}

export const parseStrybldrStoryboardMarkdown = (text: string): StrybldrStoryboardDocument | null => {
  const raw = String(text || '')
  const match = STRYBLDR_JSON_FENCE_RE.exec(raw)
  if (!match?.[1]) return null
  try {
    return readParsedObject(JSON.parse(match[1]))
  } catch {
    return null
  }
}

const createEdge = (source: string, target: string, label: string): GraphEdge => ({
  id: `strybldr:edge:${shortHash(`${source}:${label}:${target}`)}`,
  source,
  target,
  label,
  properties: {
    evidenceKind: asJson('source-metadata'),
    confidence: asJson('medium'),
  },
})

const readNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const readStrybldrBox = (value: unknown): StrybldrBox | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rec = value as Record<string, unknown>
  const xmin = readNumber(rec.xmin, NaN)
  const ymin = readNumber(rec.ymin, NaN)
  const xmax = readNumber(rec.xmax, NaN)
  const ymax = readNumber(rec.ymax, NaN)
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) return null
  return {
    xmin,
    ymin,
    xmax,
    ymax,
    unit: rec.unit === 'pixel' ? 'pixel' : 'percentage',
  }
}

const readStrybldrEvidenceKind = (value: unknown): StrybldrEvidenceKind => {
  switch (cleanText(value)) {
    case 'local-object-detection':
      return 'local-object-detection'
    case 'local-human-geometry':
      return 'local-human-geometry'
    case 'modelark-visual-grounding':
      return 'modelark-visual-grounding'
    case 'user-edit':
      return 'user-edit'
    default:
      return 'source-metadata'
  }
}

const readStrybldrProvider = (value: unknown): StrybldrDetectionProvider => {
  switch (cleanText(value)) {
    case 'transformers-detr':
      return 'transformers-detr'
    case 'human':
      return 'human'
    case 'byteplus-modelark':
      return 'byteplus-modelark'
    default:
      return 'fallback'
  }
}

const readStrybldrElementFromNode = (node: GraphNode, index: number): StrybldrElement | null => {
  if (cleanText(node.type) !== 'StoryboardElement') return null
  const props = node.properties || {}
  const sourceUnitId = cleanText(props.strybldrSourceUnitId)
  if (!sourceUnitId) return null
  const label = cleanText(props.title || node.label) || `Element ${index + 1}`
  return {
    id: cleanText(props.strybldrElementId || node.id) || `strybldr-el-${shortHash(`${sourceUnitId}:${label}:${index}`)}`,
    sourceUnitId,
    label,
    confidence: Math.max(0, Math.min(1, readNumber(props.confidence, 0))),
    sourceBox: readStrybldrBox(props.sourceBox),
    evidenceKind: readStrybldrEvidenceKind(props.evidenceKind),
    provider: readStrybldrProvider(props.provider),
    order: readNumber(props.order, index),
    prompt: cleanText(props.prompt) || null,
    action: cleanText(props.action) || null,
    summary: cleanText(props.summary) || null,
  }
}

export const buildStrybldrGraphData = (doc: StrybldrStoryboardDocument): GraphData => {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const sourceNodeIdByUnit = new Map<string, string>()
  const frameNodeIdByUnit = new Map<string, string>()

  for (let index = 0; index < doc.sources.length; index += 1) {
    const source = doc.sources[index]!
    const base = source.sourceUnitId || source.workspacePath || source.originalName
    const sourceNodeId = `strybldr:source:${shortHash(base)}`
    const frameNodeId = `strybldr:frame:${shortHash(`${base}:frame`)}`
    const title = sourceLabel(source)
    const media = buildStrybldrSourceMediaFields(source)
    sourceNodeIdByUnit.set(source.sourceUnitId, sourceNodeId)
    frameNodeIdByUnit.set(source.sourceUnitId, frameNodeId)
    nodes.push({
      id: sourceNodeId,
      label: title,
      type: 'StrybldrImageSource',
      properties: {
        title: asJson(title),
        lane: asJson('Source'),
        order: asJson(index * 100),
        summary: asJson(`Imported ${sourceKindLabel(source)} source unit: ${source.originalName}.`),
        action: asJson('Review the source evidence into editable storyboard elements.'),
        prompt: asJson(`Use ${source.originalName} as the reference source.`),
        mediaUrl: asJson(media.mediaUrl),
        sourceUrl: asJson(media.sourceUrl || null),
        renderUrl: asJson(media.renderUrl || null),
        thumbnailUrl: asJson(media.thumbnailUrl || null),
        mediaKind: asJson(source.mediaKind),
        mimeHint: asJson(source.mimeHint || null),
        byteSize: asJson(source.byteSize),
        references: asJson(media.references),
        strybldrRunId: asJson(doc.runId),
        strybldrSourceUnitId: asJson(source.sourceUnitId),
        strybldrElementId: asJson(sourceNodeId),
        sourceBox: asJson({ xmin: 0, ymin: 0, xmax: 1, ymax: 1, unit: 'percentage' }),
        confidence: asJson(1),
        evidenceKind: asJson('source-metadata'),
      },
    })
    nodes.push({
      id: frameNodeId,
      label: `${title} Frame`,
      type: 'StoryboardFrame',
      properties: {
        title: asJson(`${title} Frame`),
        lane: asJson('Storyboard'),
        order: asJson(index * 100 + 1),
        summary: asJson('Frame-level storyboard card generated from the imported source.'),
        action: asJson('Review element cards, revise prompts, then send the approved sequence to video generation.'),
        prompt: asJson(`Create a short video storyboard beat from ${source.originalName}.`),
        mediaUrl: asJson(media.mediaUrl),
        sourceUrl: asJson(media.sourceUrl || null),
        renderUrl: asJson(media.renderUrl || null),
        thumbnailUrl: asJson(media.thumbnailUrl || null),
        mediaKind: asJson(source.mediaKind),
        mimeHint: asJson(source.mimeHint || null),
        byteSize: asJson(source.byteSize),
        references: asJson(media.references),
        strybldrRunId: asJson(doc.runId),
        strybldrSourceUnitId: asJson(source.sourceUnitId),
        strybldrElementId: asJson(frameNodeId),
        sourceBox: asJson({ xmin: 0, ymin: 0, xmax: 1, ymax: 1, unit: 'percentage' }),
        confidence: asJson(0.5),
        evidenceKind: asJson('source-metadata'),
      },
    })
    edges.push(createEdge(sourceNodeId, frameNodeId, 'frames'))
  }

  for (const element of doc.elements.slice().sort((a, b) => a.order - b.order)) {
    const sourceNodeId = sourceNodeIdByUnit.get(element.sourceUnitId)
    const frameNodeId = frameNodeIdByUnit.get(element.sourceUnitId)
    if (!sourceNodeId || !frameNodeId) continue
    const source = doc.sources.find(item => item.sourceUnitId === element.sourceUnitId) || null
    const elementId = cleanText(element.id) || `strybldr:element:${shortHash(`${element.sourceUnitId}:${element.label}:${element.order}`)}`
    const media = source ? buildStrybldrSourceMediaFields(source) : null
    const mediaUrl = media?.mediaUrl || cleanText(source?.originalName)
    nodes.push({
      id: elementId,
      label: element.label,
      type: 'StoryboardElement',
      properties: {
        title: asJson(element.label),
        lane: asJson('Elements'),
        order: asJson(element.order),
        summary: asJson(element.summary || `${element.label} extracted from ${source?.originalName || 'image source'}.`),
        action: asJson(element.action || 'Edit this element before video generation.'),
        prompt: asJson(element.prompt || `Animate ${element.label} as a distinct storyboard element.`),
        mediaUrl: asJson(mediaUrl),
        sourceUrl: asJson(media?.sourceUrl || null),
        renderUrl: asJson(media?.renderUrl || null),
        thumbnailUrl: asJson(media?.thumbnailUrl || null),
        mediaKind: asJson(source?.mediaKind || 'image'),
        mimeHint: asJson(source?.mimeHint || null),
        byteSize: asJson(source?.byteSize || 0),
        references: asJson(media?.references || [source?.workspacePath || source?.relativePath || source?.originalName].filter(Boolean)),
        strybldrRunId: asJson(doc.runId),
        strybldrSourceUnitId: asJson(element.sourceUnitId),
        strybldrElementId: asJson(elementId),
        sourceBox: asJson(element.sourceBox || null),
        confidence: asJson(element.confidence),
        evidenceKind: asJson(element.evidenceKind),
        provider: asJson(element.provider),
      },
    })
    edges.push(createEdge(frameNodeId, elementId, 'containsElement'))
  }

  const baseGraph: GraphData = {
    context: 'strybldr-storyboard',
    type: 'Graph',
    nodes,
    edges,
    metadata: {
      kind: 'strybldr-storyboard',
      parserId: 'strybldr-storyboard',
      strybldrRunId: doc.runId,
      sourcesCount: doc.sources.length,
      elementsCount: doc.elements.length,
      kgCanvasRenderMode: '2d',
      kgCanvas2dRenderer: 'strybldr',
    } as unknown as GraphData['metadata'],
  }
  const graphSemanticKey = buildScopedGraphSemanticKey('strybldr-storyboard', { graphData: baseGraph })
  return {
    ...baseGraph,
    metadata: {
      ...(baseGraph.metadata || {}),
      graphSemanticKey,
    } as unknown as GraphData['metadata'],
  }
}

export const mergeStrybldrElementsIntoGraphData = (args: {
  graphData: GraphData
  elements: readonly StrybldrElement[]
}): GraphData => {
  const graphNodes = Array.isArray(args.graphData.nodes) ? args.graphData.nodes : []
  const meta = args.graphData.metadata && typeof args.graphData.metadata === 'object'
    ? args.graphData.metadata as Record<string, unknown>
    : {}
  const sources = graphNodes
    .filter(node => String(node.type || '') === 'StrybldrImageSource')
    .map(node => {
      const props = node.properties || {}
      return {
        sourceUnitId: cleanText(props.strybldrSourceUnitId),
        workspacePath: cleanText((Array.isArray(props.references) ? props.references[0] : '') || ''),
        relativePath: cleanText((Array.isArray(props.references) ? props.references[0] : '') || ''),
        originalName: cleanText(node.label || 'source'),
        mediaKind: readCorpusMediaKind(props.mediaKind),
        mimeHint: cleanText(props.mimeHint) || null,
        byteSize: Number.isFinite(Number(props.byteSize)) ? Math.max(0, Number(props.byteSize)) : 0,
        textHash: '',
        mediaUrl: cleanText(props.mediaUrl) || cleanText(props.sourceUrl) || cleanText(props.renderUrl),
      }
    })
    .filter(source => source.sourceUnitId)
  const incomingElements = args.elements.slice()
  const incomingSourceIds = new Set(incomingElements.map(element => cleanText(element.sourceUnitId)).filter(Boolean))
  const existingElements = graphNodes
    .map(readStrybldrElementFromNode)
    .filter((element): element is StrybldrElement => !!element)
  const preservedElements = incomingSourceIds.size > 0
    ? existingElements.filter(element => !incomingSourceIds.has(element.sourceUnitId))
    : existingElements
  const doc: StrybldrStoryboardDocument = {
    version: 1,
    runId: cleanText(meta.strybldrRunId) || buildStrybldrRunId(sources),
    createdAtMs: Date.now(),
    sources,
    elements: [...preservedElements, ...incomingElements],
  }
  return buildStrybldrGraphData(doc)
}

const readNodeReferences = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(item => cleanText(item)).filter(Boolean)
}

export const buildStrybldrVideoHandoffFromGraphData = (graphData: GraphData | null | undefined): StrybldrVideoHandoff => {
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const cards: StrybldrVideoHandoffCard[] = nodes
    .filter(node => {
      const type = cleanText(node.type)
      return type === 'StrybldrImageSource' || type === 'StoryboardFrame' || type === 'StoryboardElement'
    })
    .map((node, index): StrybldrVideoHandoffCard => {
      const props = node.properties || {}
      const mediaUrl = cleanText(props.mediaUrl)
      const references = uniqueCleanTexts([
        ...readNodeReferences(props.references),
        cleanText(props.sourceUrl),
        mediaUrl,
        cleanText(props.thumbnailUrl) || buildRenderableMediaThumbnailUrl(mediaUrl),
      ])
      return {
        id: cleanText(node.id) || `strybldr-card-${index + 1}`,
        lane: cleanText(props.lane) || 'Storyboard',
        title: cleanText(props.title || node.label) || `Card ${index + 1}`,
        summary: cleanText(props.summary),
        action: cleanText(props.action),
        prompt: cleanText(props.prompt),
        references,
        order: Number.isFinite(Number(props.order)) ? Number(props.order) : index,
        sourceUnitId: cleanText(props.strybldrSourceUnitId),
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  const promptLines = [
    'Create one short video from the approved Strybldr storyboard cards below.',
    'Use only these approved card fields and references; do not invent extra source images or hidden context.',
    'Preserve source composition, element positions, and card order. Keep motion concise and demo-ready.',
    '',
    ...cards.map((card, index) => {
      const body = [
        `${index + 1}. [${card.lane}] ${card.title}`,
        card.summary ? `Summary: ${card.summary}` : '',
        card.action ? `Action: ${card.action}` : '',
        card.prompt ? `Prompt: ${card.prompt}` : '',
        card.references.length > 0 ? `References: ${card.references.join(', ')}` : '',
      ].filter(Boolean)
      return body.join('\n')
    }),
  ]

  const mediaUrl = nodes
    .flatMap(node => {
      const props = node.properties || {}
      const rawMediaUrl = cleanText(props.mediaUrl)
      const inferred = inferMediaKindFromResourceUrl(rawMediaUrl)
      return [
        cleanText(props.thumbnailUrl) || buildRenderableMediaThumbnailUrl(rawMediaUrl),
        inferred === 'image' || inferred === 'svg' ? rawMediaUrl : '',
      ]
    })
    .find(value => /^https?:\/\//i.test(value)) || null

  return {
    cards,
    prompt: promptLines.join('\n').trim(),
    referenceImageUrl: mediaUrl,
  }
}

export const buildStrybldrVideoHandoffMarkdown = (args: {
  handoff: StrybldrVideoHandoff
  status: 'generated' | 'fallback'
  provider: string
  model?: string | null
  renderUrl?: string | null
  sourceUrl?: string | null
  errorReason?: string | null
  elapsedMs: number
  paidCallCount: number
  cacheHit?: boolean
}): string => {
  const safeStatus = args.status === 'generated' ? 'generated' : 'fallback'
  const title = safeStatus === 'generated' ? 'Strybldr Video Handoff' : 'Strybldr Video Fallback'
  return [
    '---',
    'kgStrybldrVideoHandoff: true',
    `status: ${yamlQuote(safeStatus)}`,
    `provider: ${yamlQuote(cleanText(args.provider) || 'unconfigured')}`,
    args.model ? `model: ${yamlQuote(cleanText(args.model))}` : '',
    `elapsedMs: ${Math.max(0, Math.round(args.elapsedMs))}`,
    `paidCallCount: ${Math.max(0, Math.round(args.paidCallCount))}`,
    `cacheHit: ${args.cacheHit === true ? 'true' : 'false'}`,
    args.renderUrl ? `renderUrl: ${yamlQuote(cleanText(args.renderUrl))}` : '',
    args.sourceUrl ? `sourceUrl: ${yamlQuote(cleanText(args.sourceUrl))}` : '',
    args.errorReason ? `errorReason: ${yamlQuote(cleanText(args.errorReason))}` : '',
    '---',
    '',
    `# ${title}`,
    '',
    '## Compiled Prompt',
    '',
    '```text',
    args.handoff.prompt || 'No approved Strybldr cards were available.',
    '```',
    '',
    '## Approved Cards',
    '',
    '```json',
    JSON.stringify(args.handoff.cards, null, 2),
    '```',
    '',
  ].filter(line => line !== '').join('\n')
}
