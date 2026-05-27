import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import {
  appendChatHistoryWorkspaceFile,
  upsertChatHistoryWorkspaceDraft,
} from '@/features/chat/chatHistoryWorkspace'
import { toKgcTraceWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'

export async function testChatHistoryWorkspaceDraftWritesOnlyKgcTraceDuringStreaming() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch

    const canonicalPath = '/sandbox/chat-log/20260430T120000Z/kgc_20260430T120000Z.md'
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
      requestedPath: '/sandbox/chat-log/chh_20260430120500.md',
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
    const traceText = await fs.readFileText('/sandbox/chat-log/chh_20260430120500--trace-2.md')

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
