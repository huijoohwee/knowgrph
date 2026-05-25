import { splitMultiValues } from '@/features/markdown/ui/markdownDataViewValueUtils'
import { inferMediaKindFromResourceUrl, type UrlMediaKind } from '@/lib/graph/mediaUrlKind'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'

export const STORYBOARD_EMPTY_LANE = 'Storyboard'
const STRUCTURAL_NODE_TYPE_RE = /\b(document|root|workspace|group|cluster|section)\b/i
const STORYBOARD_NODE_TYPE_RE = /\b(scene|shot|frame|panel|story|beat|sequence)\b/i
const LANE_PROPERTY_KEYS = ['status', 'stage', 'column', 'lane', 'phase', 'track', 'swimlane', 'group', 'bucket', 'category', 'columnKey'] as const
const TITLE_PROPERTY_KEYS = ['title', 'name', 'heading', 'scene', 'shot'] as const
const SUMMARY_PROPERTY_KEYS = ['summary', 'description', 'caption', 'content', 'text', 'note', 'notes'] as const
const ORDER_PROPERTY_KEYS = ['order', 'sort', 'sequence', 'sceneOrder', 'shotOrder', 'index', 'rank'] as const
const INDEX_PROPERTY_KEYS = ['frame', 'frameNumber', 'sceneNumber', 'shotNumber', 'panelNumber', 'number', 'index', 'step', 'stepNumber', 'sequenceNumber', 'position', 'ordinal'] as const
const TAG_PROPERTY_KEYS = ['tags', 'keywords'] as const
const META_PROPERTY_KEYS = ['owner', 'priority'] as const
const MEDIA_PROPERTY_KEYS = ['media_url', 'mediaUrl', 'image', 'imageUrl', 'video', 'videoUrl', 'src', 'url'] as const
const LINK_PROPERTY_KEYS = ['url', 'href', 'link', 'sourceUrl', 'source_url', 'briefUrl', 'assetUrl', 'documentUrl'] as const
const SLUGLINE_PROPERTY_KEYS = ['slugline'] as const
const LOCATION_PROPERTY_KEYS = ['location', 'setting', 'place', 'surface', 'context'] as const
const TIME_PROPERTY_KEYS = ['timeOfDay', 'time', 'dayPart', 'moment', 'state'] as const
const ACTION_PROPERTY_KEYS = ['action', 'direction', 'beats', 'blocking', 'instructions', 'steps', 'workflow', 'task'] as const
const DIALOGUE_PROPERTY_KEYS = ['dialogue', 'voiceover', 'vo', 'quote', 'line', 'speakerLine', 'speaker_line', 'narration', 'narrationText', 'voiceOver'] as const
const PROMPT_PROPERTY_KEYS = ['prompt', 'imagePrompt', 'visualPrompt', 'brief', 'visualBrief', 'visual_brief', 'artDirection'] as const
const STYLE_PROPERTY_KEYS = ['style', 'look', 'treatment', 'theme', 'preset', 'variant'] as const
const REFERENCE_PROPERTY_KEYS = ['references', 'referenceUrls', 'reference_urls', 'referenceImages', 'reference_images', 'moodboard', 'referenceLinks', 'reference_links', 'refs', 'assets', 'assetRefs', 'asset_refs'] as const

type GraphNodeProperties = Record<string, JSONValue>

export type StoryboardCardMedia = {
  kind: UrlMediaKind
  url: string
}

export type StoryboardCardReference = {
  kind: UrlMediaKind | 'link'
  url: string
}

export type StoryboardCardModel = {
  id: string
  title: string
  summary: string
  lane: string
  lanePropertyKey: string
  typeLabel: string
  indexLabel: string
  slugline: string
  action: string
  dialogue: string
  prompt: string
  style: string
  tags: string[]
  meta: string[]
  href: string
  media: StoryboardCardMedia | null
  references: StoryboardCardReference[]
  order: number
  inputIndex: number
  candidateScore: number
  structural: boolean
}

export type StoryboardLaneModel = {
  id: string
  label: string
  cards: StoryboardCardModel[]
}

export type StoryboardBoardModel = {
  semanticKey: string
  lanes: StoryboardLaneModel[]
  totalCards: number
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const normalizeText = (value: unknown): string => {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

const toTitleCase = (value: string): string => {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

const readString = (value: unknown): string => {
  if (typeof value === 'string') return normalizeText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return normalizeText(value)
  return ''
}

const readStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      const text = readString(item)
      if (text) out.push(text)
    }
    return out
  }
  const text = readString(value)
  if (!text) return []
  return splitMultiValues(text)
}

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const readNodeProperties = (node: GraphNode): GraphNodeProperties => {
  return isPlainObject(node.properties) ? (node.properties as GraphNodeProperties) : {}
}

const readFirstPropertyString = (properties: GraphNodeProperties, keys: readonly string[]): string => {
  for (const key of keys) {
    const text = readString(properties[key])
    if (text) return text
  }
  return ''
}

const readFirstPropertyScalar = (properties: GraphNodeProperties, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = properties[key]
    const text = readString(value)
    if (text) return text
    if (Array.isArray(value) && value.length > 0) {
      const first = readString(value[0])
      if (first) return first
    }
  }
  return ''
}

const readFirstPropertyNumber = (properties: GraphNodeProperties, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = readNumber(properties[key])
    if (value !== null) return value
  }
  return null
}

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = normalizeText(value)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const readPropertyLists = (properties: GraphNodeProperties, keys: readonly string[]): string[] => {
  return uniqueStrings(keys.flatMap(key => readStringList(properties[key])))
}

const readStoryboardMedia = (node: GraphNode, properties: GraphNodeProperties): StoryboardCardMedia | null => {
  for (const key of MEDIA_PROPERTY_KEYS) {
    const url = readString(properties[key])
    if (!url) continue
    const kind = inferMediaKindFromResourceUrl(url)
    if (!kind) continue
    return { kind, url }
  }
  if (typeof node.type === 'string' && /\b(image|video)\b/i.test(node.type)) {
    const url = readFirstPropertyString(properties, LINK_PROPERTY_KEYS)
    if (!url) return null
    const kind = inferMediaKindFromResourceUrl(url)
    return kind ? { kind, url } : null
  }
  return null
}

const readStoryboardReferences = (properties: GraphNodeProperties, media: StoryboardCardMedia | null): StoryboardCardReference[] => {
  const out: StoryboardCardReference[] = []
  const seen = new Set<string>()
  if (media?.url) seen.add(media.url.toLowerCase())
  for (const url of readPropertyLists(properties, REFERENCE_PROPERTY_KEYS)) {
    const normalized = url.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    const kind = inferMediaKindFromResourceUrl(url)
    out.push({
      kind: kind ?? 'link',
      url,
    })
  }
  return out
}

const readStoryboardHref = (properties: GraphNodeProperties, media: StoryboardCardMedia | null): string => {
  if (media?.url) return media.url
  return readFirstPropertyString(properties, LINK_PROPERTY_KEYS)
}

const readLaneLabel = (node: GraphNode, properties: GraphNodeProperties): string => {
  const explicit = readFirstPropertyString(properties, LANE_PROPERTY_KEYS)
  if (explicit) return explicit
  const typeLabel = readString(node.type)
  if (STORYBOARD_NODE_TYPE_RE.test(typeLabel)) return toTitleCase(typeLabel)
  if (typeLabel && !STRUCTURAL_NODE_TYPE_RE.test(typeLabel)) return toTitleCase(typeLabel)
  return STORYBOARD_EMPTY_LANE
}

const readLanePropertyKey = (properties: GraphNodeProperties): string => {
  for (const key of LANE_PROPERTY_KEYS) {
    const text = readString(properties[key])
    if (text) return key
    const value = properties[key]
    if (Array.isArray(value) && value.length > 0) {
      const first = readString(value[0])
      if (first) return key
    }
  }
  return 'stage'
}

const readTypeLabel = (node: GraphNode): string => {
  const typeLabel = readString(node.type)
  return typeLabel ? toTitleCase(typeLabel) : 'Node'
}

const readIndexLabel = (properties: GraphNodeProperties): string => {
  return readFirstPropertyScalar(properties, INDEX_PROPERTY_KEYS)
}

const readCardTitle = (node: GraphNode, properties: GraphNodeProperties): string => {
  const label = readString(node.label)
  if (label) return label
  const propertyTitle = readFirstPropertyString(properties, TITLE_PROPERTY_KEYS)
  if (propertyTitle) return propertyTitle
  const id = readString(node.id)
  return id || 'Untitled'
}

const readCardSummary = (properties: GraphNodeProperties): string => {
  return readFirstPropertyString(properties, SUMMARY_PROPERTY_KEYS)
}

const readCardSlugline = (properties: GraphNodeProperties): string => {
  const explicit = readFirstPropertyString(properties, SLUGLINE_PROPERTY_KEYS)
  if (explicit) return explicit
  const location = readFirstPropertyString(properties, LOCATION_PROPERTY_KEYS)
  const time = readFirstPropertyString(properties, TIME_PROPERTY_KEYS)
  if (location && time) return `${location} - ${time}`
  return location || time
}

const readCardAction = (properties: GraphNodeProperties): string => {
  return readFirstPropertyString(properties, ACTION_PROPERTY_KEYS)
}

const readCardDialogue = (properties: GraphNodeProperties): string => {
  return readFirstPropertyString(properties, DIALOGUE_PROPERTY_KEYS)
}

const readCardPrompt = (properties: GraphNodeProperties): string => {
  return readFirstPropertyString(properties, PROMPT_PROPERTY_KEYS)
}

const readCardStyle = (properties: GraphNodeProperties): string => {
  return readFirstPropertyString(properties, STYLE_PROPERTY_KEYS)
}

const readCardTags = (properties: GraphNodeProperties): string[] => {
  const values = TAG_PROPERTY_KEYS.flatMap(key => readStringList(properties[key]))
  return uniqueStrings(values)
}

const readCardMeta = (properties: GraphNodeProperties): string[] => {
  return uniqueStrings(META_PROPERTY_KEYS.map(key => readString(properties[key])).filter(Boolean))
}

const computeCandidateScore = (args: {
  node: GraphNode
  lane: string
  summary: string
  slugline: string
  action: string
  dialogue: string
  prompt: string
  style: string
  tags: string[]
  meta: string[]
  media: StoryboardCardMedia | null
  references: StoryboardCardReference[]
}): number => {
  let score = 0
  if (args.media) score += 4
  if (args.summary) score += 2
  if (args.slugline) score += 1
  if (args.action) score += 2
  if (args.dialogue) score += 2
  if (args.prompt) score += 1
  if (args.style) score += 1
  if (args.tags.length > 0) score += 1
  if (args.meta.length > 0) score += 1
  if (args.references.length > 0) score += 2
  if (args.lane !== STORYBOARD_EMPTY_LANE) score += 2
  const nodeType = readString(args.node.type)
  if (STORYBOARD_NODE_TYPE_RE.test(nodeType)) score += 2
  return score
}

const buildCardModel = (node: GraphNode, inputIndex: number): StoryboardCardModel => {
  const properties = readNodeProperties(node)
  const media = readStoryboardMedia(node, properties)
  const references = readStoryboardReferences(properties, media)
  const lane = readLaneLabel(node, properties)
  const summary = readCardSummary(properties)
  const slugline = readCardSlugline(properties)
  const action = readCardAction(properties)
  const dialogue = readCardDialogue(properties)
  const prompt = readCardPrompt(properties)
  const style = readCardStyle(properties)
  const tags = readCardTags(properties)
  const meta = readCardMeta(properties)
  const typeLabel = readTypeLabel(node)
  const nodeType = readString(node.type)
  return {
    id: readString(node.id) || `node-${inputIndex}`,
    title: readCardTitle(node, properties),
    summary,
    lane,
    lanePropertyKey: readLanePropertyKey(properties),
    typeLabel,
    indexLabel: readIndexLabel(properties),
    slugline,
    action,
    dialogue,
    prompt,
    style,
    tags,
    meta,
    href: readStoryboardHref(properties, media),
    media,
    references,
    order: readFirstPropertyNumber(properties, ORDER_PROPERTY_KEYS) ?? inputIndex,
    inputIndex,
    candidateScore: computeCandidateScore({
      node,
      lane,
      summary,
      slugline,
      action,
      dialogue,
      prompt,
      style,
      tags,
      meta,
      media,
      references,
    }),
    structural: STRUCTURAL_NODE_TYPE_RE.test(nodeType),
  }
}

const selectRenderableCards = (cards: StoryboardCardModel[]): StoryboardCardModel[] => {
  if (cards.length <= 1) return cards
  const richCards = cards.filter(card => !card.structural && card.candidateScore >= 2)
  if (richCards.length >= 2) return richCards
  const nonStructuralCards = cards.filter(card => !card.structural)
  if (nonStructuralCards.length >= 2) return nonStructuralCards
  return cards
}

const compareCards = (left: StoryboardCardModel, right: StoryboardCardModel): number => {
  if (left.order !== right.order) return left.order - right.order
  if (left.inputIndex !== right.inputIndex) return left.inputIndex - right.inputIndex
  return left.title.localeCompare(right.title)
}

export const buildStoryboardSemanticKey = (args: { graphData: GraphData | null; graphRevision: number }): string => {
  return buildScopedGraphSemanticKey('storyboard-canvas', {
    graphData: args.graphData,
    graphRevision: args.graphRevision,
  })
}

export const buildStoryboardBoardModel = (args: { graphData: GraphData | null; graphRevision: number }): StoryboardBoardModel => {
  const semanticKey = buildStoryboardSemanticKey(args)
  const nodes = Array.isArray(args.graphData?.nodes) ? args.graphData.nodes : []
  const allCards = nodes.map((node, index) => buildCardModel(node, index))
  const cards = selectRenderableCards(allCards)
  const lanesById = new Map<string, StoryboardLaneModel>()
  for (const card of cards) {
    const laneId = card.lane || STORYBOARD_EMPTY_LANE
    const existing = lanesById.get(laneId)
    if (existing) {
      existing.cards.push(card)
      continue
    }
    lanesById.set(laneId, { id: laneId, label: laneId, cards: [card] })
  }
  const lanes = Array.from(lanesById.values()).map(lane => ({
    ...lane,
    cards: lane.cards.slice().sort(compareCards),
  }))
  return {
    semanticKey,
    lanes,
    totalCards: cards.length,
  }
}
