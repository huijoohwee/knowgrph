import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { writeKgcCompanionOutputBlob, writeKgcCompanionOutputText } from '@/features/chat/chatHistoryWorkspace.output'
import { writeRichMediaWidgetRunOutputArtifact, writeTextWidgetRunOutputArtifact } from '@/features/chat/richMediaRun'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'

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

export async function testWriteTextWidgetRunOutputArtifactLandsInSourceFiles() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const store = useGraphStore.getState()
  const previousSourceFiles = Array.isArray(store.sourceFiles) ? store.sourceFiles.slice() : []
  try {
    resetWorkspaceFsForTests()
    store.setSourceFiles([])
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const writtenPath = await writeTextWidgetRunOutputArtifact({
      workspacePath: '/workspace/current.md',
      node: {
        id: 'text-widget-1',
        type: 'TextGeneration',
        label: 'Text Widget',
        properties: {},
      },
      output: '# Generated Text\n\nWidget output lands in the Editor Workspace.',
      variant: 'text-output',
      fs,
    })

    if (writtenPath !== '/workspace/current-text-widget-text-output.md') {
      throw new Error(`Expected text widget output helper to derive a stable sibling workspace artifact path, got ${String(writtenPath || '')}`)
    }

    const persisted = await fs.readFileText('/workspace/current-text-widget-text-output.md')
    if (persisted !== '# Generated Text\n\nWidget output lands in the Editor Workspace.') {
      throw new Error('Expected text widget output helper to persist generated markdown in Workspace FS')
    }

    const sourcePath = 'workspace:/workspace/current-text-widget-text-output.md'
    const sourceFile = useGraphStore.getState().sourceFiles.find(file => String(file?.source?.path || '') === sourcePath) || null
    if (!sourceFile || sourceFile.enabled !== true || sourceFile.status !== 'idle' || String(sourceFile.text || '') !== persisted) {
      throw new Error(`Expected generated text output artifact to land passively in Source Files, got ${JSON.stringify(useGraphStore.getState().sourceFiles.map(file => ({ name: file.name, source: file.source?.path, enabled: file.enabled, status: file.status, text: file.text })))}`)
    }
  } finally {
    store.setSourceFiles(previousSourceFiles)
    resetWorkspaceFsForTests()
    restoreDom()
    restoreWindow()
  }
}

export async function testWriteRichMediaWidgetRunOutputArtifactLandsManifestInSourceFiles() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  const store = useGraphStore.getState()
  const previousSourceFiles = Array.isArray(store.sourceFiles) ? store.sourceFiles.slice() : []
  const fetchCalls: Array<{ path: string; base64: string; text: string }> = []
  try {
    resetWorkspaceFsForTests()
    store.setSourceFiles([])
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body || '')
      let parsed: { path?: unknown; base64?: unknown; text?: unknown } | null = null
      try {
        parsed = JSON.parse(body) as { path?: unknown; base64?: unknown; text?: unknown }
      } catch {
        parsed = null
      }
      fetchCalls.push({
        path: typeof parsed?.path === 'string' ? parsed.path : '',
        base64: typeof parsed?.base64 === 'string' ? parsed.base64 : '',
        text: typeof parsed?.text === 'string' ? parsed.text : '',
      })
      return { ok: true } as Response
    }) as typeof fetch

    const result = await writeRichMediaWidgetRunOutputArtifact({
      workspacePath: '/workspace/current.md',
      node: {
        id: 'image-widget-1',
        type: 'ImageGeneration',
        label: 'Image Widget',
        properties: {},
      },
      kind: 'image',
      extension: 'png',
      asset: {
        blob: new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }),
        renderUrl: 'data:image/png;base64,iVBORw0KGgo=',
        sourceUrl: 'https://example.invalid/generated.png',
        model: 'test-image-model',
      },
      fs,
    })

    if (result.outputPath !== '/workspace/current-image-widget.png') {
      throw new Error(`Expected rich-media helper to persist the generated binary sibling path, got ${String(result.outputPath || '')}`)
    }
    if (result.outputManifestPath !== '/workspace/current-image-widget-image-output.md') {
      throw new Error(`Expected rich-media helper to persist the editable markdown manifest sibling path, got ${String(result.outputManifestPath || '')}`)
    }
    if (!fetchCalls.some(call => call.path === '/workspace/current-image-widget.png' && call.base64)) {
      throw new Error('Expected rich-media helper to mirror generated binary media to the host file writer')
    }

    const manifestText = await fs.readFileText('/workspace/current-image-widget-image-output.md')
    if (!manifestText || !manifestText.includes('| artifactPath | ./current-image-widget.png |') || !manifestText.includes('![Image Widget](./current-image-widget.png)')) {
      throw new Error(`Expected rich-media helper to write an editable markdown manifest for the generated media, got ${String(manifestText || '')}`)
    }

    const sourcePath = 'workspace:/workspace/current-image-widget-image-output.md'
    const sourceFile = useGraphStore.getState().sourceFiles.find(file => String(file?.source?.path || '') === sourcePath) || null
    if (!sourceFile || sourceFile.enabled !== true || sourceFile.status !== 'idle' || String(sourceFile.text || '') !== manifestText) {
      throw new Error(`Expected generated rich-media manifest to land passively in Source Files, got ${JSON.stringify(useGraphStore.getState().sourceFiles.map(file => ({ name: file.name, source: file.source?.path, enabled: file.enabled, status: file.status, text: file.text })))}`)
    }
  } finally {
    store.setSourceFiles(previousSourceFiles)
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}
