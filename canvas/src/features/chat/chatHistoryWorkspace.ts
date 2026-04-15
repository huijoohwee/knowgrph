import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'

export type ChatHistoryWorkspaceAppendArgs = {
  requestedPath: string | null
  onResolvedPath?: (path: string) => void
  timestampMs: number
  providerSummary: string
  userText: string
  assistantText: string
}

const inFlightByPath = new Map<string, Promise<void>>()

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

const formatReadableTimestamp = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`
}

const wrapFence = (content: string, lang: string): string => {
  const safeLang = String(lang || '').trim() || 'text'
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const open = `\`\`\`\`${safeLang}`
  const close = '````'
  return [open, safe, close].join('\n')
}

const ensureFolderIfMissing = async (folderPath: WorkspacePath): Promise<void> => {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const list = await fs.listEntries()
  const normalized = normalizeWorkspacePath(folderPath)
  const exists = list.some(e => e.kind === 'folder' && normalizeWorkspacePath(e.path) === normalized)
  if (exists) return
  const parent = normalized === '/' ? '/' : normalizeWorkspacePath(normalized.slice(0, normalized.lastIndexOf('/')) || '/')
  const name = normalized === '/' ? '' : normalized.split('/').filter(Boolean).slice(-1)[0]
  if (!name) return
  try {
    await fs.createFolder({ parentPath: parent, name })
  } catch {
    void 0
  }
}

const ensureHistoryFilePath = async (requestedPath: string | null, timestampMs: number): Promise<WorkspacePath> => {
  const raw = typeof requestedPath === 'string' ? requestedPath.trim() : ''
  if (raw) return normalizeWorkspacePath(raw)
  const folder: WorkspacePath = '/chats'
  await ensureFolderIfMissing(folder)
  const fs = await getWorkspaceFs()
  const name = `ch-${formatCompactTimestamp(timestampMs)}.md`
  const created = await fs.createFile({ parentPath: folder, name, text: '' })
  return normalizeWorkspacePath(created)
}

export const appendChatHistoryWorkspaceFile = async (args: ChatHistoryWorkspaceAppendArgs): Promise<void> => {
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs)
  const key = normalizeWorkspacePath(path)
  const previous = inFlightByPath.get(key) || Promise.resolve()
  const run = previous.then(async () => {
    if (typeof args.onResolvedPath === 'function') {
      try {
        args.onResolvedPath(key)
      } catch {
        void 0
      }
    }
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const existing = (await fs.readFileText(key)) || ''
    const header = existing.trim()
      ? ''
      : ['# Chat History', '', 'This file is managed by Knowgrph Chat.', ''].join('\n')
    const entry = [
      `## ${formatReadableTimestamp(args.timestampMs)}`,
      '',
      `Provider: ${String(args.providerSummary || '').trim() || 'unknown'}`,
      '',
      '### user',
      wrapFence(args.userText, 'text'),
      '',
      '### assistant',
      wrapFence(args.assistantText, 'markdown'),
      '',
    ].join('\n')
    const joiner = existing.endsWith('\n') || !existing ? '' : '\n'
    const next = [existing, header, entry].filter(Boolean).join(joiner)
    await fs.writeFileText(key, next)
  })
  inFlightByPath.set(key, run)
  try {
    await run
  } finally {
    if (inFlightByPath.get(key) === run) inFlightByPath.delete(key)
  }
}
