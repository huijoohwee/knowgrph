import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { writeKgcCompanionOutputBlob, writeKgcCompanionOutputText } from '@/features/chat/chatHistoryWorkspace.output'

export async function testWriteKgcCompanionOutputTextCreatesSiblingWorkspaceArtifact() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  const fetchCalls: Array<{ path: string; text: string }> = []
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body || '')
      let parsed: { path?: unknown; text?: unknown } | null = null
      try {
        parsed = JSON.parse(body) as { path?: unknown; text?: unknown }
      } catch {
        parsed = null
      }
      fetchCalls.push({
        path: typeof parsed?.path === 'string' ? parsed.path : '',
        text: typeof parsed?.text === 'string' ? parsed.text : '',
      })
      return { ok: true } as Response
    }) as typeof fetch

    const writtenPath = await writeKgcCompanionOutputText({
      workspacePath: '/chat-log/kgc_20260420105432.md',
      extension: 'html',
      variant: 'viewer',
      text: '<!doctype html><html><body>viewer</body></html>',
    })

    if (writtenPath !== '/chat-log/20260420T105432Z/kgc-output_20260420T105432Z-viewer.html') {
      throw new Error('Expected KGC output helper to derive the canonical sibling output path')
    }

    const fs = await getWorkspaceFs()
    const persisted = await fs.readFileText('/chat-log/20260420T105432Z/kgc-output_20260420T105432Z-viewer.html')
    if (persisted !== '<!doctype html><html><body>viewer</body></html>') {
      throw new Error('Expected KGC output helper to persist the companion workspace artifact text')
    }

    if (!fetchCalls.some(call => call.path === '/chat-log/20260420T105432Z/kgc-output_20260420T105432Z-viewer.html')) {
      throw new Error('Expected KGC output helper to mirror the companion artifact to the host file writer endpoint')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testWriteKgcCompanionOutputBlobMirrorsBinaryArtifactToHostWriter() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  const fetchCalls: Array<{ path: string; base64: string; encoding: string }> = []
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body || '')
      let parsed: { path?: unknown; base64?: unknown; encoding?: unknown } | null = null
      try {
        parsed = JSON.parse(body) as { path?: unknown; base64?: unknown; encoding?: unknown }
      } catch {
        parsed = null
      }
      fetchCalls.push({
        path: typeof parsed?.path === 'string' ? parsed.path : '',
        base64: typeof parsed?.base64 === 'string' ? parsed.base64 : '',
        encoding: typeof parsed?.encoding === 'string' ? parsed.encoding : '',
      })
      return { ok: true } as Response
    }) as typeof fetch

    const blob = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
    const writtenPath = await writeKgcCompanionOutputBlob({
      workspacePath: '/chat-log/kgc_20260420105432.md',
      extension: 'png',
      blob,
    })

    if (writtenPath !== '/chat-log/20260420T105432Z/kgc-output_20260420T105432Z.png') {
      throw new Error('Expected binary KGC output helper to derive the canonical sibling PNG path')
    }

    const mirrored = fetchCalls.find(call => call.path === '/chat-log/20260420T105432Z/kgc-output_20260420T105432Z.png')
    if (!mirrored) {
      throw new Error('Expected binary KGC output helper to mirror the companion artifact to the host file writer endpoint')
    }
    if (mirrored.encoding !== 'base64' || !mirrored.base64) {
      throw new Error('Expected binary KGC output helper to send base64-encoded bytes to the host file writer endpoint')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}
