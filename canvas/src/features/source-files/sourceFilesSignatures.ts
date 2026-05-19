import type { GraphData } from '@/lib/graph/types'
import { buildSourceLayerKeys } from '@/lib/graph/sourceLayers'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { readSourceFileParsedState } from '@/features/source-files/sourceFileParsedState'

export type SourceFilesCompositionSignatureOptions = {
  includeWorkspaceBacked?: boolean
}

type SourceFileLike = {
  id?: unknown
  name?: unknown
  text?: unknown
  enabled?: unknown
  geoLayerEnabled?: unknown
  status?: unknown
  parsedTextHash?: unknown
  parsedGraphRevision?: unknown
  parsedGraphData?: unknown
  source?: {
    kind?: unknown
    url?: unknown
    path?: unknown
  } | null
}

const sourceFileTextHashCache = new WeakMap<object, { text: string; hash: string }>()

export const isWorkspaceBackedSourceFile = (entry: unknown): boolean => {
  const item = entry as SourceFileLike | null | undefined
  return String(item?.source?.path || '').trim().startsWith('workspace:')
}

const readPersistableSourceFiles = (value: unknown): SourceFileLike[] => {
  const items = Array.isArray(value) ? value : []
  return items
    .map(entry => entry as SourceFileLike)
    .filter(entry => !isWorkspaceBackedSourceFile(entry))
}

export const readSourceFilesForComposition = (
  value: unknown,
  options: SourceFilesCompositionSignatureOptions = {},
): SourceFileLike[] => {
  const items = Array.isArray(value) ? value : []
  const includeWorkspaceBacked = options.includeWorkspaceBacked === true
  return items
    .map(entry => entry as SourceFileLike)
    .filter(entry => includeWorkspaceBacked || !isWorkspaceBackedSourceFile(entry))
}

export const getSourceFileTextHash = (entry: unknown): string => {
  if (!entry || typeof entry !== 'object') return hashStringToHex('')
  const cached = sourceFileTextHashCache.get(entry as object)
  const item = entry as { text?: unknown }
  const text = String(item?.text || '')
  if (cached && cached.text === text) return cached.hash
  const next = hashStringToHex(String(item?.text || ''))
  sourceFileTextHashCache.set(entry as object, { text, hash: next })
  return next
}

export const areSourceFilesEqualByIdAndHash = (a: unknown, b: unknown): boolean => {
  const aa = readPersistableSourceFiles(a)
  const bb = readPersistableSourceFiles(b)
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i += 1) {
    const x = aa[i] as SourceFileLike
    const y = bb[i] as SourceFileLike
    const xParsed = readSourceFileParsedState(x)
    const yParsed = readSourceFileParsedState(y)
    if (String(x?.id || '') !== String(y?.id || '')) return false
    if (String(xParsed.parsedTextHash || '') !== String(yParsed.parsedTextHash || '')) return false
    if (String(x?.enabled || '') !== String(y?.enabled || '')) return false
    if (getSourceFileTextHash(x) !== getSourceFileTextHash(y)) return false
  }
  return true
}

export const buildSourceFilesPersistenceSignature = (value: unknown): string => {
  const items = readPersistableSourceFiles(value)
  if (items.length < 1) return '[]'
  return items
    .map(entry => {
      const item = entry as SourceFileLike
      const parsed = readSourceFileParsedState(item)
      const id = String(item?.id || '')
      const parsedTextHash = String(parsed.parsedTextHash || '')
      const enabled = String(item?.enabled || '')
      const textHash = getSourceFileTextHash(item)
      return `${id}:${parsedTextHash}:${enabled}:${textHash}`
    })
    .join('|')
}

function readSourceKind(source: SourceFileLike['source']): 'url' | 'local' | '' {
  const kind = String(source?.kind || '').trim()
  return kind === 'url' || kind === 'local' ? kind : ''
}

function readCompositionStatusToken(status: unknown): 'parsed' | 'pending' {
  return String(status || '').trim().toLowerCase() === 'parsed' ? 'parsed' : 'pending'
}

export const buildSourceFilesCompositionSignature = (
  value: unknown,
  options: SourceFilesCompositionSignatureOptions = {},
): string => {
  const items = readSourceFilesForComposition(value, options)
  const layers = items.map(entry => {
    const item = entry as SourceFileLike
    const parsed = readSourceFileParsedState(item)
    const sourceKind = readSourceKind(item?.source)
    return {
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      enabled: Boolean(item?.enabled),
      statusToken: readCompositionStatusToken(item?.status),
      hasText: Boolean(String(item?.text || '').trim()),
      hasParsedGraphData:
        !!(item?.parsedGraphData && typeof item.parsedGraphData === 'object'),
      sourceKind,
      sourceUrl: sourceKind === 'url' ? String(item?.source?.url || '').trim() : '',
      sourcePath: sourceKind === 'local' ? String(item?.source?.path || '').trim() : '',
      text: typeof item?.text === 'string' ? item.text : '',
      parsedTextHash: parsed.parsedTextHash,
      parsedGraphRevision: parsed.parsedGraphRevision,
      parsedGraphData: parsed.parsedGraphData as GraphData | undefined,
    }
  })
  const { contentKey, orderKey } = buildSourceLayerKeys(layers)
  const metadataKey = hashSignatureParts(
    layers.flatMap(layer => [
      layer.id,
      layer.name,
      layer.enabled ? '1' : '0',
      layer.sourceKind,
      layer.sourceUrl,
      layer.sourcePath,
    ]),
  )
  const readinessKey = hashSignatureParts(
    layers.flatMap(layer => [
      layer.id,
      layer.statusToken,
      layer.hasText ? '1' : '0',
      layer.hasParsedGraphData ? '1' : '0',
    ]),
  )
  return hashSignatureParts([
    'source-files-compose',
    items.length,
    contentKey,
    orderKey,
    metadataKey,
    readinessKey,
  ])
}

export const buildSourceFilesGeospatialSelectionSignature = (value: unknown): string => {
  const items = Array.isArray(value) ? value : []
  return hashSignatureParts([
    'source-files-geospatial-selection',
    ...items.flatMap(entry => {
      const item = entry as SourceFileLike
      const parsed = readSourceFileParsedState(item)
      const sourceKind = readSourceKind(item?.source)
      return [
        String(item?.id || '').trim(),
        String(item?.name || '').trim(),
        item?.enabled === true ? '1' : '0',
        typeof item?.geoLayerEnabled === 'boolean' ? (item.geoLayerEnabled ? '1' : '0') : 'unset',
        readCompositionStatusToken(item?.status),
        String(parsed.parsedTextHash || '').trim(),
        sourceKind,
        sourceKind === 'url' ? String(item?.source?.url || '').trim() : '',
        sourceKind === 'local' ? String(item?.source?.path || '').trim() : '',
      ]
    }),
  ])
}
