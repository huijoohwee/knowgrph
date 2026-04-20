import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { resetWorkspaceFsForTests, getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { emitKgcRunOutput, resolveKgcRunOutputPreference } from '@/features/chat/kgcRunOutput'

const buildKgcFixture = (formatLine = ''): string => [
  '---',
  'doc:',
  '  id: "doc:kgc:test"',
  '  type: chatKnowgrph',
  'flow:',
  '  nodes:',
  '    - id: n-in',
  '      type: input',
  '      label: "Input"',
  '      data:',
  '        role: "user"',
  '        text: "hello"',
  '    - id: n-out',
  '      type: output',
  '      label: "Output"',
  '      data:',
  '        role: "assistant"',
  ...(formatLine ? [`        ${formatLine}`] : []),
  '        text: "done"',
  '  edges:',
  '    - source: n-in.turn',
  '      target: n-out.turn',
  '---',
  '',
  '# Output heading',
  '',
  'Rendered body.',
  '',
].join('\n')

export function testResolveKgcRunOutputPreferenceReadsOutputNodeFormat() {
  const pngPref = resolveKgcRunOutputPreference({
    canonicalPath: '/sandbox/chat-log/kgc_20260420231505.md',
    canonicalText: buildKgcFixture('format: "png"'),
  })
  if (pngPref.kind !== 'png' || pngPref.extension !== 'png') {
    throw new Error(`expected png output preference, got ${pngPref.kind}.${pngPref.extension}`)
  }

  const svgPref = resolveKgcRunOutputPreference({
    canonicalPath: '/sandbox/chat-log/kgc_20260420231505.md',
    canonicalText: buildKgcFixture('file: "kgc-output_20260420231505.svg"'),
  })
  if (svgPref.kind !== 'svg' || svgPref.extension !== 'svg') {
    throw new Error(`expected svg output preference, got ${svgPref.kind}.${svgPref.extension}`)
  }

  const videoPref = resolveKgcRunOutputPreference({
    canonicalPath: '/sandbox/chat-log/kgc_20260420231505.md',
    canonicalText: buildKgcFixture('format: "video"'),
  })
  if (videoPref.kind !== 'video' || videoPref.extension !== 'mp4') {
    throw new Error(`expected video output preference, got ${videoPref.kind}.${videoPref.extension}`)
  }
}

export async function testEmitKgcRunOutputWritesMarkdownCompanionBody() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch
    const result = await emitKgcRunOutput({
      canonicalPath: '/sandbox/chat-log/kgc_20260420231505.md',
      canonicalText: buildKgcFixture('format: "markdown"'),
      getStore: () => ({
        captureCanvasPngSnapshot: async () => null,
        captureCanvasSvgSnapshot: async () => null,
      }),
    })
    if (result.path !== '/sandbox/chat-log/kgc-output_20260420231505.md') {
      throw new Error(`expected markdown run output path, got ${String(result.path)}`)
    }
    const fs = await getWorkspaceFs()
    const written = await fs.readFileText('/sandbox/chat-log/kgc-output_20260420231505.md')
    if (!written || written.includes('doc:') || !written.includes('# Output heading')) {
      throw new Error('expected markdown run output to write the body markdown without the frontmatter block')
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testEmitKgcRunOutputFallsBackToMarkdownForVideoPreference() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  try {
    resetWorkspaceFsForTests()
    globalThis.fetch = (async () => ({ ok: true } as Response)) as typeof fetch
    const result = await emitKgcRunOutput({
      canonicalPath: '/sandbox/chat-log/kgc_20260420231505.md',
      canonicalText: buildKgcFixture('format: "video"'),
      getStore: () => ({
        captureCanvasPngSnapshot: async () => null,
        captureCanvasSvgSnapshot: async () => null,
      }),
    })
    if (result.kind !== 'video' || result.degraded !== true) {
      throw new Error('expected video run output to report degraded markdown fallback until direct video bytes are available')
    }
    if (result.path !== '/sandbox/chat-log/kgc-output_20260420231505.md') {
      throw new Error(`expected video run output fallback to write markdown companion, got ${String(result.path)}`)
    }
  } finally {
    resetWorkspaceFsForTests()
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}
