import { useEffect, useSyncExternalStore } from 'react'
import { readEnvString } from '@/lib/config.env'

export type AgenticOsRemoteGrammarCatalogEntry = {
  token: string
  kind?: string
  label?: string
  summary?: string
  intent?: string
  sourcePath?: string
  sourceUrl?: string
  fileName?: string
  keywords?: string[]
}

type AgenticOsRemoteGrammarPayload = {
  ok?: boolean
  catalog?: AgenticOsRemoteGrammarCatalogEntry[]
}

type AgenticOsRemoteGrammarClientOptions = {
  endpoint?: string
  fetchImpl?: typeof fetch
}

export type AgenticOsRemoteGrammarSigil = '/' | '#' | '@'

const DEFAULT_KNOWGRPH_AGENT_READY_BASE_URL = 'https://airvio.co/knowgrph'
const CONTROL_PLANE_PATH = '/knowgrph/control-plane/mcp'
const REMOTE_GRAMMAR_SIGIL_ORDER: readonly AgenticOsRemoteGrammarSigil[] = ['/', '#', '@'] as const

const normalizeString = (value: unknown): string => String(value || '').trim()
const normalizeToken = (value: unknown): string => normalizeString(value)
const normalizeSigil = (value: unknown): AgenticOsRemoteGrammarSigil | null => {
  const token = normalizeToken(value)
  return token.startsWith('/') || token.startsWith('#') || token.startsWith('@')
    ? token[0] as AgenticOsRemoteGrammarSigil
    : null
}

const readKnowgrphAgentReadyBaseUrl = (): string => {
  const configuredBaseUrl = normalizeString(readEnvString('VITE_KNOWGRPH_AGENT_READY_BASE_URL', ''))
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const currentOrigin = normalizeString(window.location?.origin)
    if (currentOrigin) {
      return new URL('/knowgrph/', currentOrigin.endsWith('/') ? currentOrigin : `${currentOrigin}/`)
        .toString()
        .replace(/\/+$/, '')
    }
  }
  return DEFAULT_KNOWGRPH_AGENT_READY_BASE_URL
}

const resolveControlPlaneEndpoint = (endpoint?: string): string => {
  const explicitEndpoint = normalizeString(endpoint)
  if (explicitEndpoint) return explicitEndpoint
  const baseUrl = readKnowgrphAgentReadyBaseUrl()
  return `${baseUrl}${CONTROL_PLANE_PATH.replace(/^\/knowgrph/, '')}`
}

const parseJsonMaybe = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

const parseMcpResponseText = (text: string): Record<string, unknown> | null => {
  const direct = parseJsonMaybe(text)
  if (direct) return direct
  const frames = String(text || '')
    .split(/\r?\n\r?\n/)
    .flatMap(eventText => {
      const dataLines = eventText.split(/\r?\n/).filter(line => line.startsWith('data:'))
      return dataLines.length > 0
        ? [dataLines.map(line => line.slice(5).trimStart()).join('\n')]
        : []
    })
    .map(parseJsonMaybe)
    .filter(Boolean) as Record<string, unknown>[]
  return frames[frames.length - 1] || null
}

const extractStructuredContent = (rpc: Record<string, unknown>): AgenticOsRemoteGrammarPayload => {
  const result = rpc.result
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {}
  const structuredContent = (result as { structuredContent?: unknown }).structuredContent
  if (structuredContent && typeof structuredContent === 'object' && !Array.isArray(structuredContent)) {
    return structuredContent as AgenticOsRemoteGrammarPayload
  }
  const content = (result as { content?: Array<{ type?: string, text?: string }> }).content
  const textBlock = Array.isArray(content)
    ? content.find(block => block && block.type === 'text' && typeof block.text === 'string')
    : null
  if (!textBlock?.text) return {}
  const parsed = parseJsonMaybe(textBlock.text)
  return parsed as AgenticOsRemoteGrammarPayload || {}
}

const normalizeCatalogEntry = (entry: AgenticOsRemoteGrammarCatalogEntry): AgenticOsRemoteGrammarCatalogEntry | null => {
  const token = normalizeToken(entry.token)
  const sigil = normalizeSigil(token)
  if (!token || !sigil) return null
  return {
    token,
    kind: normalizeString(entry.kind).toLowerCase(),
    label: normalizeString(entry.label),
    summary: normalizeString(entry.summary),
    intent: normalizeString(entry.intent),
    sourcePath: normalizeString(entry.sourcePath),
    sourceUrl: normalizeString(entry.sourceUrl),
    fileName: normalizeString(entry.fileName),
    keywords: Array.isArray(entry.keywords) ? entry.keywords.map(normalizeString).filter(Boolean) : [],
  }
}

type AgenticOsRemoteGrammarSnapshot = {
  version: number
  entries: readonly AgenticOsRemoteGrammarCatalogEntry[]
}

let remoteGrammarVersion = 0
let remoteGrammarEntriesByToken = new Map<string, AgenticOsRemoteGrammarCatalogEntry>()
let remoteGrammarSnapshot: AgenticOsRemoteGrammarSnapshot = { version: remoteGrammarVersion, entries: [] }
const remoteGrammarListeners = new Set<() => void>()
const remoteGrammarHydrationPromises = new Map<AgenticOsRemoteGrammarSigil, Promise<readonly AgenticOsRemoteGrammarCatalogEntry[]>>()

const emitRemoteGrammarSnapshot = (): void => {
  remoteGrammarVersion += 1
  remoteGrammarSnapshot = {
    version: remoteGrammarVersion,
    entries: [...remoteGrammarEntriesByToken.values()].sort((left, right) => left.token.localeCompare(right.token)),
  }
  remoteGrammarListeners.forEach(listener => listener())
}

const mergeCatalogEntry = (
  previous: AgenticOsRemoteGrammarCatalogEntry | undefined,
  next: AgenticOsRemoteGrammarCatalogEntry,
): AgenticOsRemoteGrammarCatalogEntry => ({
  token: next.token,
  kind: next.kind || previous?.kind || '',
  label: next.label || previous?.label || '',
  summary: next.summary || previous?.summary || '',
  intent: next.intent || previous?.intent || '',
  sourcePath: next.sourcePath || previous?.sourcePath || '',
  sourceUrl: next.sourceUrl || previous?.sourceUrl || '',
  fileName: next.fileName || previous?.fileName || '',
  keywords: [...new Set([...(previous?.keywords || []), ...(next.keywords || [])])],
})

export function getAgenticOsRemoteGrammarCatalogSnapshot(): AgenticOsRemoteGrammarSnapshot {
  return remoteGrammarSnapshot
}

export function getAgenticOsRemoteGrammarCatalogEntries(): readonly AgenticOsRemoteGrammarCatalogEntry[] {
  return remoteGrammarSnapshot.entries
}

export function registerAgenticOsRemoteGrammarCatalogEntries(
  entries: readonly AgenticOsRemoteGrammarCatalogEntry[],
): readonly AgenticOsRemoteGrammarCatalogEntry[] {
  let changed = false
  const normalizedEntries = entries
    .map(normalizeCatalogEntry)
    .filter(Boolean) as AgenticOsRemoteGrammarCatalogEntry[]
  normalizedEntries.forEach(entry => {
    const previous = remoteGrammarEntriesByToken.get(entry.token)
    const merged = mergeCatalogEntry(previous, entry)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(merged)) {
      remoteGrammarEntriesByToken.set(entry.token, merged)
      changed = true
    }
  })
  if (changed) emitRemoteGrammarSnapshot()
  return normalizedEntries
}

export function resetAgenticOsRemoteGrammarCatalogForTests(): void {
  remoteGrammarHydrationPromises.clear()
  remoteGrammarEntriesByToken = new Map()
  emitRemoteGrammarSnapshot()
}

export function subscribeAgenticOsRemoteGrammarCatalog(listener: () => void): () => void {
  remoteGrammarListeners.add(listener)
  return () => remoteGrammarListeners.delete(listener)
}

export function useAgenticOsRemoteGrammarCatalog(args: {
  sigils?: readonly AgenticOsRemoteGrammarSigil[]
} = {}): AgenticOsRemoteGrammarSnapshot {
  const sigilSignature = (args.sigils || []).join(',')
  const snapshot = useSyncExternalStore(
    subscribeAgenticOsRemoteGrammarCatalog,
    getAgenticOsRemoteGrammarCatalogSnapshot,
    getAgenticOsRemoteGrammarCatalogSnapshot,
  )
  useEffect(() => {
    const sigils = (args.sigils || []).filter((value, index, values) => REMOTE_GRAMMAR_SIGIL_ORDER.includes(value) && values.indexOf(value) === index)
    if (sigils.length === 0) return
    sigils.forEach(sigil => {
      void primeAgenticOsRemoteGrammarCatalogBySigil(sigil)
    })
  }, [args.sigils, sigilSignature])
  return snapshot
}

export function createAgenticOsRemoteGrammarClient(options: AgenticOsRemoteGrammarClientOptions = {}) {
  let nextId = 1
  let mcpSessionId = ''
  let sessionPromise: Promise<string> | null = null

  const postRpc = async (
    body: Record<string, unknown>,
    { signal, sessionId = '' }: { signal?: AbortSignal, sessionId?: string } = {},
  ): Promise<{ rpc: Record<string, unknown>, sessionId: string }> => {
    const response = await (options.fetchImpl || globalThis.fetch)(resolveControlPlaneEndpoint(options.endpoint), {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Agentic OS remote grammar responded ${response.status}`)
    }
    const rpc = parseMcpResponseText(text)
    if (!rpc) {
      throw new Error('Agentic OS remote grammar returned an unreadable MCP payload')
    }
    return {
      rpc,
      sessionId: response.headers.get('mcp-session-id') || sessionId,
    }
  }

  const ensureSession = async ({ signal }: { signal?: AbortSignal } = {}): Promise<string> => {
    if (mcpSessionId) return mcpSessionId
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const initialized = await postRpc({
          jsonrpc: '2.0',
          id: nextId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'knowgrph-canvas', version: '0.1.0' },
          },
        }, { signal })
        if (initialized.rpc.error) {
          throw new Error(String((initialized.rpc.error as { message?: unknown }).message || 'Agentic OS remote grammar initialize failed'))
        }
        if (!initialized.sessionId) {
          throw new Error('Agentic OS remote grammar initialize missing mcp-session-id')
        }
        mcpSessionId = initialized.sessionId
        return mcpSessionId
      })().finally(() => {
        sessionPromise = null
      })
    }
    return sessionPromise
  }

  return {
    async searchCatalog(query: string, { signal }: { signal?: AbortSignal } = {}): Promise<AgenticOsRemoteGrammarCatalogEntry[]> {
      const normalizedQuery = normalizeString(query)
      if (!normalizedQuery) return []
      const sessionId = await ensureSession({ signal })
      const invoked = await postRpc({
        jsonrpc: '2.0',
        id: nextId++,
        method: 'tools/call',
        params: {
          name: 'knowgrph.agentic_canvas_os.docs.invoke',
          arguments: { query: normalizedQuery },
        },
      }, { signal, sessionId })
      if (invoked.rpc.error) {
        throw new Error(String((invoked.rpc.error as { message?: unknown }).message || 'Agentic OS remote grammar tools/call failed'))
      }
      const payload = extractStructuredContent(invoked.rpc)
      return Array.isArray(payload.catalog) ? payload.catalog : []
    },
  }
}

const sharedAgenticOsRemoteGrammarClient = createAgenticOsRemoteGrammarClient()

export async function fetchAgenticOsRemoteGrammarCatalog(
  args: { query: string, signal?: AbortSignal },
): Promise<AgenticOsRemoteGrammarCatalogEntry[]> {
  const entries = await sharedAgenticOsRemoteGrammarClient.searchCatalog(args.query, { signal: args.signal })
  return [...registerAgenticOsRemoteGrammarCatalogEntries(entries)]
}

export async function primeAgenticOsRemoteGrammarCatalogBySigil(
  sigil: AgenticOsRemoteGrammarSigil,
): Promise<readonly AgenticOsRemoteGrammarCatalogEntry[]> {
  if (!remoteGrammarHydrationPromises.has(sigil)) {
    remoteGrammarHydrationPromises.set(sigil, fetchAgenticOsRemoteGrammarCatalog({ query: sigil })
      .catch(error => {
        remoteGrammarHydrationPromises.delete(sigil)
        throw error
      }))
  }
  const promise = remoteGrammarHydrationPromises.get(sigil)
  return promise || Promise.resolve([])
}
