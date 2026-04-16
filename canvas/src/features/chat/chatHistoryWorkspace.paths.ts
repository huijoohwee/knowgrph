import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'

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

const ensureFolderTreeIfMissing = async (folderPath: WorkspacePath): Promise<void> => {
  const normalized = normalizeWorkspacePath(folderPath)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const list = await fs.listEntries()
  const folders = new Set(
    list
      .filter(e => e.kind === 'folder')
      .map(e => normalizeWorkspacePath(e.path)),
  )
  let parent: WorkspacePath = '/'
  for (const seg of segments) {
    const name = String(seg || '').trim()
    if (!name) continue
    const next = normalizeWorkspacePath(`${parent === '/' ? '' : parent}/${name}`)
    if (!folders.has(next)) {
      try {
        await fs.createFolder({ parentPath: parent, name })
        folders.add(next)
      } catch {
        void 0
      }
    }
    parent = next
  }
}

const formatFilename = (prefix: 'chh' | 'kgc', timestampMs: number): string => {
  return `${prefix}_${formatCompactTimestamp(timestampMs)}.md`
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
  storageType?: 'chatKnowgrph' | 'chatHistory'
  defaultLocalRootPath?: string | null
}): string => {
  const prefix = resolveFilePrefix(args)
  const rootRaw = String(args?.defaultLocalRootPath || '').trim()
  const root = normalizeWorkspacePath(rootRaw || '/chats')
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
  await ensureFolderTreeIfMissing(parent)
  const created = await fs.createFile({ parentPath: parent, name, text: '' })
  return normalizeWorkspacePath(created)
}

export const createNewChatHistoryWorkspaceFilePath = async (
  timestampMs: number,
  args?: { storageType?: 'chatKnowgrph' | 'chatHistory'; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const prefix = resolveFilePrefix(args)
  const scopeKey = resolveSessionScopeKey(args)
  const rootPathRaw = String(args?.defaultLocalRootPath || '').trim()
  const folder: WorkspacePath = normalizeWorkspacePath(rootPathRaw || '/chats')
  await ensureFolderTreeIfMissing(folder)
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
  args?: { storageType?: 'chatKnowgrph' | 'chatHistory'; defaultLocalRootPath?: string | null },
): Promise<WorkspacePath> => {
  const scopeKey = resolveSessionScopeKey(args)
  const raw = typeof requestedPath === 'string' ? requestedPath.trim() : ''
  if (raw) return await ensureWorkspaceFilePathExists(raw)
  const cached = sessionAutoPathByScope.get(scopeKey)
  if (cached) return await ensureWorkspaceFilePathExists(cached)
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
  storageType?: 'chatKnowgrph' | 'chatHistory'
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

