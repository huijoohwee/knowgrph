import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  buildKgcDraftEntry,
  buildKgcWorkspaceDocument,
  normalizeKgcAssistantBodyForStorage,
} from './chatHistoryWorkspace.kgc.build'
import { isKgcStructuredMarkdown } from './chatHistoryWorkspace.kgc.parse'
import { normalizeKgcFrontmatterIdentityToFileName } from './chatHistoryWorkspace.kgc.normalize'
import {
  ensureHistoryFilePath,
  resolveFilePrefix,
  toKgcTraceWorkspacePath,
} from './chatHistoryWorkspace.paths'
import type { ChatHistoryWorkspaceAppendArgs, ChatHistoryWorkspaceDraftArgs } from './chatHistoryWorkspace.types'

const inFlightByPath = new Map<string, Promise<void>>()

const wrapFence = (content: string, lang: string): string => {
  const safeLang = String(lang || '').trim() || 'text'
  const safe = String(content || '').replace(/\r\n/g, '\n')
  const ticks = safe.includes('```') ? '````' : '```'
  return [`${ticks}${safeLang}`, safe, ticks].join('\n')
}

const pad2 = (n: number): string => String(n).padStart(2, '0')
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

const looksLikeMirrorableFsPath = (value: string): boolean => {
  const s = String(value || '').trim()
  if (!s) return false
  if (s.startsWith('/')) return true
  if (/^[a-zA-Z]:\\/.test(s) || /^[a-zA-Z]:\//.test(s)) return true
  return (
    s.startsWith('/Users/') ||
    s.startsWith('/home/') ||
    s.startsWith('/Volumes/') ||
    s.startsWith('/private/') ||
    s.startsWith('/tmp/') ||
    s.startsWith('/var/')
  )
}

const mirrorWorkspaceFileToHostFs = async (args: { absolutePath: string; text: string }): Promise<void> => {
  if (typeof window === 'undefined') return
  const abs = String(args.absolutePath || '').trim()
  if (!looksLikeMirrorableFsPath(abs)) return
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 5_000)
    try {
      const res = await fetch('/__kg_fs_write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: abs, text: args.text }),
        signal: controller.signal,
      })
      if (!res.ok) return
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    void 0
  }
}

const stripDraftBlock = (existing: string, traceId: string): string => {
  const start = `<!-- kg-chat-draft:start:${traceId} -->`
  const end = `<!-- kg-chat-draft:end:${traceId} -->`
  const src = String(existing || '')
  const startIdx = src.indexOf(start)
  if (startIdx < 0) return src
  const endIdx = src.indexOf(end, startIdx + start.length)
  if (endIdx < 0) return src.slice(0, startIdx).trimEnd() + '\n'
  return `${src.slice(0, startIdx)}${src.slice(endIdx + end.length)}`.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

const buildChatHistoryHeader = (title: string): string => {
  return [`# ${title}`, '', 'This file is managed by Knowgrph Chat.', ''].join('\n')
}

const buildChatHistoryEntry = (args: {
  timestampMs: number
  traceId: string
  providerSummary: string
  userText: string
  assistantText: string
}): string => {
  const assistantSection = ['### assistant', wrapFence(args.assistantText, 'markdown'), ''].join('\n')
  return [
    `## ${formatReadableTimestamp(args.timestampMs)}`,
    '',
    `Trace-ID: ${args.traceId}`,
    '',
    `Provider: ${String(args.providerSummary || '').trim() || 'unknown'}`,
    '',
    '### user',
    wrapFence(args.userText, 'text'),
    '',
    assistantSection,
  ].join('\n')
}

const appendChatHistoryEntryText = (existingRaw: string, title: string, entry: string): string => {
  const existing = String(existingRaw || '')
  const trimmed = existing.trim()
  const header = trimmed ? '' : buildChatHistoryHeader(title)
  const joiner = existing.endsWith('\n') || !existing ? '' : '\n'
  return [existing, header, entry].filter(Boolean).join(joiner)
}

const writeWorkspaceFileTextEnsuringFile = async (args: {
  fs: Awaited<ReturnType<typeof getWorkspaceFs>>
  path: string
  text: string
}): Promise<void> => {
  const normalized = normalizeWorkspacePath(args.path)
  const existing = await args.fs.readFileText(normalized)
  if (existing === null) {
    const idx = normalized.lastIndexOf('/')
    const parentPath = normalizeWorkspacePath(idx > 0 ? normalized.slice(0, idx) : '/')
    const name = normalized.split('/').filter(Boolean).slice(-1)[0] || ''
    if (name) {
      try {
        await args.fs.createFile({ parentPath, name, text: args.text })
        return
      } catch {
        void 0
      }
    }
  }
  await args.fs.writeFileText(normalized, args.text)
}

export const appendChatHistoryWorkspaceFile = async (args: ChatHistoryWorkspaceAppendArgs): Promise<string> => {
  const prefix = resolveFilePrefix(args)
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
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
    const traceId = String(args.traceId || '').trim() || `trace-${args.timestampMs}`
    const baseTitle = args.title || (prefix === 'kgc' ? 'Knowledge Graph Canvas Storage' : 'Chat History Storage')
    const assistantBody = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
    const kgcAssistantBody = normalizeKgcAssistantBodyForStorage({
      timestampMs: args.timestampMs,
      workspacePath: key,
      requestText: args.userText,
      assistantText: assistantBody || 'No response content.',
    })
    if (prefix === 'kgc') {
      const existingRaw = (await fs.readFileText(key)) || ''
      const normalizedIdentity = normalizeKgcFrontmatterIdentityToFileName({
        markdown: kgcAssistantBody,
        workspacePath: key,
        timestampMs: args.timestampMs,
      })
      const next = buildKgcWorkspaceDocument({ canonicalKgc: normalizedIdentity })
      if (next === existingRaw) return
      await writeWorkspaceFileTextEnsuringFile({ fs, path: key, text: next })
      void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
      const tracePath = toKgcTraceWorkspacePath(key)
      if (tracePath) {
        await writeWorkspaceFileTextEnsuringFile({ fs, path: tracePath, text: next })
        void mirrorWorkspaceFileToHostFs({ absolutePath: tracePath, text: next })
      }
      return
    }
    const tracePath = `${key.replace(/\.md$/i, '')}--${traceId}.md`
    const entry = buildChatHistoryEntry({
      timestampMs: args.timestampMs,
      traceId,
      providerSummary: args.providerSummary,
      userText: args.userText,
      assistantText: args.assistantText,
    })
    await writeWorkspaceFileTextEnsuringFile({ fs, path: tracePath, text: `${entry.trimEnd()}\n` })
    void mirrorWorkspaceFileToHostFs({ absolutePath: tracePath, text: `${entry.trimEnd()}\n` })
    const existingRaw = (await fs.readFileText(key)) || ''
    const next = appendChatHistoryEntryText(existingRaw, baseTitle, entry)
    if (next === existingRaw) return
    await writeWorkspaceFileTextEnsuringFile({ fs, path: key, text: next })
    void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
  })
  inFlightByPath.set(key, run)
  try {
    await run
  } finally {
    if (inFlightByPath.get(key) === run) inFlightByPath.delete(key)
  }
  return key
}

export const upsertChatHistoryWorkspaceDraft = async (args: ChatHistoryWorkspaceDraftArgs): Promise<string> => {
  const prefix = resolveFilePrefix(args)
  const traceId = String(args.traceId || '').trim() || `trace-${args.timestampMs}`
  const path = await ensureHistoryFilePath(args.requestedPath, args.timestampMs, {
    storageType: args.storageType,
    defaultLocalRootPath: args.defaultLocalRootPath,
  })
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
    const existingRaw = (await fs.readFileText(key)) || ''
    if (prefix === 'kgc') {
      const assistantDraftText = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
      // Streaming behavior: avoid dumping fallback template for partial chunks.
      // Only persist canonical KGC during draft when the streamed content is already structured.
      if (!isKgcStructuredMarkdown(assistantDraftText)) {
        const draft = buildKgcDraftEntry({
          timestampMs: args.timestampMs,
          traceId,
          providerSummary: args.providerSummary,
          userText: args.userText,
          assistantText: assistantDraftText || '_Streaming..._',
        })
        const tracePath = toKgcTraceWorkspacePath(key)
        if (tracePath) {
          const traceExistingRaw = (await fs.readFileText(tracePath)) || ''
          const traceExisting = stripDraftBlock(traceExistingRaw, traceId)
          const joiner = traceExisting.endsWith('\n') || !traceExisting ? '' : '\n'
          const next = [traceExisting, draft].filter(Boolean).join(joiner)
          if (next === traceExistingRaw) return
          await writeWorkspaceFileTextEnsuringFile({ fs, path: tracePath, text: next })
          void mirrorWorkspaceFileToHostFs({ absolutePath: tracePath, text: next })
        }
        return
      }
      const canonicalKgc = normalizeKgcAssistantBodyForStorage({
        timestampMs: args.timestampMs,
        workspacePath: key,
        requestText: args.userText,
        assistantText: assistantDraftText,
      })
      const normalizedIdentity = normalizeKgcFrontmatterIdentityToFileName({
        markdown: canonicalKgc,
        workspacePath: key,
        timestampMs: args.timestampMs,
      })
      const next = buildKgcWorkspaceDocument({ canonicalKgc: normalizedIdentity })
      if (next === existingRaw) return
      await writeWorkspaceFileTextEnsuringFile({ fs, path: key, text: next })
      const tracePath = toKgcTraceWorkspacePath(key)
      if (tracePath) {
        await writeWorkspaceFileTextEnsuringFile({ fs, path: tracePath, text: next })
        void mirrorWorkspaceFileToHostFs({ absolutePath: tracePath, text: next })
      }
      if (!existingRaw.trim()) {
        void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
      }
      return
    }
    const baseTitle = args.title || 'Chat History Storage'
    const draft = buildKgcDraftEntry({
      timestampMs: args.timestampMs,
      traceId,
      providerSummary: args.providerSummary,
      userText: args.userText,
      assistantText: args.assistantText,
    })
    const next = appendChatHistoryEntryText(existingRaw, baseTitle, draft)
    if (next === existingRaw) return
    await writeWorkspaceFileTextEnsuringFile({ fs, path: key, text: next })
    if (!existingRaw.trim()) {
      void mirrorWorkspaceFileToHostFs({ absolutePath: key, text: next })
    }
  })
  inFlightByPath.set(key, run)
  try {
    await run
  } finally {
    if (inFlightByPath.get(key) === run) inFlightByPath.delete(key)
  }
  return key
}
