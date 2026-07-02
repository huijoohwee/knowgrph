import { WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'

export async function testWorkspaceImportLargeCanvasPresetHeaderAppliesWithoutFullParse() {
  const { restore } = initJsdomHarness()
  try {
    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const store = useGraphStore.getState()
    store.resetAll()
    store.setCanvasRenderMode('3d')
    store.setCanvas2dRenderer('storyboard')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(true)
    store.setMultiDimTableModeEnabled(true)

    const bodyLine = 'Large imported HTML body content remains editor-visible while parser auto-apply stays bounded.\n'
    const bodyRepeatCount = Math.ceil((WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS + 512) / bodyLine.length)
    const text = [
      '---',
      'title: "Large URL Import HTML Preset"',
      'kgCanvasSurfaceMode: "2d"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "design"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: false',
      'kgMultiDimTableModeEnabled: false',
      '---',
      '',
      bodyLine.repeat(bodyRepeatCount),
    ].join('\n')
    if (text.length <= WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS) {
      throw new Error('expected large fixture to exceed workspace import parser auto-apply cap')
    }
    const createdPath = await fs.createFile({ parentPath: '/', name: 'large-url-import.md', text })
    await applyWorkspaceImportToCanvas({ fs, createdPaths: [createdPath], opts: { applyToGraph: true } })

    const next = useGraphStore.getState()
    if (next.canvasRenderMode !== '2d') {
      throw new Error(`expected large import header preset to activate 2D render mode, got ${String(next.canvasRenderMode || '')}`)
    }
    if (next.canvas2dRenderer !== 'design') {
      throw new Error(`expected large import header preset to apply Design renderer, got ${String(next.canvas2dRenderer || '')}`)
    }
    if (next.documentSemanticMode !== 'document') {
      throw new Error(`expected large import header preset to apply document mode, got ${String(next.documentSemanticMode || '')}`)
    }
    if (next.frontmatterModeEnabled !== false) {
      throw new Error('expected large import header preset to disable frontmatter mode without parsing the full body')
    }
    if (next.multiDimTableModeEnabled !== false) {
      throw new Error('expected large import header preset to disable multi-dimensional table mode')
    }
  } finally {
    restore()
  }
}
