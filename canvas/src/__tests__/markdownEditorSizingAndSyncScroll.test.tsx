import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownEditorTextareaHeightAlignsAndSyncScrollsInSplitView() {
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
        onToggleFullscreen={() => {}}
        presentationApiRef={presentationApiRef as never}
        isEditing={true}
        isMarkdown={true}
        onFormatAction={() => {}}
        onImportLocalFiles={() => {}}
        onImportLocalFolder={() => {}}
        onImportUrl={() => {}}
        onImportWebsite={() => {}}
        activeText={'# Title\n\nLine 1\n\nLine 2\n'}
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

    const textarea = dom.window.document.querySelector('textarea[aria-label="Markdown Editor Text"]') as
      | HTMLTextAreaElement
      | null
    if (!textarea) throw new Error('expected markdown editor textarea')
    const textareaClass = String(textarea.getAttribute('class') || '')
    if (!textareaClass.includes('flex-1')) throw new Error('expected textarea to use flex-1')
    if (!textareaClass.includes('min-h-0')) throw new Error('expected textarea to use min-h-0 to align with section height')
    if (!textareaClass.includes('box-border')) throw new Error('expected textarea to use box-border so border aligns with section')

    const viewer = dom.window.document.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!viewer) throw new Error('expected markdown viewer root')
    const viewerClass = String(viewer.getAttribute('class') || '')
    if (!viewerClass.includes('overflow-auto')) throw new Error('expected viewer to be scrollable in split view')

    Object.defineProperty(textarea, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(textarea, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(viewer, 'scrollHeight', { value: 1500, configurable: true })
    Object.defineProperty(viewer, 'clientHeight', { value: 300, configurable: true })

    textarea.scrollTop = 600
    textarea.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    const expectedViewer = Math.round((600 / (2000 - 200)) * (1500 - 300))
    if (Math.abs(viewer.scrollTop - expectedViewer) > 3) {
      throw new Error(`expected viewer scrollTop≈${expectedViewer}, got ${viewer.scrollTop}`)
    }

    viewer.scrollTop = 420
    viewer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    await tick()
    const expectedEditor = Math.round((420 / (1500 - 300)) * (2000 - 200))
    if (Math.abs(textarea.scrollTop - expectedEditor) > 3) {
      throw new Error(`expected editor scrollTop≈${expectedEditor}, got ${textarea.scrollTop}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}
