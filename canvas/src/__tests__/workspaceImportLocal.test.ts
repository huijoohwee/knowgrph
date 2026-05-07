import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { importLocalFilesFallback } from '@/features/toolbar/launchDropdownFallbacks'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  isPendingLocalImportStubText,
  peekPendingWorkspaceLocalImport,
} from '@/features/markdown-workspace/workspaceImport'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importActions'
import { shouldApplyImportedCanvasDocumentToGraph } from '@/features/markdown-workspace/useWorkspaceFileActions/importActions'
import { resolveWorkspaceFileJsonLdExport } from '@/features/markdown-workspace/workspaceImport/workspaceFileJsonLd'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES } from '@/lib/config'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import {
  KNOWGRPH_VIDEO_DEMO_BASENAME,
  KNOWGRPH_VIDEO_DEMO_WORKSPACE_PATH,
  readDocsSsotFixtureText,
} from '@/tests/lib/docsSsotFixture'

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

export async function testWorkspaceImportLocalFilesCreatesExpectedEntries() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const files = [createFile('a.md', '# A\n'), createFile('b.txt', 'hello\n')]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 2) throw new Error('expected 2 created paths')

    const entries = await fs.listEntries()
    const names = entries.filter(e => e.kind === 'file').map(e => e.name).sort()
    if (!names.includes('a.md') || !names.includes('b.txt')) {
      throw new Error(`expected imported files to exist, got: ${names.join(', ')}`)
    }
  } finally {
    restore()
  }
}

export async function testLaunchDropdownImportLocalFilesFallbackActivatesWorkspaceAndCanvasState() {
  const { restore } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    const store = useGraphStore.getState()
    store.resetAll()
    store.setWorkspaceViewMode('canvas')

    const text = ['---', 'mermaid: |', '  graph LR', '    A --> B', '---', '', '# Imported', ''].join('\n')
    const file = createFile('imported.md', text)
    await importLocalFilesFallback({
      files: [file] as unknown as FileList,
      pushUiToast: () => void 0,
    })

    const next = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    if (String(next.markdownDocumentText || '').trim().length === 0) {
      throw new Error('expected fallback local import to set non-empty markdownDocumentText')
    }
    if (String(next.markdownDocumentName || '').trim() !== 'imported.md') {
      throw new Error(`expected fallback local import to set markdownDocumentName to imported.md, got ${String(next.markdownDocumentName || '')}`)
    }
    if (String(explorer.activePath || '').trim() !== '/imported.md') {
      throw new Error(`expected fallback local import to set explorer activePath /imported.md, got ${String(explorer.activePath || '')}`)
    }
    if (next.workspaceViewMode !== 'canvas') {
      throw new Error(`expected fallback local import to preserve canvas mode, got ${String(next.workspaceViewMode || '')}`)
    }
    const fs = await getWorkspaceFs()
    const entries = await fs.listEntries()
    const importedPath = entries.find(e => e.kind === 'file' && e.name === 'imported.md')?.path || ''
    if (!importedPath) throw new Error('expected imported.md to exist in workspace fs')
    const importedText = await fs.readFileText(importedPath)
    if (String(importedText || '').trim().length === 0) {
      throw new Error('expected imported.md workspace file text to be non-empty')
    }
  } finally {
    restore()
  }
}

export async function testLaunchDropdownImportLocalFilesFallbackAppliesCanvasFrontmatterLanding() {
  const { restore } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    const store = useGraphStore.getState()
    store.resetAll()
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)

    const text = [
      '---',
      'title: "Video Demo"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "flowEditor"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: true',
      'kgMultiDimTableModeEnabled: false',
      '$schema: "kgc-pipeline/v1"',
      'widget_bundle:',
      '  kind: kg:flow:widgetBundle',
      'flow:',
      '  nodes: []',
      '---',
      '',
      '# Imported Video Demo',
      '',
    ].join('\n')
    const file = createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, text)
    await importLocalFilesFallback({
      files: [file] as unknown as FileList,
      pushUiToast: () => void 0,
    })

    const next = useGraphStore.getState()
    if (next.canvasRenderMode !== '2d') {
      throw new Error(`expected fallback import to keep 2d canvas mode, got ${String(next.canvasRenderMode || '')}`)
    }
    if (next.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected fallback import to apply Flow Editor renderer, got ${String(next.canvas2dRenderer || '')}`)
    }
    if (next.documentSemanticMode !== 'document') {
      throw new Error(`expected fallback import to apply document semantic mode, got ${String(next.documentSemanticMode || '')}`)
    }
    if (next.frontmatterModeEnabled !== true) {
      throw new Error('expected fallback import to enable frontmatter mode for canvas-frontmatter markdown')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceImportLocalFilesSvgPreservesBytes() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">', '<circle cx="5" cy="5" r="4"/>', '</svg>', ''].join('\n')
    const files = [createFile('icon.svg', svg)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const svgPath = entries.find(e => e.kind === 'file' && e.name === 'icon.svg')?.path || ''
    if (!svgPath) throw new Error('expected icon.svg to be created')

    const text = await fs.readFileText(svgPath)
    if (text !== svg) throw new Error(`expected icon.svg contents to match exactly, got: ${JSON.stringify(text)}`)
  } finally {
    restore()
  }
}

export async function testWorkspaceImportLargeLocalFileDefersHydrationUntilOpen() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const largeText = 'x'.repeat(Math.max(WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES + 32, 1024))
    const files = [createFile('large.json', largeText)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const largePath = entries.find(e => e.kind === 'file' && e.name === 'large.json')?.path || ''
    if (!largePath) throw new Error('expected large.json to be created')

    const before = await fs.readFileText(largePath)
    if (!before || !isPendingLocalImportStubText(before)) {
      throw new Error('expected large local import to write pending-import stub instead of eager file contents')
    }
    const pending = peekPendingWorkspaceLocalImport(largePath)
    if (!pending) throw new Error('expected pending local import handle for large.json')

    const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: largePath })
    if (!hydrated || hydrated.text !== largeText) {
      throw new Error('expected hydration to restore original large file text')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceImportWorkspaceFileJsonLdPreservesHighFidelityJsonLdFile() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const payload = {
      '@context': {
        kg: 'http://example.org/kg#',
        version: 'kg:version',
        document: 'kg:document',
        path: 'kg:path',
        text: 'kg:text',
      },
      '@type': 'kg:WorkspaceFile',
      version: 1,
      document: {
        '@type': 'kg:WorkspaceDocument',
        path: 'docs/note.md',
        text: '# Note\n',
      },
    }

    const files = [createFile('note.workspace.jsonld', `${JSON.stringify(payload, null, 2)}\n`)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const notePath = entries.find(e => e.kind === 'file' && e.name === 'note.workspace.jsonld')?.path || ''
    if (!notePath) throw new Error('expected note.workspace.jsonld to be preserved as a workspace file')

    const text = await fs.readFileText(notePath)
    if (text !== `${JSON.stringify(payload, null, 2)}\n`) {
      throw new Error(`expected workspace jsonld contents to round-trip exactly, got: ${JSON.stringify(text)}`)
    }
  } finally {
    restore()
  }
}

export function testWorkspaceFileJsonLdExportPreservesExistingHighFidelityDocument() {
  const payload = {
    '@context': {
      kg: 'http://example.org/kg#',
      version: 'kg:version',
      document: 'kg:document',
      path: 'kg:path',
      text: 'kg:text',
    },
    '@type': 'kg:WorkspaceFile',
    version: 1,
    document: {
      '@type': 'kg:WorkspaceDocument',
      path: 'docs/note.mdx',
      text: '# Note MDX\n',
    },
  }
  const raw = `${JSON.stringify(payload, null, 2)}\n`
  const exported = resolveWorkspaceFileJsonLdExport({
    activeDocumentPath: '/imports/note.workspace.jsonld',
    exportBaseName: 'note',
    text: raw,
  })
  if (exported.name !== 'note.workspace.jsonld') {
    throw new Error(`expected export to preserve original workspace jsonld filename, got ${exported.name}`)
  }
  if (exported.text !== raw) {
    throw new Error('expected export to preserve existing workspace jsonld content without nested wrapping')
  }
}

export async function testWorkspaceImportDoesNotAcceptLegacyKgw() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const supported = createFile('ok.md', '# ok\n')
    const legacy = createFile(
      'legacy.kgw',
      `${JSON.stringify(
        {
          kind: 'kg:workspaceFile',
          version: 1,
          document: { path: 'legacy.md', text: '# Legacy\n' },
        },
        null,
        2,
      )}\n`,
    )

    const res = await importWorkspaceLocalFiles({ fs, files: [supported, legacy], parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error(`expected 1 created path, got ${res.createdPaths.length}`)
    if (!res.skipped.some(s => s.name === 'legacy.kgw' && s.reason === 'unsupported')) {
      throw new Error('expected legacy.kgw to be skipped as unsupported')
    }

    const entries = await fs.listEntries()
    const hasLegacy = entries.some(e => e.kind === 'file' && e.name === 'legacy.kgw')
    if (hasLegacy) throw new Error('expected legacy.kgw not to be imported into workspace fs')
  } finally {
    restore()
  }
}

export async function testWorkspaceImportLocalFolderCreatesNestedFolders() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const file = createFile('note.md', '# Note\n')
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'MyFolder/sub/note.md',
      configurable: true,
    })

    const files = [file]
    const res = await importWorkspaceLocalFolder({ fs, files })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const hasMyFolder = entries.some(e => e.kind === 'folder' && e.name === 'MyFolder')
    const hasSub = entries.some(e => e.kind === 'folder' && e.name === 'sub')
    const hasNote = entries.some(e => e.kind === 'file' && e.name === 'note.md')
    if (!hasMyFolder || !hasSub || !hasNote) {
      throw new Error('expected nested folder import to create folders and file')
    }

    const notePath = entries.find(e => e.kind === 'file' && e.name === 'note.md')?.path || ''
    if (!notePath) throw new Error('expected note.md path')
    const before = await fs.readFileText(notePath)
    if (!before || !isPendingLocalImportStubText(before)) {
      throw new Error('expected folder import to write a pending-import stub instead of eager file contents')
    }
    const pending = peekPendingWorkspaceLocalImport(notePath)
    if (!pending) throw new Error('expected pending local import handle for note.md')
    const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: notePath })
    if (!hydrated || hydrated.text.trim() !== '# Note') {
      throw new Error('expected hydration to load original file text')
    }
    const after = await fs.readFileText(notePath)
    if (!after || !after.includes('# Note')) throw new Error('expected hydrated file to be written into workspace fs')
  } finally {
    restore()
  }
}

export async function testNormalizeWorkspacePathCollapsesExtraSlashes() {
  const actual = normalizeWorkspacePath('///a//b///c.md')
  if (actual !== '/a/b/c.md') throw new Error(`expected /a/b/c.md, got: ${actual}`)
}

export async function testWorkspaceImportSkipsUnsupportedFilesButContinues() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const supported = createFile('ok.md', '# ok\n')
    const unsupported = new File([new Blob(['x'], { type: 'image/png' })], 'image.png', { type: 'image/png' })

    Object.defineProperty(supported, 'webkitRelativePath', { value: 'MyFolder/ok.md', configurable: true })
    Object.defineProperty(unsupported, 'webkitRelativePath', { value: 'MyFolder/image.png', configurable: true })

    const res = await importWorkspaceLocalFolder({ fs, files: [supported, unsupported] })
    if (res.createdPaths.length !== 1) throw new Error(`expected 1 created path, got ${res.createdPaths.length}`)
    if (res.skipped.length !== 1) throw new Error(`expected 1 skipped file, got ${res.skipped.length}`)
    if (res.failed.length !== 0) throw new Error(`expected 0 failed files, got ${res.failed.length}`)

    const entries = await fs.listEntries()
    const hasOk = entries.some(e => e.kind === 'file' && e.name === 'ok.md')
    const hasImage = entries.some(e => e.kind === 'file' && e.name === 'image.png')
    if (!hasOk) throw new Error('expected ok.md to be imported')
    if (hasImage) throw new Error('expected image.png to be skipped')
  } finally {
    restore()
  }
}

export async function testWorkspaceImportLocalFolderHydratesOnlyOpenedFile() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const a = createFile('a.md', '# A\n')
    Object.defineProperty(a, 'webkitRelativePath', { value: 'MyFolder/a.md', configurable: true })
    const b = createFile('b.md', '# B\n')
    Object.defineProperty(b, 'webkitRelativePath', { value: 'MyFolder/b.md', configurable: true })

    await importWorkspaceLocalFolder({ fs, files: [a, b] })
    const entries = await fs.listEntries()
    const aPath = entries.find(e => e.kind === 'file' && e.name === 'a.md')?.path || ''
    const bPath = entries.find(e => e.kind === 'file' && e.name === 'b.md')?.path || ''
    if (!aPath || !bPath) throw new Error('expected both a.md and b.md paths')

    const hydratedA = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: aPath })
    if (!hydratedA || !hydratedA.text.includes('# A')) throw new Error('expected a.md to hydrate')

    const bText = await fs.readFileText(bPath)
    if (!bText || !isPendingLocalImportStubText(bText)) throw new Error('expected b.md to remain pending until opened')
    const pendingB = peekPendingWorkspaceLocalImport(bPath)
    if (!pendingB) throw new Error('expected b.md to remain pending after hydrating a.md')
  } finally {
    restore()
  }
}

export function testWorkspaceImportCanvasFrontmatterDocsOptIntoGraphLanding() {
  const canvasDoc = [
    '---',
    'title: "Video Demo"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgMultiDimTableModeEnabled: false',
    '$schema: "kgc-pipeline/v1"',
    'widget_bundle:',
    '  kind: kg:flow:widgetBundle',
    'flow:',
    '  nodes: []',
    '---',
    '',
    '# Video Demo',
  ].join('\n')
  const plainDoc = [
    '---',
    'title: "Plain Note"',
    'author: "demo"',
    '---',
    '',
    '# Plain Note',
  ].join('\n')

  if (!shouldApplyImportedCanvasDocumentToGraph({ path: KNOWGRPH_VIDEO_DEMO_WORKSPACE_PATH, text: canvasDoc })) {
    throw new Error('expected imported canvas frontmatter markdown to opt into graph-aware landing')
  }
  if (shouldApplyImportedCanvasDocumentToGraph({ path: '/note.md', text: plainDoc })) {
    throw new Error('expected plain markdown import to remain passive')
  }
  if (shouldApplyImportedCanvasDocumentToGraph({ path: '/diagram.txt', text: canvasDoc })) {
    throw new Error('expected non-markdown imports to remain passive even when text looks like frontmatter')
  }
}

export async function testWorkspaceImportCanvasPresetAppliesNonFrontmatterFlowGraphLanding() {
  const { restore } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const store = useGraphStore.getState()
    store.resetAll()
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)

    const text = [
      '---',
      'title: "Mermaid Canvas Preset"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "flowEditor"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: true',
      'kgMultiDimTableModeEnabled: false',
      '---',
      '',
      '```mermaid',
      'graph LR',
      '  A --> B',
      '```',
      '',
    ].join('\n')
    const file = createFile('mermaid-frontmatter.md', text)
    const result = await importWorkspaceLocalFiles({ fs, files: [file], parentPath: '/' })
    await applyWorkspaceImportToCanvas({ fs, createdPaths: result.createdPaths, opts: { applyToGraph: true } })
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: result.createdPaths, applyToGraph: true })

    const next = useGraphStore.getState()
    if (next.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected workspace import to honor flowEditor preset for parsed non-frontmatter-flow graph, got ${String(next.canvas2dRenderer || '')}`)
    }
    if (next.documentSemanticMode !== 'document') {
      throw new Error(`expected workspace import to honor document semantic mode from frontmatter preset, got ${String(next.documentSemanticMode || '')}`)
    }
    if (next.frontmatterModeEnabled !== true) {
      throw new Error('expected workspace import to enable frontmatter mode for parsed non-frontmatter-flow graph preset')
    }
  } finally {
    restore()
  }
}

export async function testActivateFirstImportedWorkspaceFilePreservesImportedFrontmatterLandingFromPreviousSelection() {
  const { restore } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('d3')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)

    const priorActiveText = [
      '---',
      'title: "Workspace README"',
      'kgCanvasSurfaceMode: "2d"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "d3"',
      'kgDocumentSemanticMode: "keyword"',
      'kgFrontmatterModeEnabled: false',
      'kgMultiDimTableModeEnabled: true',
      '---',
      '',
      '```mermaid',
      'graph LR',
      '  A --> B',
      '```',
      '',
    ].join('\n')
    const priorActiveFile = createFile('README.md', priorActiveText)
    const priorActiveImport = await importWorkspaceLocalFiles({ fs, files: [priorActiveFile], parentPath: '/' })
    explorer.setActivePath('/README.md')
    await applyWorkspaceImportToCanvas({
      fs,
      createdPaths: priorActiveImport.createdPaths,
      opts: { applyToGraph: true, skipComposedGraphApply: true },
    })

    const afterPriorActiveImport = useGraphStore.getState()
    if (afterPriorActiveImport.canvas2dRenderer !== 'd3') {
      throw new Error(`expected prior active import to land on d3, got ${String(afterPriorActiveImport.canvas2dRenderer || '')}`)
    }

    const videoText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const videoFile = createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, videoText)
    const videoImport = await importWorkspaceLocalFiles({ fs, files: [videoFile], parentPath: '/' })
    const importedVideoPath = String(videoImport.createdPaths[0] || '').trim()
    if (!importedVideoPath) {
      throw new Error('expected imported video path')
    }

    // Keep the previously active path selected to reproduce stale active-document state.
    explorer.setActivePath('/README.md')
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: videoImport.createdPaths, applyToGraph: true })

    const next = useGraphStore.getState()
    if (useMarkdownExplorerStore.getState().activePath !== importedVideoPath) {
      throw new Error(`expected import activation to focus imported video doc, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }
    if (next.canvasRenderMode !== '2d') {
      throw new Error(`expected video import to preserve 2d render mode, got ${String(next.canvasRenderMode || '')}`)
    }
    if (next.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video import to preserve flowEditor renderer, got ${String(next.canvas2dRenderer || '')}`)
    }
    if (next.documentSemanticMode !== 'document') {
      throw new Error(`expected video import to preserve document mode, got ${String(next.documentSemanticMode || '')}`)
    }
    if (next.frontmatterModeEnabled !== true) {
      throw new Error('expected video import to preserve frontmatter mode')
    }
    if (next.multiDimTableModeEnabled !== false) {
      throw new Error('expected video import to preserve multi-dimensional table disablement from frontmatter')
    }
  } finally {
    restore()
  }
}
