import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownWorkspaceToolbarRendersSaveControls() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as unknown }
    let saveAsCalls = 0

    const root = createRoot(container)
    root.render(
      <MarkdownWorkspaceMain
        themeMode="light"
        uiPanelTextFontClass="font-sans"
        uiPanelMonospaceTextClass="font-mono text-xs"
        explorerOpen={true}
        setExplorerOpen={() => {}}
        layoutMode="split"
        setLayoutMode={() => {}}
        markdownWordWrap={true}
        setMarkdownWordWrap={() => {}}
        markdownTextHighlight={false}
        setMarkdownTextHighlight={() => {}}
        onSaveAs={() => {
          saveAsCalls += 1
        }}
        onToggleFullscreen={() => {}}
        presentationApiRef={presentationApiRef as never}
        isMarkdown={true}
        activeText={'# Title\n'}
        setActiveText={() => {}}
        activeDocumentKey="doc"
        highlightedLineRange={{ start: null, end: null }}
        revealLineInEditor={() => {}}
        showInViewer={() => {}}
        showInPresentation={() => {}}
        showInGallery={() => {}}
        editorUri="file:///doc.md"
        editorLanguage="markdown"
        editorRef={editorRef}
        onEditorCaretLine={() => {}}
      />,
    )

    await tick()
    const save = dom.window.document.querySelector('button[aria-label="Save"]') as HTMLButtonElement | null
    if (save) throw new Error('expected Save to be moved out of toolbar')

    const exportBtn = dom.window.document.querySelector('button[aria-label="Export"]') as HTMLButtonElement | null
    if (!exportBtn) throw new Error('expected Export button')
    if (exportBtn.disabled) throw new Error('expected Export button enabled')

    exportBtn.click()
    await tick()
    const menuButtons = Array.from(dom.window.document.querySelectorAll('button')) as HTMLButtonElement[]
    const duplicate = menuButtons.find(b => String(b.textContent || '').trim() === 'Duplicate in workspace') || null
    if (!duplicate) throw new Error('expected Duplicate in workspace item')
    duplicate.click()
    if (saveAsCalls !== 1) throw new Error(`expected onSaveAs to be called once, got: ${saveAsCalls}`)

    root.unmount()
  } finally {
    restore()
  }
}
