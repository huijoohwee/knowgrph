import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import {
  appendChatHistoryWorkspaceFile,
  upsertChatHistoryWorkspaceDraft,
} from '@/features/chat/chatHistoryWorkspace'
import { toKgcTraceWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

const readBaseTemplateSample = (): string => {
  const candidates = [
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-chat-response-base-template.md'),
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'template', 'kgc-ai-pipeline-chat-response-base-template.md'),
  ]
  const path = candidates.find(candidate => existsSync(candidate)) || candidates[0]!
  return readFileSync(path, 'utf8')
}

export async function testChatHistoryWorkspaceDraftWritesOnlyKgcTraceDuringStreaming() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  const fetchCalls: string[] = []
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push(`${String(input)}\n${String(init?.body || '')}`)
      return { ok: true } as Response
    }) as typeof fetch

    const canonicalPath = '/chat-log/20260430T120000Z/kgc_20260430T120000Z.md'
    await upsertChatHistoryWorkspaceDraft({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_000_000,
      providerSummary: 'OpenAI · test',
      userText: 'hello',
      assistantText: 'partial chunk',
      storageType: 'chatKnowgrph',
      traceId: 'trace-1',
      title: 'Knowledge Graph Canvas Storage',
    })

    const fs = await getWorkspaceFs()
    const canonicalText = await fs.readFileText(canonicalPath)
    const tracePath = toKgcTraceWorkspacePath(canonicalPath)
    const traceText = tracePath ? await fs.readFileText(tracePath) : null

    if (canonicalText && canonicalText.trim()) {
      throw new Error('expected KGC streaming draft writes to avoid rewriting the canonical workspace file')
    }
    if (!traceText || !traceText.includes('kg-chat-draft:start:trace-1')) {
      throw new Error('expected KGC streaming draft writes to persist only the trace companion draft block')
    }
    if (fetchCalls.some(call => call.includes('kgc-trace_20260430T120000Z.md'))) {
      throw new Error('expected partial KGC draft writes to avoid mirroring kgc-trace companion drafts to the host chat-log path')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testChatHistoryWorkspaceFinalizeAppendsCanonicalHistoryEntry() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch

    const historyPath = await appendChatHistoryWorkspaceFile({
      requestedPath: '/chat-log/chh_20260430120500.md',
      timestampMs: 1_746_000_100_000,
      providerSummary: 'OpenAI · test',
      userText: 'question',
      assistantText: 'answer',
      storageType: 'chatHistory',
      traceId: 'trace-2',
      title: 'Chat History Storage',
    })

    const fs = await getWorkspaceFs()
    const canonicalText = await fs.readFileText(historyPath)
    const traceText = await fs.readFileText('/chat-log/chh_20260430120500--trace-2.md')

    if (!canonicalText || !canonicalText.includes('Trace-ID: trace-2')) {
      throw new Error('expected chat history finalize to keep one canonical history file with the finalized entry')
    }
    if (!traceText || !traceText.includes('### assistant')) {
      throw new Error('expected chat history finalize to persist a per-trace shard alongside the canonical file')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testChatHistoryWorkspaceStructuredDraftDoesNotRewriteKgcTrace() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch

    const canonicalPath = '/chat-log/20260430T120500Z/kgc_20260430T120500Z.md'
    await upsertChatHistoryWorkspaceDraft({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_300_000,
      providerSummary: 'OpenAI · test',
      userText: 'Generate a structured KGC',
      assistantText: 'partial chunk',
      storageType: 'chatKnowgrph',
      traceId: 'trace-structured-draft',
      title: 'Knowledge Graph Canvas Storage',
    })

    const fs = await getWorkspaceFs()
    const tracePath = toKgcTraceWorkspacePath(canonicalPath)
    const traceBefore = tracePath ? await fs.readFileText(tracePath) : null
    const canonicalBefore = await fs.readFileText(canonicalPath)

    await upsertChatHistoryWorkspaceDraft({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_300_000,
      providerSummary: 'OpenAI · test',
      userText: 'Generate a structured KGC',
      assistantText: readBaseTemplateSample(),
      storageType: 'chatKnowgrph',
      traceId: 'trace-structured-draft',
      title: 'Knowledge Graph Canvas Storage',
    })

    const traceAfter = tracePath ? await fs.readFileText(tracePath) : null
    const canonicalAfter = await fs.readFileText(canonicalPath)

    if (!traceBefore || !traceBefore.includes('kg-chat-draft:start:trace-structured-draft')) {
      throw new Error('expected initial partial draft to persist the draft block in the trace companion')
    }
    if (traceAfter !== traceBefore) {
      throw new Error('expected structured draft persistence to avoid rewriting the trace companion before finalize')
    }
    if (!canonicalAfter || canonicalAfter === canonicalBefore) {
      throw new Error('expected structured draft persistence to update the canonical KGC workspace document')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testChatHistoryWorkspaceFinalizeUpdatesStaleKgcTraceOnce() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch

    const canonicalPath = '/chat-log/20260430T121000Z/kgc_20260430T121000Z.md'
    const tracePath = toKgcTraceWorkspacePath(canonicalPath)
    const structured = readBaseTemplateSample()

    await upsertChatHistoryWorkspaceDraft({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_600_000,
      providerSummary: 'OpenAI · test',
      userText: 'Generate a structured KGC',
      assistantText: 'partial chunk',
      storageType: 'chatKnowgrph',
      traceId: 'trace-finalize-upgrade',
      title: 'Knowledge Graph Canvas Storage',
    })
    await upsertChatHistoryWorkspaceDraft({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_600_000,
      providerSummary: 'OpenAI · test',
      userText: 'Generate a structured KGC',
      assistantText: structured,
      storageType: 'chatKnowgrph',
      traceId: 'trace-finalize-upgrade',
      title: 'Knowledge Graph Canvas Storage',
    })

    const fs = await getWorkspaceFs()
    const traceBeforeFinalize = tracePath ? await fs.readFileText(tracePath) : null
    await appendChatHistoryWorkspaceFile({
      requestedPath: canonicalPath,
      timestampMs: 1_746_000_600_000,
      providerSummary: 'OpenAI · test',
      userText: 'Generate a structured KGC',
      assistantText: structured,
      storageType: 'chatKnowgrph',
      traceId: 'trace-finalize-upgrade',
      title: 'Knowledge Graph Canvas Storage',
    })
    const traceAfterFinalize = tracePath ? await fs.readFileText(tracePath) : null
    const canonicalAfterFinalize = await fs.readFileText(canonicalPath)

    if (!traceBeforeFinalize || !traceBeforeFinalize.includes('kg-chat-draft:start:trace-finalize-upgrade')) {
      throw new Error('expected trace companion to still hold the streaming draft before finalize')
    }
    if (!traceAfterFinalize || traceAfterFinalize !== canonicalAfterFinalize) {
      throw new Error('expected finalize to upgrade the trace companion to the canonical KGC document once')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}
