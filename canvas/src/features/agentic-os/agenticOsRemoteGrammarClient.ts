import { useEffect, useSyncExternalStore } from 'react'
import { readEnvString } from '@/lib/config.env'
import { isWorkspaceRepoLocalRunReadyBootstrap } from '@/features/workspace-fs/workspaceRunReadyDemos'
import {
  AGENTIC_CANVAS_OS_DOCS_CONTROL_PLANE_PATH,
  AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME,
} from '../../../../mcp/agentic-canvas-os-docs-contract.mjs'
import {
  emptyProgressiveAgentsReadiness,
  normalizeProgressiveAgentsReadiness,
  type AgenticOsProgressiveAgentsReadinessSummary,
} from './agenticOsProgressiveAgentsReadiness'
import { normalizeAgenticOsRemoteGrammarCatalogProvenance } from './agenticOsRemoteGrammarProvenance'

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
  sourceRevision?: string
  liveAgentProviderProof?: unknown
  progressiveAgentsReadiness?: unknown
}

type AgenticOsRemoteGrammarClientOptions = {
  endpoint?: string
  fetchImpl?: typeof fetch
}

export type AgenticOsRemoteGrammarSigil = '/' | '#' | '@'

const DEFAULT_KNOWGRPH_AGENT_READY_BASE_URL = 'https://airvio.co/knowgrph'
const REMOTE_GRAMMAR_SIGIL_ORDER: readonly AgenticOsRemoteGrammarSigil[] = ['/', '#', '@'] as const

const normalizeString = (value: unknown): string => String(value || '').trim()
const normalizeToken = (value: unknown): string => normalizeString(value)
const isLocalhostHost = (value: unknown): boolean => {
  const normalized = normalizeString(value).toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0'
}
const isBareLocalhostOrigin = (value: unknown): boolean => {
  const origin = normalizeString(value)
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const port = normalizeString(parsed.port)
    return isLocalhostHost(parsed.hostname) && !port
  } catch {
    return false
  }
}
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
    if (currentOrigin && (isWorkspaceRepoLocalRunReadyBootstrap() || !isBareLocalhostOrigin(currentOrigin))) {
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
  return `${baseUrl}${AGENTIC_CANVAS_OS_DOCS_CONTROL_PLANE_PATH.replace(/^\/knowgrph/, '')}`
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

export type AgenticOsRemoteGrammarHydrationStatus = 'idle' | 'loading' | 'fresh' | 'stale' | 'blocked'

export type AgenticOsRemoteGrammarCatalogCounts = {
  slash: number
  hash: number
  at: number
}

export type AgenticOsLiveProviderProofSummary = {
  schema: 'agent-live-provider-proof-summary/v1'
  status: 'verified-bounded-live' | 'unavailable'
  evidenceSchema: string
  sourceStatus: string
  sourceRevision: string
  proofRevision: string
  sourcePath: string
  sourceUrl: string
  model: string
  reasoningEffort: string
  providerCalls: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  estimatedCostUsd: number
  finalAnswerOwners: {
    delegation: string
    handoff: string
  }
  continuationContext: string
  defaultWorkerConfigured: boolean
}

export type AgenticOsRemoteGrammarSnapshot = {
  version: number
  entries: readonly AgenticOsRemoteGrammarCatalogEntry[]
  sourceRevision: string
  hydration: {
    status: AgenticOsRemoteGrammarHydrationStatus
    attempts: number
    error: string
  }
  counts: AgenticOsRemoteGrammarCatalogCounts
  liveAgentProviderProof: AgenticOsLiveProviderProofSummary
  progressiveAgentsReadiness: AgenticOsProgressiveAgentsReadinessSummary
}

const emptyLiveProviderProof = (sourceRevision = ''): AgenticOsLiveProviderProofSummary => ({
  schema: 'agent-live-provider-proof-summary/v1',
  status: 'unavailable',
  evidenceSchema: '',
  sourceStatus: '',
  sourceRevision,
  proofRevision: '',
  sourcePath: 'docs/LIVE-AGENT-PROVIDER-PROOF.md',
  sourceUrl: '',
  model: '',
  reasoningEffort: '',
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
  finalAnswerOwners: { delegation: '', handoff: '' },
  continuationContext: '',
  defaultWorkerConfigured: false,
})

const normalizeLiveProviderProof = (value: unknown, sourceRevision: string): AgenticOsLiveProviderProofSummary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyLiveProviderProof(sourceRevision)
  const proof = value as Record<string, unknown>
  const owners = proof.finalAnswerOwners && typeof proof.finalAnswerOwners === 'object' && !Array.isArray(proof.finalAnswerOwners)
    ? proof.finalAnswerOwners as Record<string, unknown>
    : {}
  const numberValue = (candidate: unknown): number => Number.isFinite(Number(candidate)) ? Number(candidate) : 0
  const proofRevision = normalizeString(proof.proofRevision)
  const proofSourceRevision = normalizeString(proof.sourceRevision)
  const evidenceSchema = normalizeString(proof.evidenceSchema)
  const sourceStatus = normalizeString(proof.sourceStatus)
  const model = normalizeString(proof.model)
  const reasoningEffort = normalizeString(proof.reasoningEffort)
  const providerCalls = numberValue(proof.providerCalls)
  const inputTokens = numberValue(proof.inputTokens)
  const outputTokens = numberValue(proof.outputTokens)
  const cachedInputTokens = numberValue(proof.cachedInputTokens)
  const estimatedCostUsd = numberValue(proof.estimatedCostUsd)
  const delegationOwner = normalizeString(owners.delegation)
  const handoffOwner = normalizeString(owners.handoff)
  const continuationContext = normalizeString(proof.continuationContext)
  const verified = proof.schema === 'agent-live-provider-proof-summary/v1'
    && proof.status === 'verified-bounded-live'
    && proofSourceRevision === sourceRevision
    && /^[0-9a-f]{40}$/.test(proofRevision)
    && evidenceSchema === 'agent-live-provider-proof-contract/v1'
    && sourceStatus === 'runtime-ready-dev'
    && Boolean(model && reasoningEffort)
    && Number.isInteger(providerCalls) && providerCalls > 0
    && Number.isInteger(inputTokens) && inputTokens >= 0
    && Number.isInteger(outputTokens) && outputTokens >= 0
    && Number.isInteger(cachedInputTokens) && cachedInputTokens >= 0
    && estimatedCostUsd >= 0
    && delegationOwner === 'manager'
    && handoffOwner === 'specialist'
    && continuationContext === 'all_turns'
    && proof.defaultWorkerConfigured === false
  return {
    schema: 'agent-live-provider-proof-summary/v1',
    status: verified ? 'verified-bounded-live' : 'unavailable',
    evidenceSchema,
    sourceStatus,
    sourceRevision: proofSourceRevision || sourceRevision,
    proofRevision,
    sourcePath: 'docs/LIVE-AGENT-PROVIDER-PROOF.md',
    sourceUrl: /^[0-9a-f]{40}$/.test(proofRevision)
      ? `https://github.com/huijoohwee/agentic-canvas-os/blob/${proofRevision}/docs/LIVE-AGENT-PROVIDER-PROOF.md`
      : '',
    model,
    reasoningEffort,
    providerCalls,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    estimatedCostUsd,
    finalAnswerOwners: {
      delegation: delegationOwner,
      handoff: handoffOwner,
    },
    continuationContext,
    defaultWorkerConfigured: proof.defaultWorkerConfigured === true,
  }
}

let remoteGrammarVersion = 0
let remoteGrammarEntriesByToken = new Map<string, AgenticOsRemoteGrammarCatalogEntry>()
let remoteGrammarSourceRevision = ''
let remoteGrammarHydrationStatus: AgenticOsRemoteGrammarHydrationStatus = 'idle'
let remoteGrammarHydrationAttempts = 0
let remoteGrammarHydrationError = ''
let remoteGrammarHydrationEpoch = 0
let remoteGrammarSuccessfulSigils = new Map<AgenticOsRemoteGrammarSigil, string>()
let remoteGrammarLiveAgentProviderProof = emptyLiveProviderProof()
let remoteGrammarProgressiveAgentsReadiness = emptyProgressiveAgentsReadiness()
const emptyCounts = (): AgenticOsRemoteGrammarCatalogCounts => ({ slash: 0, hash: 0, at: 0 })
let remoteGrammarSnapshot: AgenticOsRemoteGrammarSnapshot = {
  version: remoteGrammarVersion,
  entries: [],
  sourceRevision: '',
  hydration: { status: 'idle', attempts: 0, error: '' },
  counts: emptyCounts(),
  liveAgentProviderProof: remoteGrammarLiveAgentProviderProof,
  progressiveAgentsReadiness: remoteGrammarProgressiveAgentsReadiness,
}
const remoteGrammarListeners = new Set<() => void>()
const remoteGrammarHydrationPromises = new Map<string, Promise<readonly AgenticOsRemoteGrammarCatalogEntry[]>>()
let sharedAgenticOsRemoteGrammarClient = createAgenticOsRemoteGrammarClient()
const beginRemoteGrammarHydrationCycle = () => { remoteGrammarHydrationEpoch += 1; sharedAgenticOsRemoteGrammarClient = createAgenticOsRemoteGrammarClient(); remoteGrammarHydrationPromises.clear() }

const countRemoteGrammarEntries = (entries: readonly AgenticOsRemoteGrammarCatalogEntry[]): AgenticOsRemoteGrammarCatalogCounts => entries.reduce((counts, entry) => {
  const sigil = normalizeSigil(entry.token)
  if (sigil === '/') counts.slash += 1
  if (sigil === '#') counts.hash += 1
  if (sigil === '@') counts.at += 1
  return counts
}, emptyCounts())

const emitRemoteGrammarSnapshot = (): void => {
  remoteGrammarVersion += 1
  const entries = [...remoteGrammarEntriesByToken.values()].sort((left, right) => left.token.localeCompare(right.token))
  remoteGrammarSnapshot = {
    version: remoteGrammarVersion,
    entries,
    sourceRevision: remoteGrammarSourceRevision,
    hydration: {
      status: remoteGrammarHydrationStatus,
      attempts: remoteGrammarHydrationAttempts,
      error: remoteGrammarHydrationError,
    },
    counts: countRemoteGrammarEntries(entries),
    liveAgentProviderProof: remoteGrammarLiveAgentProviderProof,
    progressiveAgentsReadiness: remoteGrammarProgressiveAgentsReadiness,
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
  beginRemoteGrammarHydrationCycle()
  remoteGrammarEntriesByToken = new Map()
  remoteGrammarSourceRevision = ''
  remoteGrammarHydrationStatus = 'idle'
  remoteGrammarHydrationAttempts = 0
  remoteGrammarHydrationError = ''
  remoteGrammarSuccessfulSigils = new Map()
  remoteGrammarLiveAgentProviderProof = emptyLiveProviderProof()
  remoteGrammarProgressiveAgentsReadiness = emptyProgressiveAgentsReadiness()
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
    const sigils = sigilSignature.split(',').filter((value, index, values) => REMOTE_GRAMMAR_SIGIL_ORDER.includes(value as AgenticOsRemoteGrammarSigil) && values.indexOf(value) === index) as AgenticOsRemoteGrammarSigil[]
    if (sigils.length === 0) return
    sigils.forEach(sigil => {
      void primeAgenticOsRemoteGrammarCatalogBySigil(sigil)
    })
  }, [sigilSignature])
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

  const searchCatalogSnapshot = async (query: string, { signal }: { signal?: AbortSignal } = {}): Promise<{
    catalog: AgenticOsRemoteGrammarCatalogEntry[]
    sourceRevision: string
    liveAgentProviderProof: unknown
    progressiveAgentsReadiness: unknown
  }> => {
      const normalizedQuery = normalizeString(query)
      if (!normalizedQuery) return {
        catalog: [],
        sourceRevision: '',
        liveAgentProviderProof: null,
        progressiveAgentsReadiness: null,
      }
      const sessionId = await ensureSession({ signal })
      const invoked = await postRpc({
        jsonrpc: '2.0',
        id: nextId++,
        method: 'tools/call',
        params: {
          name: AGENTIC_CANVAS_OS_DOCS_MCP_TOOL_NAME,
          arguments: { query: normalizedQuery, limit: 500 },
        },
      }, { signal, sessionId })
      if (invoked.rpc.error) {
        throw new Error(String((invoked.rpc.error as { message?: unknown }).message || 'Agentic OS remote grammar tools/call failed'))
      }
      const payload = extractStructuredContent(invoked.rpc)
      return {
        catalog: Array.isArray(payload.catalog) ? payload.catalog : [],
        sourceRevision: normalizeString(payload.sourceRevision),
        liveAgentProviderProof: payload.liveAgentProviderProof,
        progressiveAgentsReadiness: payload.progressiveAgentsReadiness,
      }
  }

  return {
    searchCatalogSnapshot,
    async searchCatalog(query: string, options: { signal?: AbortSignal } = {}): Promise<AgenticOsRemoteGrammarCatalogEntry[]> {
      return (await searchCatalogSnapshot(query, options)).catalog
    },
  }
}
export async function fetchAgenticOsRemoteGrammarCatalog(
  args: { query: string, signal?: AbortSignal },
): Promise<AgenticOsRemoteGrammarCatalogEntry[]> {
  const hydrationEpoch = remoteGrammarHydrationEpoch, client = sharedAgenticOsRemoteGrammarClient
  const payload = await client.searchCatalogSnapshot(args.query, { signal: args.signal })
  if (hydrationEpoch !== remoteGrammarHydrationEpoch) return []
  if (!/^[0-9a-f]{40}$/.test(payload.sourceRevision)) {
    throw new Error('Agentic OS remote grammar response is missing an exact docs revision')
  }
  const sourceBoundCatalog = normalizeAgenticOsRemoteGrammarCatalogProvenance(
    payload.catalog,
    payload.sourceRevision,
  )
  if (remoteGrammarSourceRevision && remoteGrammarSourceRevision !== payload.sourceRevision) {
    remoteGrammarEntriesByToken = new Map()
    remoteGrammarSuccessfulSigils = new Map()
    remoteGrammarLiveAgentProviderProof = emptyLiveProviderProof(payload.sourceRevision)
    remoteGrammarProgressiveAgentsReadiness = emptyProgressiveAgentsReadiness(payload.sourceRevision)
  }
  remoteGrammarSourceRevision = payload.sourceRevision
  remoteGrammarLiveAgentProviderProof = normalizeLiveProviderProof(payload.liveAgentProviderProof, payload.sourceRevision)
  remoteGrammarProgressiveAgentsReadiness = normalizeProgressiveAgentsReadiness(
    payload.progressiveAgentsReadiness,
    payload.sourceRevision,
  )
  const entries = [...registerAgenticOsRemoteGrammarCatalogEntries(sourceBoundCatalog)]
  const normalizedQuery = normalizeString(args.query)
  const sigil = REMOTE_GRAMMAR_SIGIL_ORDER.includes(normalizedQuery as AgenticOsRemoteGrammarSigil)
    ? normalizedQuery as AgenticOsRemoteGrammarSigil
    : null
  if (sigil) remoteGrammarSuccessfulSigils.set(sigil, payload.sourceRevision)
  remoteGrammarHydrationError = ''
  remoteGrammarHydrationStatus = REMOTE_GRAMMAR_SIGIL_ORDER.every(value => remoteGrammarSuccessfulSigils.get(value) === payload.sourceRevision)
    ? 'fresh'
    : 'loading'
  emitRemoteGrammarSnapshot()
  return entries
}

export async function primeAgenticOsRemoteGrammarCatalogBySigil(
  sigil: AgenticOsRemoteGrammarSigil,
  options: { force?: boolean } = {},
): Promise<readonly AgenticOsRemoteGrammarCatalogEntry[]> {
  if (!options.force && remoteGrammarSourceRevision && remoteGrammarSuccessfulSigils.get(sigil) === remoteGrammarSourceRevision) {
    return remoteGrammarSnapshot.entries.filter(entry => normalizeSigil(entry.token) === sigil)
  }
  const hydrationEpoch = remoteGrammarHydrationEpoch, cacheKey = `${hydrationEpoch}:${sigil}`
  if (!remoteGrammarHydrationPromises.has(cacheKey)) {
    const promise = (async () => {
      remoteGrammarHydrationStatus = 'loading'
      remoteGrammarHydrationError = ''
      emitRemoteGrammarSnapshot()
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (hydrationEpoch !== remoteGrammarHydrationEpoch) return []
        remoteGrammarHydrationAttempts = Math.max(remoteGrammarHydrationAttempts, attempt)
        try {
          return await fetchAgenticOsRemoteGrammarCatalog({ query: sigil })
        } catch (error) {
          if (hydrationEpoch !== remoteGrammarHydrationEpoch || (error instanceof DOMException && error.name === 'AbortError')) return []
          remoteGrammarHydrationError = error instanceof Error ? error.message : 'Agentic OS catalog hydration failed'
        }
      }
      if (hydrationEpoch !== remoteGrammarHydrationEpoch) return []
      remoteGrammarHydrationStatus = remoteGrammarSnapshot.entries.length > 0 ? 'stale' : 'blocked'
      emitRemoteGrammarSnapshot()
      return []
    })().finally(() => {
      if (remoteGrammarHydrationPromises.get(cacheKey) === promise) remoteGrammarHydrationPromises.delete(cacheKey)
    })
    remoteGrammarHydrationPromises.set(cacheKey, promise)
  }
  const promise = remoteGrammarHydrationPromises.get(cacheKey)
  return promise || Promise.resolve([])
}

export async function refreshAgenticOsRemoteGrammarCatalog(): Promise<AgenticOsRemoteGrammarSnapshot> {
  beginRemoteGrammarHydrationCycle()
  remoteGrammarSuccessfulSigils = new Map()
  remoteGrammarHydrationAttempts = 0
  remoteGrammarHydrationError = ''
  remoteGrammarHydrationStatus = 'loading'
  emitRemoteGrammarSnapshot()
  await Promise.all(REMOTE_GRAMMAR_SIGIL_ORDER.map(sigil => primeAgenticOsRemoteGrammarCatalogBySigil(sigil, { force: true })))
  return remoteGrammarSnapshot
}
