import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import { resolveMarkdownWorkspaceInitialPaneVisibility } from '@/features/markdown-workspace/main/types'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useGraphStore } from '@/hooks/useGraphStore'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const checkboxFor = (doc: Document, label: string): HTMLInputElement => {
  const labels = Array.from(doc.querySelectorAll('label')) as HTMLLabelElement[]
  const found = labels.find(l => String(l.textContent || '').replace(/\s+/g, ' ').trim() === label) || null
  if (!found) throw new Error(`expected ${label} checkbox to exist`)
  const input = found.querySelector('input[type="checkbox"]') as HTMLInputElement | null
  if (!input) throw new Error(`expected ${label} checkbox input`)
  return input
}

export async function testMarkdownWorkspaceToolbarWebpageViewControlsConsolidated() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const state = useGraphStore.getState()
  const prevWorkspaceViewMode = state.workspaceViewMode
  const prevWorkspaceCanvasPaneOpen = state.workspaceCanvasPaneOpen
  try {
    if (state.setWorkspaceViewState) {
      state.setWorkspaceViewState({ mode: 'editor', paneOpen: true })
    } else {
      state.setWorkspaceViewMode('editor')
      state.setWorkspaceCanvasPaneOpen(true)
    }
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as unknown }
    let viewCalls: string[] = []
    const sourceUrl = 'https://example.invalid/page'

    const root = createRoot(container)
    await act(async () => {
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
          webpageWorkspaceMeta={{ url: sourceUrl, view: 'html', fidelityLevel: 4 } as never}
          onWebpageChangeView={(view) => {
            viewCalls = [...viewCalls, String(view)]
          }}
          onWebpageUpdateMeta={() => {}}
          activeText={`---\nkgWebpageUrl: "${sourceUrl}"\nkgWebpageView: "html"\n---\n\n[](${sourceUrl})\n`}
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
    })
    const viewSelect = dom.window.document.querySelector('select[aria-label="Webpage view mode"]')
    if (viewSelect) throw new Error('expected Webpage view dropdown to be removed')

    const htmlInput = checkboxFor(dom.window.document, 'HTML')
    const viewerInput = checkboxFor(dom.window.document, 'Viewer')
    const jsonInput = checkboxFor(dom.window.document, 'JSON')
    const markdownInput = checkboxFor(dom.window.document, 'Markdown')
    if (!htmlInput.checked || !viewerInput.checked) {
      throw new Error('expected HTML import view to start with Viewer and HTML panes active')
    }
    if (!dom.window.document.querySelector('section[aria-label="Viewer"]')) {
      throw new Error('expected Viewer pane to render beside the HTML pane')
    }
    if (!dom.window.document.querySelector('section[aria-label="HTML Viewer"] section[aria-label="Webpage Viewer"]')) {
      throw new Error('expected HTML pane to render webpage viewer independently')
    }
    await act(async () => {
      jsonInput.click()
      await tick()
    })
    await act(async () => {
      markdownInput.click()
      await tick()
    })
    if (!jsonInput.checked || !markdownInput.checked || !viewerInput.checked || !htmlInput.checked) {
      throw new Error('expected JSON, Markdown, Viewer, and HTML checkboxes to stay open together')
    }
    if (!dom.window.document.querySelector('section[aria-label="JSON Editor"]')) {
      throw new Error('expected JSON pane to render while Viewer and HTML stay open')
    }
    if (dom.window.document.querySelector('section[aria-label="JSON Editor"] section[aria-label="Markdown Editor"]')) {
      throw new Error('expected JSON pane not to expose itself as a Markdown editor')
    }
    if (!dom.window.document.querySelector('section[aria-label="JSON Editor"] section[aria-label="JSON Editor Surface"]')) {
      throw new Error('expected JSON pane to expose a JSON editor surface')
    }
    if (!dom.window.document.querySelector('section[aria-label="Markdown Editor"]')) {
      throw new Error('expected Markdown pane to render while Viewer and HTML stay open')
    }
    if (!dom.window.document.querySelector('section[aria-label="Viewer"]')) {
      throw new Error('expected Viewer pane to remain rendered while HTML is open')
    }
    if (!dom.window.document.querySelector('section[aria-label="HTML Viewer"] section[aria-label="Webpage Viewer"]')) {
      throw new Error('expected HTML pane to remain rendered with Viewer open')
    }
    if (viewCalls.length !== 0) {
      throw new Error(`expected JSON/Markdown pane toggles not to rewrite webpage view, got ${JSON.stringify(viewCalls)}`)
    }

    await act(async () => {
      root.unmount()
      await tick()
    })
  } finally {
    if (state.setWorkspaceViewState) {
      state.setWorkspaceViewState({ mode: prevWorkspaceViewMode, paneOpen: prevWorkspaceCanvasPaneOpen })
    } else {
      state.setWorkspaceViewMode(prevWorkspaceViewMode)
      state.setWorkspaceCanvasPaneOpen(prevWorkspaceCanvasPaneOpen)
    }
    restore()
  }
}

export async function testMarkdownWorkspaceToolbarViewerAndHtmlRenderTogetherAfterSelection() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const state = useGraphStore.getState()
  const prevWorkspaceViewMode = state.workspaceViewMode
  const prevWorkspaceCanvasPaneOpen = state.workspaceCanvasPaneOpen
  try {
    if (state.setWorkspaceViewState) {
      state.setWorkspaceViewState({ mode: 'editor', paneOpen: true })
    } else {
      state.setWorkspaceViewMode('editor')
      state.setWorkspaceCanvasPaneOpen(true)
    }
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const sourceUrl = 'https://example.invalid/page'
    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as unknown }

    function Harness() {
      const [view, setView] = React.useState<'markdown' | 'html'>('markdown')
      const [layoutMode, setLayoutMode] = React.useState<'split' | 'editor'>('split')
      return (
        <MarkdownWorkspaceMain
          themeMode="light"
          uiPanelTextFontClass="font-sans"
          uiPanelMonospaceTextClass="font-mono text-xs"
          explorerOpen={true}
          setExplorerOpen={() => {}}
          layoutMode={layoutMode}
          setLayoutMode={next => setLayoutMode(next === 'editor' || next === 'split' ? next : 'split')}
          markdownWordWrap={true}
          setMarkdownWordWrap={() => {}}
          markdownTextHighlight={false}
          setMarkdownTextHighlight={() => {}}
          onToggleFullscreen={() => {}}
          presentationApiRef={presentationApiRef as never}
          isEditing={true}
          isMarkdown={true}
          onFormatAction={() => {}}
          webpageWorkspaceMeta={{ url: sourceUrl, view, fidelityLevel: 4 } as never}
          onWebpageChangeView={next => {
            if (next === 'html' || next === 'markdown') setView(next)
          }}
          onWebpageUpdateMeta={() => {}}
          activeText={`---\nkgWebpageUrl: "${sourceUrl}"\nkgWebpageView: "${view}"\n---\n\n[](${sourceUrl})\n`}
          setActiveText={() => {}}
          activeDocumentKey="doc-click-path"
          highlightedLineRange={{ start: null, end: null }}
          revealLineInEditor={() => {}}
          showInViewer={() => {}}
          showInPresentation={() => {}}
          showInSlidesGallery={() => {}}
          editorUri="file:///doc-click-path.md"
          editorLanguage="markdown"
          editorRef={editorRef}
          onEditorCaretLine={() => {}}
        />
      )
    }

    const root = createRoot(container)
    await act(async () => {
      root.render(<Harness />)
      await tick()
      await tick()
    })

    const viewerInput = checkboxFor(dom.window.document, 'Viewer')
    const htmlInput = checkboxFor(dom.window.document, 'HTML')
    if (htmlInput.checked) throw new Error('expected HTML pane to start closed in markdown view')
    await act(async () => {
      viewerInput.click()
      await tick()
      await tick()
    })
    if (!checkboxFor(dom.window.document, 'Viewer').checked) {
      throw new Error('expected Viewer checkbox to stay checked before selecting HTML')
    }
    await act(async () => {
      checkboxFor(dom.window.document, 'HTML').click()
      await tick()
      await tick()
    })
    if (!checkboxFor(dom.window.document, 'Viewer').checked || !checkboxFor(dom.window.document, 'HTML').checked) {
      throw new Error('expected Viewer and HTML checkboxes to stay checked together after selection')
    }
    if (!dom.window.document.querySelector('section[aria-label="Viewer"]')) {
      throw new Error('expected Viewer pane to render after selecting Viewer and HTML')
    }
    if (!dom.window.document.querySelector('section[aria-label="HTML Viewer"] section[aria-label="Webpage Viewer"]')) {
      throw new Error('expected HTML pane to render after selecting Viewer and HTML')
    }

    await act(async () => {
      root.unmount()
      await tick()
    })
  } finally {
    if (state.setWorkspaceViewState) {
      state.setWorkspaceViewState({ mode: prevWorkspaceViewMode, paneOpen: prevWorkspaceCanvasPaneOpen })
    } else {
      state.setWorkspaceViewMode(prevWorkspaceViewMode)
      state.setWorkspaceCanvasPaneOpen(prevWorkspaceCanvasPaneOpen)
    }
    restore()
  }
}

export function testMarkdownWorkspaceInitialPaneVisibilityFollowsImportView() {
  const cases = [
    { view: 'json' as const, expected: { json: true, markdown: false, viewer: false, html: false } },
    { view: 'markdown' as const, expected: { json: false, markdown: true, viewer: false, html: false } },
    { view: 'html' as const, expected: { json: false, markdown: false, viewer: true, html: true } },
  ]
  for (const item of cases) {
    const actual = resolveMarkdownWorkspaceInitialPaneVisibility({ webpageView: item.view })
    if (
      actual.json !== item.expected.json ||
      actual.markdown !== item.expected.markdown ||
      actual.viewer !== item.expected.viewer ||
      actual.html !== item.expected.html
    ) {
      throw new Error(`expected ${item.view} import to land on matching workspace pane`)
    }
  }
  const gltf = resolveMarkdownWorkspaceInitialPaneVisibility({ modelAssetFormat: 'gltf', webpageView: 'html' })
  if (!gltf.json || gltf.markdown || gltf.viewer || gltf.html) throw new Error('expected GLTF imports to prefer the JSON pane')
  const glb = resolveMarkdownWorkspaceInitialPaneVisibility({ modelAssetFormat: 'glb', webpageView: 'html' })
  if (glb.json || glb.markdown || glb.viewer || glb.html) throw new Error('expected GLB imports to keep text panes closed')
}
