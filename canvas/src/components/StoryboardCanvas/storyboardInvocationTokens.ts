import type { GraphData, GraphNode } from '@/lib/graph/types'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'

const INVOCATION_TEXT_KEYS = [
  'invocation',
  'invocations',
  'command',
  'commands',
  'slash',
  'slashCommand',
  'slashCommands',
  'semantic',
  'semantics',
  'hash',
  'hashToken',
  'hashTokens',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()
const laneKey = (value: unknown): string => normalizeText(value).toLowerCase()

const collectTextValues = (value: unknown, out: string[]): void => {
  const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? normalizeText(value)
    : ''
  if (text) {
    out.push(text)
    return
  }
  if (Array.isArray(value)) value.forEach(item => collectTextValues(item, out))
}

const readInvocationTextValues = (record: Record<string, unknown>): string[] => {
  const values: string[] = []
  INVOCATION_TEXT_KEYS.forEach(key => collectTextValues(record[key], values))
  return values
}

const readPrimarySlashAndHashTokens = (values: readonly string[]): string[] => {
  let slash = ''
  let hash = ''
  values.forEach(value => {
    splitInvocationTokenSegments(value).forEach(segment => {
      if (segment.kind !== 'token') return
      if (!slash && segment.tokenKind === 'slash') slash = segment.value
      if (!hash && segment.tokenKind === 'keyword') hash = segment.value
    })
  })
  return [slash, hash].filter(Boolean)
}

const collectStageLikeRecords = (value: unknown, out: Record<string, unknown>[], depth = 0): void => {
  if (depth > 5 || !value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectStageLikeRecords(item, out, depth + 1))
    return
  }
  if (!isRecord(value)) return
  const stages = Array.isArray(value.stages) ? value.stages : null
  stages?.forEach(stage => {
    if (isRecord(stage) && laneKey(stage.lane) && readInvocationTextValues(stage).length > 0) out.push(stage)
  })
  Object.values(value).forEach(child => collectStageLikeRecords(child, out, depth + 1))
}

export const buildStoryboardInvocationTokensByLane = (graphData: GraphData | null): ReadonlyMap<string, string[]> => {
  const metadata = isRecord(graphData?.metadata) ? graphData.metadata : null
  const frontmatterMeta = isRecord(metadata?.frontmatterMeta) ? metadata.frontmatterMeta : metadata
  const stages: Record<string, unknown>[] = []
  collectStageLikeRecords(frontmatterMeta, stages)
  const byLane = new Map<string, string[]>()
  stages.forEach(stage => {
    const key = laneKey(stage.lane)
    if (!key || byLane.has(key)) return
    const tokens = readPrimarySlashAndHashTokens(readInvocationTextValues(stage))
    if (tokens.length > 0) byLane.set(key, tokens)
  })
  return byLane
}

export const readStoryboardCardInvocationTokens = (
  node: GraphNode,
  lane: string,
  stageTokensByLane: ReadonlyMap<string, readonly string[]>,
): string[] => {
  const properties = isRecord(node.properties) ? node.properties : {}
  const directTokens = readPrimarySlashAndHashTokens(readInvocationTextValues(properties))
  if (directTokens.length > 0) return directTokens
  return [...(stageTokensByLane.get(laneKey(lane)) || [])]
}
