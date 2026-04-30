import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from './chatStorageConfig'

type ChatHistoryStorageType = 'chatKnowgrph' | 'chatHistory'
type KgcWorkspacePathKind = 'canonical' | 'trace' | 'output'

const KGC_CANONICAL_FILE_RX = /^kgc_(\d{14})(?:-[a-z0-9-]+)?\.md$/i
const KGC_TRACE_FILE_RX = /^kgc-trace_(\d{14})(?:-[a-z0-9-]+)?\.md$/i
const KGC_OUTPUT_FILE_RX = /^kgc-output_(\d{14})(?:-[a-z0-9-]+)?\.[a-z0-9]+$/i

export const resolveFilePrefix = (args?: { storageType?: 'chatKnowgrph' | 'chatHistory' }): 'chh' | 'kgc' => {
  if (args?.storageType === 'chatKnowgrph') return 'kgc'
  return 'chh'
}

const sessionAutoPathByScope = new Map<string, WorkspacePath>()
const sessionAutoInFlightByScope = new Map<string, Promise<WorkspacePath>>()

const pad2 = (n: number): string => String(n).padStart(2, '0')
const formatCompactTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}${mm}${dd}${hh}${min}${sec}`
}

const formatFilename = (prefix: 'chh' | 'kgc', timestampMs: number): string => {
  return `${prefix}_${formatCompactTimestamp(timestampMs)}.md`
}

const extractLastPathSegment = (workspacePath: string): string => {
  const normalized = normalizeWorkspacePath(workspacePath)
  const parts = normalized.split('/').filter(Boolean)
  return String(parts[parts.length - 1] || '').trim()
}

const parseKgcWorkspacePath = (workspacePath: string): { timestamp: string; kind: KgcWorkspacePathKind } | null => {
  const fileName = extractLastPathSegment(workspacePath)
  const canonicalMatch = KGC_CANONICAL_FILE_RX.exec(fileName)
  if (canonicalMatch?.[1]) {
    return { timestamp: String(canonicalMatch[1]).trim(), kind: 'canonical' }
  }
  const traceMatch = KGC_TRACE_FILE_RX.exec(fileName)
  if (traceMatch?.[1]) {
    return { timestamp: String(traceMatch[1]).trim(), kind: 'trace' }
  }
  const outputMatch = KGC_OUTPUT_FILE_RX.exec(fileName)
  if (outputMatch?.[1]) {
    return { timestamp: String(outputMatch[1]).trim(), kind: 'output' }
  }
  return null
}

const replaceLastPathSegment = (workspacePath: string, nextFileName: string): WorkspacePath => {
  const normalized = normalizeWorkspacePath(workspacePath)
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return normalizeWorkspacePath(`/${nextFileName}`)
  parts[parts.length - 1] = String(nextFileName || '').trim()
  return normalizeWorkspacePath(`/${parts.join('/')}`)
}

export const isCanonicalKgcFilename = (name: string): boolean => {
  return /^kgc_\d{14}\.md$/i.test(String(name || '').trim())
}

export const isKgcWorkspaceCompanionPath = (workspacePath: string): boolean => {
  return parseKgcWorkspacePath(workspacePath) !== null
}

export const toCanonicalKgcWorkspacePath = (workspacePath: string): WorkspacePath => {
  const normalized = normalizeWorkspacePath(workspacePath)
  const parsed = parseKgcWorkspacePath(normalized)
  if (!parsed) return normalized
  return replaceLastPathSegment(normalized, `kgc_${parsed.timestamp}.md`)
}

export const toKgcTraceWorkspacePath = (workspacePath: string): WorkspacePath | null => {
  const parsed = parseKgcWorkspacePath(workspacePath)
  if (!parsed) return null
  return replaceLastPathSegment(workspacePath, `kgc-trace_${parsed.timestamp}.md`)
}

export const toKgcOutputWorkspacePath = (
  workspacePath: string,
  extension = 'md',
  args?: { variant?: string | null },
): WorkspacePath | null => {
  const parsed = parseKgcWorkspacePath(workspacePath)
  if (!parsed) return null
  const safeExtension = String(extension || 'md').replace(/^\./, '').trim().toLowerCase() || 'md'
  const rawVariant = String(args?.variant || '').trim().toLowerCase()
  const safeVariant = rawVariant.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const variantSuffix = safeVariant ? `-${safeVariant}` : ''
  return replaceLastPathSegment(workspacePath, `kgc-output_${parsed.timestamp}${variantSuffix}.${safeExtension}`)
}

const shouldUseRequestedPath = (
  requestedPath: string,
  storageType?: ChatHistoryStorageType,
): boolean => {
  if (storageType !== 'chatKnowgrph') return true
  return isKgcWorkspaceCompanionPath(requestedPath)
}

const createTimestampedWorkspaceFile = async (args: {
  fs: Awaited<ReturnType<typeof getWorkspaceFs>>
  parentPath: WorkspacePath
  prefix: 'chh' | 'kgc'
  timestampMs: number
}): Promise<WorkspacePath> => {
  for (let i = 0; i < 5; i += 1) {
    const ts = args.timestampMs + i * 1000
    const name = formatFilename(args.prefix, ts)
    const existingPath = normalizeWorkspacePath(`${args.parentPath === '/' ? '' : args.parentPath}/${name}`)
    const existing = await args.fs.readFileText(existingPath)
    if (existing !== null) continue
    const created = await args.fs.createFile({ parentPath: args.parentPath, name, text: '' })
    return normalizeWorkspacePath(created)
  }
  const fallbackCreated = await args.fs.createFile({
    parentPath: args.parentPath,
    name: formatFilename(args.prefix, Date.now()),
    text: '',
  })
  return normalizeWorkspacePath(fallbackCreated)
}

const resolveSessionScopeKey = (args?: {
  storageType?: ChatHistoryStorageType
  defaultLocalRootPath?: string | null
}): string => {
  const prefix = resolveFilePrefix(args)
  const rootRaw = String(args?.defaultLocalRootPath || '').trim()
  const root = normalizeWorkspacePath(rootRaw || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT)
  return `${prefix}:${root}`
}

const ensureWorkspaceFilePathExists = async (requestedPath: string): Promise<WorkspacePath> => {
  const normalized = normalizeWorkspacePath(requestedPath)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const existing = await fs.readFileText(normalized)
  if (existing !== null) return normalized
  const lastSlash = normalized.lastIndexOf('/')
  const parent = normalizeWorkspacePath(lastSlash > 0 ? normalized.slice(0, lastSlash) : '/')
  const name = normalized.split('/').filter(Boolean).slice(-1)[0] || ''
  if (!name) return normalized
  await ensureWorkspaceFolderTreeIfMissing(parent)
  const created = await fs.createFile({ parentPath: parent, name, text: '' })
  return normalizeWorkspacePath(created)
}

export const createNewChatHistoryWorkspaceFilePath = async (
  timestampMs: number,
  args?: { storageType?: ChatHistoryStorageType; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const prefix = resolveFilePrefix(args)
  const scopeKey = resolveSessionScopeKey(args)
  const rootPathRaw = String(args?.defaultLocalRootPath || '').trim()
  const folder: WorkspacePath = normalizeWorkspacePath(rootPathRaw || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT)
  await ensureWorkspaceFolderTreeIfMissing(folder)
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const normalized = await createTimestampedWorkspaceFile({
    fs,
    parentPath: folder,
    prefix,
    timestampMs,
  })
  sessionAutoPathByScope.set(scopeKey, normalized)
  sessionAutoInFlightByScope.delete(scopeKey)
  return normalized
}

export const ensureHistoryFilePath = async (
  requestedPath: string | null,
  timestampMs: number,
  args?: { storageType?: ChatHistoryStorageType; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const scopeKey = resolveSessionScopeKey(args)
  const raw = typeof requestedPath === 'string' ? requestedPath.trim() : ''
  if (raw && shouldUseRequestedPath(raw, args?.storageType)) {
    const resolvedRequestedPath = args?.storageType === 'chatKnowgrph'
      ? toCanonicalKgcWorkspacePath(raw)
      : normalizeWorkspacePath(raw)
    return await ensureWorkspaceFilePathExists(resolvedRequestedPath)
  }
  const cached = sessionAutoPathByScope.get(scopeKey)
  if (cached) {
    const resolvedCachedPath = args?.storageType === 'chatKnowgrph'
      ? toCanonicalKgcWorkspacePath(cached)
      : normalizeWorkspacePath(cached)
    return await ensureWorkspaceFilePathExists(resolvedCachedPath)
  }
  const inflight = sessionAutoInFlightByScope.get(scopeKey)
  if (inflight) return await inflight
  const nextInFlight = (async () => {
    return await createNewChatHistoryWorkspaceFilePath(timestampMs, args)
  })()
  sessionAutoInFlightByScope.set(scopeKey, nextInFlight)
  try {
    return await nextInFlight
  } finally {
    if (sessionAutoInFlightByScope.get(scopeKey) === nextInFlight) {
      sessionAutoInFlightByScope.delete(scopeKey)
    }
  }
}

export const ensureChatHistoryWorkspaceFilePath = async (args: {
  requestedPath: string | null
  timestampMs: number
  storageType?: ChatHistoryStorageType
  defaultLocalRootPath?: string | null
  onResolvedPath?: (path: string) => void
}): Promise<string> => {
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
  if (typeof args.onResolvedPath === 'function') {
    try {
      args.onResolvedPath(path)
    } catch {
      void 0
    }
  }
  return path
}
