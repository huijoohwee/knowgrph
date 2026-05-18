import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownWorkspaceToolbarWebpageViewControlsConsolidated() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as unknown }
    let viewCalls: string[] = []

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
        onToggleFullscreen={() => {}}
        presentationApiRef={presentationApiRef as never}
        isEditing={true}
        isMarkdown={true}
        onFormatAction={() => {}}
        webpageWorkspaceMeta={{ url: 'https://example.invalid/page', view: 'markdown', fidelityLevel: 4 } as never}
        onWebpageChangeView={(view) => {
          viewCalls = [...viewCalls, String(view)]
        }}
        onWebpageUpdateMeta={() => {}}
        activeText={'---\nkgWebpageUrl: "https://example.invalid/page"\nkgWebpageView: "markdown"\n---\n\n[](' + 'https://example.invalid/page' + ')\n'}
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
    await tick()
    const viewSelect = dom.window.document.querySelector('select[aria-label="Webpage view mode"]')
    if (viewSelect) throw new Error('expected Webpage view dropdown to be removed')

    const labels = Array.from(dom.window.document.querySelectorAll('label')) as HTMLLabelElement[]
    const htmlLabel = labels.find(l => /\bHTML\b/i.test(String(l.textContent || ''))) || null
    if (!htmlLabel) throw new Error('expected HTML checkbox to exist in workspace panes group')

    const markdownLabel = labels.find(l => String(l.textContent || '').replace(/\s+/g, ' ').trim() === 'Markdown') || null
    if (!markdownLabel) throw new Error('expected Markdown checkbox to exist')
    const markdownInput = markdownLabel.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (!markdownInput) throw new Error('expected Markdown checkbox input')
    markdownInput.click()
    await tick()
    if (!viewCalls.includes('markdown')) throw new Error('expected clicking Markdown checkbox to set webpage view to markdown')

    root.unmount()
  } finally {
    restore()
  }
}
