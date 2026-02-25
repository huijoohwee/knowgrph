import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MarkdownPresentationApi } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { isFrontmatterOnlyDoc } from '@/lib/markdown/frontmatter'
import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

const BYTEPLUS_TEST_URL =
  'https://api.byteplus.com/api-sdk/view?serviceCode=ecs&version=2020-04-01&language=Python'

export async function testMarkdownWorkspaceWebpageHtmlViewRendersIframe() {
  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async () => {
      return {
        ok: true,
        status: 200,
        text: async () => '<!doctype html><html><head><base href="https://localhost/"></head><body><h1>OK</h1></body></html>',
      }
    }) as unknown

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    const cases = [
      { view: 'html', expectsIframe: true },
      { view: 'json', expectsIframe: true },
      { view: 'markdown', expectsIframe: false },
    ] as const

    for (const { view, expectsIframe } of cases) {
      const text = ['---', 'kgWebpageUrl: "https://localhost/"', `kgWebpageView: "${view}"`, '---', '', '# Title', ''].join('\n')
      root.render(
        React.createElement(MarkdownWorkspaceMain, {
          themeMode: 'light',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          explorerOpen: true,
          setExplorerOpen: () => {},
          layoutMode: 'viewer',
          setLayoutMode: () => {},
          markdownWordWrap: true,
          setMarkdownWordWrap: () => {},
          markdownTextHighlight: false,
          setMarkdownTextHighlight: () => {},
          statusLabel: null,
          onApply: () => {},
          onToggleFullscreen: () => {},
          presentationApiRef,
          isEditing: false,
          isMarkdown: true,
          onFormatAction: () => {},
          onImportLocalFiles: () => {},
          onImportLocalFolder: () => {},
          onImportUrl: () => {},
          onImportWebsite: () => {},
          activeText: text,
          setActiveText: () => {},
          activeDocumentKey: '/webpage.md',
          highlightedLineRange: null,
          revealLineInEditor: () => {},
          showInViewer: () => {},
          showInPresentation: () => {},
          showInSlidesGallery: () => {},
          editorUri: 'inmemory://webpage.md',
          editorLanguage: 'markdown',
          editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
        }),
      )

      for (let i = 0; i < 5; i += 1) await tick()

      const iframe = doc.querySelector('iframe')
      if (expectsIframe) {
        if (!iframe) throw new Error(`expected iframe for view=${view}`)
        const src = String(iframe.getAttribute('src') || '')
        const srcdoc = String(iframe.getAttribute('srcdoc') || '')

        if (src) throw new Error(`expected no iframe src for srcdoc mode view=${view}`)
        if (!srcdoc.includes('<base')) throw new Error(`expected srcdoc to include base tag for view=${view}`)

        const sandbox = String(iframe.getAttribute('sandbox') || '')
        if (sandbox.includes('allow-top-navigation')) throw new Error('expected iframe sandbox to forbid top navigation')
      } else {
        if (iframe) throw new Error(`expected no iframe for view=${view}`)
      }
    }

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}

export async function testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml() {
  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const seen: string[] = []
    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async (input: unknown) => {
      const url = (() => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        if (input && typeof input === 'object' && 'url' in input) {
          const u = (input as { url?: unknown }).url
          return typeof u === 'string' ? u : String(u || '')
        }
        return ''
      })()
      seen.push(url)
      if (url.startsWith('/__website_import/artifact')) {
        return {
          ok: true,
          status: 200,
          text: async () => '<!doctype html><html><head></head><body><h1>OK</h1></body></html>',
        }
      }
      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      }
    }) as unknown

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    const cases = [
      { view: 'html', nodeId: 'node-html' },
      { view: 'json', nodeId: 'node-json' },
    ] as const

    for (const { view, nodeId } of cases) {
      seen.length = 0
      const text = [
        '---',
        'kgWebpageUrl: "https://localhost/"',
        `kgWebpageView: "${view}"`,
        'kgWebsiteImportId: "import"',
        `kgWebsiteNodeId: "${nodeId}"`,
        '---',
        '',
        '# Title',
        '',
      ].join('\n')
      root.render(
        React.createElement(MarkdownWorkspaceMain, {
          themeMode: 'light',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          explorerOpen: true,
          setExplorerOpen: () => {},
          layoutMode: 'viewer',
          setLayoutMode: () => {},
          markdownWordWrap: true,
          setMarkdownWordWrap: () => {},
          markdownTextHighlight: false,
          setMarkdownTextHighlight: () => {},
          statusLabel: null,
          onApply: () => {},
          onToggleFullscreen: () => {},
          presentationApiRef,
          isEditing: false,
          isMarkdown: true,
          onFormatAction: () => {},
          onImportLocalFiles: () => {},
          onImportLocalFolder: () => {},
          onImportUrl: () => {},
          onImportWebsite: () => {},
          activeText: text,
          setActiveText: () => {},
          activeDocumentKey: '/webpage.md',
          highlightedLineRange: null,
          revealLineInEditor: () => {},
          showInViewer: () => {},
          showInPresentation: () => {},
          showInSlidesGallery: () => {},
          editorUri: 'inmemory://webpage.md',
          editorLanguage: 'markdown',
          editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
        }),
      )

      for (let i = 0; i < 5; i += 1) await tick()

      const iframe = doc.querySelector('iframe')
      if (!iframe) throw new Error(`expected iframe for view=${view}`)
      const src = String(iframe.getAttribute('src') || '')
      if (src) throw new Error(`expected no iframe src for srcdoc mode view=${view}`)
      const srcdoc = String(iframe.getAttribute('srcdoc') || '')
      if (!srcdoc.includes('<base')) throw new Error(`expected base tag injected for website import view=${view}`)
      if (!seen.some(u => u.startsWith('/__website_import/artifact'))) throw new Error(`expected website import artifact fetch view=${view}`)
      if (seen.some(u => u.startsWith('/__webpage_proxy'))) throw new Error(`expected no webpage proxy fetch when artifact available view=${view}`)
    }

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}

export async function testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const text = ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "html"', '---', '', '# Title', ''].join('\n')

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: true,
        setExplorerOpen: () => {},
        layoutMode: 'editor',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: null,
        onApply: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef,
        isEditing: true,
        isMarkdown: true,
        onFormatAction: () => {},
        onImportLocalFiles: () => {},
        onImportLocalFolder: () => {},
        onImportUrl: () => {},
        onImportWebsite: () => {},
        activeText: text,
        setActiveText: () => {},
        disableEditorMutations: false,
        activeDocumentKey: '/webpage.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://webpage.md',
        editorLanguage: 'markdown',
        editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
      }),
    )

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })
    for (let i = 0; i < 5; i += 1) await tick()

    const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected editor textarea')
    if (textarea.readOnly) throw new Error('expected HTML view editor to remain editable')
    if (textarea.value !== text) throw new Error('expected HTML view editor to render Markdown SSOT text')

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownWorkspaceImportUrlHtmlPageSsotAndViewModes() {
  const imported = await fetchWorkspaceUrlContent(BYTEPLUS_TEST_URL, { mode: 'import' })
  if (imported.normalizedUrl !== BYTEPLUS_TEST_URL) {
    throw new Error('expected normalizedUrl to equal input URL for Import URL pipeline')
  }
  if (!imported.name || !imported.name.endsWith('.md')) {
    throw new Error('expected Import URL pipeline to derive a .md file name')
  }
  const frontmatterPrefix = imported.text.split('\n').slice(0, 12).join('\n')
  if (!frontmatterPrefix.includes(`kgWebpageUrl: "${BYTEPLUS_TEST_URL}"`)) {
    throw new Error('expected frontmatter to include kgWebpageUrl with BytePlus URL')
  }
  if (!frontmatterPrefix.includes('kgWebpageView: "html"')) {
    throw new Error('expected frontmatter to set kgWebpageView: "html"')
  }
  if (!frontmatterPrefix.includes('kgWebpageScriptPolicy: "allow"')) {
    throw new Error('expected frontmatter to set kgWebpageScriptPolicy: "allow"')
  }
  if (!frontmatterPrefix.includes('kgWebpageIncludeImages:')) {
    throw new Error('expected frontmatter to include kgWebpageIncludeImages flag')
  }
  if (!frontmatterPrefix.includes('kgWebpageFidelityLevel:')) {
    throw new Error('expected frontmatter to include kgWebpageFidelityLevel')
  }

  const importedMarkdown = [
    imported.text.replace(/\s+$/, ''),
    '',
    '# BytePlus ECS Python SDK',
    '',
    '- Section 1',
    '- Section 2',
    '',
  ].join('\n')

  const { dom, restore } = initJsdomHarness()
  const prevFetch = (globalThis as unknown as { fetch?: unknown }).fetch
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const htmlBody =
      '<!doctype html><html><head><base href="https://localhost/"></head><body><h1>BytePlus ECS Python SDK</h1><p>Section 1</p><p>Section 2</p></body></html>'
    ;(globalThis as unknown as { fetch?: unknown }).fetch = (async (input: unknown, init?: unknown) => {
      const initObj = init && typeof init === 'object' ? (init as { method?: unknown }) : null
      const methodRaw = initObj?.method
      const method = (typeof methodRaw === 'string' ? methodRaw : 'GET').toUpperCase()
      const res = {
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        text: async () => (method === 'HEAD' ? '' : htmlBody),
      }
      return res as unknown as Response
    }) as unknown

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    const refreshed = await fetchWorkspaceUrlContent(BYTEPLUS_TEST_URL, { mode: 'refresh' })
    if (refreshed.normalizedUrl !== BYTEPLUS_TEST_URL) {
      throw new Error('expected normalizedUrl to equal input URL for refresh mode')
    }
    if (!refreshed.name || !refreshed.name.endsWith('.md')) {
      throw new Error('expected refresh mode to derive a .md file name')
    }
    if (!refreshed.text.includes(`kgWebpageUrl: "${BYTEPLUS_TEST_URL}"`)) {
      throw new Error('expected refresh markdown to include kgWebpageUrl with BytePlus URL')
    }
    if (!refreshed.text.includes('kgWebpageView: "html"')) {
      throw new Error('expected refresh markdown to keep kgWebpageView: "html" in frontmatter')
    }
    if (!refreshed.text.includes('BytePlus ECS Python SDK')) {
      throw new Error('expected refresh markdown to include heading derived from HTML')
    }
  if (isFrontmatterOnlyDoc(refreshed.text)) {
    throw new Error('expected refresh markdown to have non-empty body, not frontmatter-only')
  }

  const fidelityMarker = 'Fidelity Level:** 100% Source-Faithful (No Invented Content)'
  if (!refreshed.text.includes(fidelityMarker)) {
    throw new Error('expected refresh markdown to include Source-Faithful fidelity marker')
  }

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: true,
        setExplorerOpen: () => {},
        layoutMode: 'split',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: null,
        onApply: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef,
        isEditing: true,
        isMarkdown: true,
        onFormatAction: () => {},
        onImportLocalFiles: () => {},
        onImportLocalFolder: () => {},
        onImportUrl: () => {},
        onImportWebsite: () => {},
        activeText: importedMarkdown,
        setActiveText: () => {},
        activeDocumentKey: '/byteplus.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://byteplus.md',
        editorLanguage: 'markdown',
        editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
      }),
    )

    for (let i = 0; i < 5; i += 1) await tick()

    const textarea = doc.querySelector(
      'textarea[aria-label="Markdown Editor Text"]',
    ) as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected editor textarea for Import URL document')
    if (textarea.value !== importedMarkdown) {
      throw new Error('expected editor to render Import URL markdown SSOT text')
    }

    const iframe = doc.querySelector('iframe')
    if (!iframe) throw new Error('expected iframe for HTML viewer after Import URL')
    const src = String(iframe.getAttribute('src') || '')
    if (src) throw new Error('expected no iframe src for srcdoc mode for Import URL')
    const srcdoc = String(iframe.getAttribute('srcdoc') || '')
    if (!srcdoc.includes('<base')) {
      throw new Error('expected srcdoc to include base tag for Import URL HTML viewer')
    }

    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: true,
        setExplorerOpen: () => {},
        layoutMode: 'viewer',
        setLayoutMode: () => {},
        markdownWordWrap: true,
        setMarkdownWordWrap: () => {},
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => {},
        statusLabel: null,
        onApply: () => {},
        onToggleFullscreen: () => {},
        presentationApiRef,
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => {},
        onImportLocalFiles: () => {},
        onImportLocalFolder: () => {},
        onImportUrl: () => {},
        onImportWebsite: () => {},
        activeText: importedMarkdown.replace('kgWebpageView: "html"', 'kgWebpageView: "markdown"'),
        setActiveText: () => {},
        activeDocumentKey: '/byteplus.md',
        highlightedLineRange: null,
        revealLineInEditor: () => {},
        showInViewer: () => {},
        showInPresentation: () => {},
        showInSlidesGallery: () => {},
        editorUri: 'inmemory://byteplus.md',
        editorLanguage: 'markdown',
        editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
      }),
    )

    for (let i = 0; i < 5; i += 1) await tick()

    const iframeAfter = doc.querySelector('iframe')
    if (iframeAfter) throw new Error('expected no iframe when view is markdown')

    const viewerRoot = doc.querySelector(
      '[data-testid="markdown-preview-root"]',
    ) as HTMLElement | null
    if (!viewerRoot) throw new Error('expected markdown preview root for markdown view')
    const html = viewerRoot.innerHTML
    if (!html.includes('BytePlus ECS Python SDK')) {
      throw new Error('expected markdown viewer to render editor SSOT text')
    }

    root.unmount()
  } finally {
    ;(globalThis as unknown as { fetch?: unknown }).fetch = prevFetch
    restore()
  }
}

export async function testMarkdownWorkspaceEditorTextOverrideWorks() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const presentationApiRef = { current: null as MarkdownPresentationApi | null }

    const cases = [
      {
        view: 'json',
        overrideText: JSON.stringify({ ok: true, mode: 'json' }, null, 2),
      },
      {
        view: 'markdown',
        overrideText: ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "markdown"', '---', '', '# Webpage Markdown Artifact: localhost', '', '```text kg-webpage-layout', '[MOCKUP]', '```', ''].join('\n'),
      },
    ] as const

    for (const { view, overrideText } of cases) {
      const markdown = ['---', 'kgWebpageUrl: "https://localhost/"', `kgWebpageView: "${view}"`, '---', '', '# Title', ''].join('\n')
      root.render(
        React.createElement(MarkdownWorkspaceMain, {
          themeMode: 'light',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          explorerOpen: true,
          setExplorerOpen: () => {},
          layoutMode: 'editor',
          setLayoutMode: () => {},
          markdownWordWrap: true,
          setMarkdownWordWrap: () => {},
          markdownTextHighlight: false,
          setMarkdownTextHighlight: () => {},
          statusLabel: null,
          onApply: () => {},
          onToggleFullscreen: () => {},
          presentationApiRef,
          isEditing: true,
          isMarkdown: true,
          onFormatAction: () => {},
          onImportLocalFiles: () => {},
          onImportLocalFolder: () => {},
          onImportUrl: () => {},
          onImportWebsite: () => {},
          activeText: markdown,
          setActiveText: () => {
            throw new Error('expected editor mutations disabled')
          },
          editorTextOverride: overrideText,
          disableEditorMutations: true,
          activeDocumentKey: '/webpage.md',
          highlightedLineRange: null,
          revealLineInEditor: () => {},
          showInViewer: () => {},
          showInPresentation: () => {},
          showInSlidesGallery: () => {},
          editorUri: 'inmemory://webpage.md',
          editorLanguage: 'markdown',
          editorRef: editorRef as unknown as React.MutableRefObject<MonacoTextEditorHandle | null>,
        }),
      )

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })
    for (let i = 0; i < 5; i += 1) await tick()

      const textarea = doc.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
      if (!textarea) throw new Error('expected editor textarea')
      if (textarea.value !== overrideText) throw new Error('expected editorTextOverride rendered')
      if (!textarea.readOnly) throw new Error('expected editor readonly')
    }

    root.unmount()
  } finally {
    restore()
  }
}
