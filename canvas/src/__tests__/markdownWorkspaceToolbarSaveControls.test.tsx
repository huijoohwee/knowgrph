import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownWorkspaceToolbarRendersSaveControls() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as unknown }

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
        statusLabel={null}
        onApply={() => {}}
        onSave={() => {}}
        onSaveAs={() => {}}
        onToggleFullscreen={() => {}}
        presentationApiRef={presentationApiRef as never}
        isEditing={true}
        isMarkdown={true}
        onFormatAction={() => {}}
        onImportLocalFiles={() => {}}
        onImportLocalFolder={() => {}}
        onImportUrl={() => {}}
        onImportWebsite={() => {}}
        activeText={'# Title\n'}
        setActiveText={() => {}}
        activeDocumentKey="doc"
        highlightedLineRange={{ start: null, end: null }}
        revealLineInEditor={() => {}}
        showInViewer={() => {}}
        showInPresentation={() => {}}
        showInSlidesGallery={() => {}}
        editorUri="file:///doc.md"
        editorLanguage="markdown"
        editorRef={editorRef}
        onEditorCaretLine={() => {}}
      />,
    )

    await tick()
    const save = dom.window.document.querySelector('button[aria-label="Save"]') as HTMLButtonElement | null
    if (!save) throw new Error('expected Save button')
    if (save.disabled) throw new Error('expected Save button enabled')
    const saveAs = dom.window.document.querySelector('button[aria-label="Save As"]') as HTMLButtonElement | null
    if (!saveAs) throw new Error('expected Save As button')
    if (saveAs.disabled) throw new Error('expected Save As button enabled')

    root.unmount()
  } finally {
    restore()
  }
}
