import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, joinWorkspacePath, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceImportProgress, WorkspaceImportResult } from './types'
import { coerceHttpUrl } from '@/lib/url'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { hostFromUrl, safeWebsitePathSegment } from '@/lib/websites/websitePathUtils'
import {
  CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH,
  CHAT_DEERFLOW_ENDPOINT_URL,
  CHAT_PROVIDER_DEERFLOW,
  buildChatProxyHeaders,
  resolveChatEndpointForRequest,
  resolveChatEndpointForModels,
} from '@/lib/chatEndpoint'

type DeerFlowIngestManifest = {
  ok?: unknown
  rootUrl?: unknown
  summary?: unknown
  files?: unknown
}

type DeerFlowIngestManifestFile = {
  name?: unknown
  text?: unknown
}

const DEERFLOW_RUNS_WAIT_PATH = '/api/runs/wait'

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const readGatewayErrorFromPayload = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''
  const rec = payload as Record<string, unknown>
  const err = cleanString(rec.error)
  if (err) return err
  const message = cleanString(rec.message)
  if (message) return message
  return ''
}

const resolveDeerFlowRunsWaitEndpoint = (endpointUrl: unknown): string | null => {
  const requestEndpoint = resolveChatEndpointForRequest(endpointUrl || CHAT_DEERFLOW_ENDPOINT_URL)
  if (!requestEndpoint) return null
  const splitAt = requestEndpoint.indexOf('?')
  const pathOnly = splitAt >= 0 ? requestEndpoint.slice(0, splitAt) : requestEndpoint
  if (pathOnly.endsWith(CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH)) {
    return `${pathOnly.slice(0, -CHAT_DEERFLOW_CHAT_COMPLETIONS_PATH.length)}${DEERFLOW_RUNS_WAIT_PATH}`
  }
  if (pathOnly.endsWith('/v1/chat/completions')) {
    return `${pathOnly.slice(0, -'/v1/chat/completions'.length)}${DEERFLOW_RUNS_WAIT_PATH}`
  }
  if (pathOnly.endsWith('/v1/responses')) {
    return `${pathOnly.slice(0, -'/v1/responses'.length)}${DEERFLOW_RUNS_WAIT_PATH}`
  }
  if (pathOnly.endsWith('/')) return `${pathOnly.slice(0, -1)}${DEERFLOW_RUNS_WAIT_PATH}`
  return `${pathOnly}${DEERFLOW_RUNS_WAIT_PATH}`
}

const buildDeerFlowIngestPrompt = (normalizedUrl: string): string => {
  return [
    'Task: ingest a single URL into a workspace as a small set of markdown documents.',
    '',
    `Input URL: ${normalizedUrl}`,
    '',
    'Requirements:',
    '- Fetch the webpage and discover important linked documents (pdf annual reports, investor presentations, earnings call transcripts) when present.',
    '- Download and extract relevant text from discovered PDFs.',
    '- Produce concise, well-structured markdown that is usable as knowledge base content.',
    '- Output MUST be a single JSON object (no extra prose, no code fences).',
    '',
    'JSON schema:',
    '{',
    '  "ok": true,',
    '  "rootUrl": "<normalized input url>",',
    '  "summary": "<1-3 sentence summary>",',
    '  "files": [',
    '    { "name": "index.md", "text": "<markdown>" },',
    '    { "name": "doc-1.md", "text": "<markdown>" }',
    '  ]',
    '}',
    '',
    'Constraints:',
    '- file.name must end with .md and be unique within files.',
    '- file.text must be valid markdown (UTF-8).',
  ].join('\n')
}

const tryParseJsonObject = (raw: string): unknown | null => {
  const text = String(raw || '').trim()
  if (!text.startsWith('{') || !text.endsWith('}')) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const extractJsonFromMaybeMarkdownFence = (text: string): string => {
  const raw = String(text || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced && fenced[1]) return String(fenced[1]).trim()
  return raw.trim()
}

const findFirstJsonManifest = (payload: unknown): DeerFlowIngestManifest | null => {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }]
  const seen = new Set<unknown>()
  while (queue.length) {
    const item = queue.shift()
    if (!item) break
    const { value, depth } = item
    if (depth > 7) continue
    if (!value) continue
    if (typeof value === 'string') {
      const candidateText = extractJsonFromMaybeMarkdownFence(value)
      const parsed = tryParseJsonObject(candidateText)
      if (parsed && typeof parsed === 'object') {
        const rec = parsed as Record<string, unknown>
        if (rec.ok === true && Array.isArray(rec.files)) return parsed as DeerFlowIngestManifest
      }
      continue
    }
    if (typeof value !== 'object') continue
    if (seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (const v of value) queue.push({ value: v, depth: depth + 1 })
      continue
    }
    const rec = value as Record<string, unknown>
    const direct = (() => {
      if (rec.ok === true && Array.isArray(rec.files)) return rec as DeerFlowIngestManifest
      return null
    })()
    if (direct) return direct
    for (const v of Object.values(rec)) queue.push({ value: v, depth: depth + 1 })
  }
  return null
}

const coerceManifestFiles = (raw: unknown): Array<{ name: string; text: string }> => {
  if (!Array.isArray(raw)) return []
  const out: Array<{ name: string; text: string }> = []
  const used = new Set<string>()
  for (const entry of raw) {
    const nameRaw = cleanString((entry as DeerFlowIngestManifestFile | null)?.name)
    const text = cleanString((entry as DeerFlowIngestManifestFile | null)?.text)
    if (!text) continue
    const base = safeWebsitePathSegment(nameRaw.replace(/\.[^.]+$/i, '') || 'doc')
    const normalized = `${base}.md`
    let name = normalized
    if (used.has(name)) {
      let n = 2
      while (used.has(`${base}-${n}.md`)) n += 1
      name = `${base}-${n}.md`
    }
    used.add(name)
    out.push({ name, text })
  }
  return out
}

async function ensureFolderPath(fs: WorkspaceFs, path: WorkspacePath): Promise<WorkspacePath> {
  const normalized = normalizeWorkspacePath(path)
  const parts = normalized.split('/').filter(Boolean)
  let parent = WORKSPACE_ROOT_PATH
  for (const seg of parts) {
    const name = safeWebsitePathSegment(seg)
    const nextPath = joinWorkspacePath(parent, name)
    try {
      await fs.createFolder({ parentPath: parent, name })
    } catch {
      void 0
    }
    parent = nextPath
  }
  return parent
}

async function upsertWorkspaceFile(args: { fs: WorkspaceFs; parentPath: WorkspacePath; name: string; text: string }): Promise<WorkspacePath> {
  const fs = args.fs
  const safeName = safeWebsitePathSegment(args.name.replace(/\.[^.]+$/i, '') || 'doc') + '.md'
  const absPath = normalizeWorkspacePath(joinWorkspacePath(args.parentPath, safeName))
  const existing = await fs.readFileText(absPath).catch(() => null)
  if (existing == null) {
    try {
      return await fs.createFile({ parentPath: args.parentPath, name: safeName, text: args.text })
    } catch {
      await fs.writeFileText(absPath, args.text)
      return absPath
    }
  }
  if (existing !== args.text) await fs.writeFileText(absPath, args.text)
  return absPath
}

export async function importWorkspaceUrlViaDeerFlow(args: {
  fs: WorkspaceFs
  urlRaw: string
  parentPath: WorkspacePath
  deerflow?: { endpointUrl?: unknown; apiKey?: unknown; model?: unknown; assistantId?: unknown } | null
  onProgress?: (progress: WorkspaceImportProgress) => void
}): Promise<WorkspaceImportResult> {
  const createdPaths: WorkspacePath[] = []
  const sources: WorkspaceImportResult['sources'] = []
  const skipped: WorkspaceImportResult['skipped'] = []
  const failed: WorkspaceImportResult['failed'] = []

  const cleanedInput = String(args.urlRaw || '').trim()
  const normalizedUrl = coerceHttpUrl(cleanedInput) || cleanedInput
  if (!normalizedUrl) {
    return { createdPaths, sources, skipped, failed: [{ name: 'url', error: 'Missing URL' }] }
  }
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error: 'Unsupported URL' }] }
  }

  const endpoint = resolveDeerFlowRunsWaitEndpoint(args.deerflow?.endpointUrl)
  if (!endpoint) {
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error: 'DeerFlow endpoint is not configured' }] }
  }

  const onProgress = typeof args.onProgress === 'function' ? args.onProgress : null
  onProgress?.({ phase: 'fetching', current: 0, total: 1, label: 'DeerFlow ingest…' })

  const requestId = `kg-deerflow-ingest-${Date.now().toString(36)}`
  const assistantId = cleanString(args.deerflow?.assistantId) || 'lead_agent'
  const model = cleanString(args.deerflow?.model)
  const payload = {
    assistant_id: assistantId,
    input: { messages: [{ role: 'user', content: buildDeerFlowIngestPrompt(normalizedUrl) }] },
    ...(model ? { config: { configurable: { model } } } : {}),
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...buildChatProxyHeaders({
        provider: CHAT_PROVIDER_DEERFLOW,
        apiKey: args.deerflow?.apiKey,
        endpointUrl: args.deerflow?.endpointUrl || CHAT_DEERFLOW_ENDPOINT_URL,
        clientRequestId: requestId,
      }),
    },
    body: JSON.stringify(payload),
  })

  const json = (await res.json().catch(() => null)) as unknown
  if (!res.ok || !json || typeof json !== 'object') {
    const message = json ? readGatewayErrorFromPayload(json) : ''
    const status = `HTTP ${res.status}`
    const error = message ? `${status}: ${message}` : status
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error }] }
  }
  const upstreamError = readGatewayErrorFromPayload(json)
  if (upstreamError && upstreamError !== 'ok') {
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error: upstreamError }] }
  }

  const manifest = findFirstJsonManifest(json)
  if (!manifest || manifest.ok !== true) {
    const modelsEndpoint = resolveChatEndpointForModels(args.deerflow?.endpointUrl || CHAT_DEERFLOW_ENDPOINT_URL)
    const modelsHint = modelsEndpoint ? ` (models: ${modelsEndpoint})` : ''
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error: `DeerFlow ingest response did not include a valid manifest${modelsHint}` }] }
  }

  const files = coerceManifestFiles(manifest.files)
  if (files.length === 0) {
    return { createdPaths, sources, skipped, failed: [{ name: normalizedUrl, error: 'DeerFlow ingest produced no files' }] }
  }

  const host = hostFromUrl(normalizedUrl) || 'source'
  const key = hashStringToHex(normalizedUrl).slice(0, 10) || Date.now().toString(36)
  const folderName = safeWebsitePathSegment(`${host}-${key}`)
  const outputParent = await ensureFolderPath(args.fs, joinWorkspacePath(joinWorkspacePath(args.parentPath, 'deerflow'), folderName))

  onProgress?.({ phase: 'writing', current: 0, total: files.length, label: 'Writing workspace files…' })
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    onProgress?.({ phase: 'writing', current: i, total: files.length, label: `Writing ${file.name}…` })
    const path = await upsertWorkspaceFile({ fs: args.fs, parentPath: outputParent, name: file.name, text: file.text })
    createdPaths.push(path)
    const source: WorkspaceEntrySource = { kind: 'url', url: normalizedUrl }
    sources.push({ path, source })
  }

  return { createdPaths, sources, skipped, failed }
}
