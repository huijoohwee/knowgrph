import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'

const tick = async (n: number = 1) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const ensureRangeRect = (dom: ReturnType<typeof initJsdomHarness>['dom']) => {
  try {
    const proto = (dom.window as unknown as { Range?: { prototype?: Record<string, unknown> } }).Range?.prototype as unknown as {
      getBoundingClientRect?: () => DOMRect
    } | null
    if (proto && typeof proto.getBoundingClientRect !== 'function') {
      proto.getBoundingClientRect = () => {
        return {
          x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, toJSON: () => ({}),
        } as unknown as DOMRect
      }
    }
  } catch {
    void 0
  }
}

export async function testMarkdownWorkspaceViewerInlineEditInteractionDoesNotFreeze() {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceMain, {
          themeMode: 'light',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          explorerOpen: false,
          setExplorerOpen: () => void 0,
          layoutMode: 'viewer',
          setLayoutMode: () => void 0,
          markdownWordWrap: true,
          setMarkdownWordWrap: () => void 0,
          markdownTextHighlight: false,
          setMarkdownTextHighlight: () => void 0,
          onToggleFullscreen: () => void 0,
          presentationApiRef: { current: null },
          isEditing: false,
          isMarkdown: true,
          onFormatAction: () => void 0,
          activeText: ['Viewer edit line one', '', 'Viewer edit line two'].join('\n'),
          setActiveText: () => void 0,
          activeDocumentKey: '/viewer-edit-test.md',
          highlightedLineRange: null,
          revealLineInEditor: () => void 0,
          showInViewer: () => void 0,
          showInPresentation: () => void 0,
          showInSlidesGallery: () => void 0,
          editorUri: 'file:///viewer-edit-test.md',
          editorLanguage: 'markdown',
          editorRef: { current: null },
        }),
      )
      await tick(6)
    })

    const host = container.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected viewer first line host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 }))
    await tick(5)

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor in viewer mode')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected viewer editor text node')
    const range = doc.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(6, String(textNode.textContent || '').length))
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection object')
    sel.removeAllRanges()
    sel.addRange(range)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    await tick(4)

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected floating selection toolbar in viewer inline edit')

    const summary = toolbar.querySelector('summary[title="Text color"]') as HTMLElement | null
    if (!summary) throw new Error('expected text color summary in viewer floating toolbar')
    summary.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    summary.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    summary.click()
    await tick(2)
    const redBtn = toolbar.querySelector('menu[aria-label="Text color menu"] button') as HTMLButtonElement | null
    if (!redBtn) throw new Error('expected text color button in viewer floating toolbar')
    redBtn.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    redBtn.click()
    await tick(3)
    const stillEditorAfterToolbar = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!stillEditorAfterToolbar) throw new Error('expected viewer editor to stay active after floating toolbar action')
    const toolbarAfterAction = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbarAfterAction) throw new Error('expected floating selection toolbar to remain available after action click')

    editor.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: true }))
    await tick(2)
    const stillEditing = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!stillEditing) throw new Error('expected viewer inline edit not to freeze/bounce out on transient blur')
  } finally {
    try { root.unmount() } catch { void 0 }
    restore()
  }
}

export async function testMarkdownWorkspaceViewerUsesInlineFloatingFormattingSsot() {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: false,
        setExplorerOpen: () => void 0,
        layoutMode: 'viewer',
        setLayoutMode: () => void 0,
        markdownWordWrap: true,
        setMarkdownWordWrap: () => void 0,
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => void 0,
        onToggleFullscreen: () => void 0,
        presentationApiRef: { current: null },
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => void 0,
        activeText: ['Viewer edit line one', '', 'Viewer edit line two'].join('\n'),
        setActiveText: () => void 0,
        activeDocumentKey: '/viewer-edit-test.md',
        highlightedLineRange: null,
        revealLineInEditor: () => void 0,
        showInViewer: () => void 0,
        showInPresentation: () => void 0,
        showInSlidesGallery: () => void 0,
        editorUri: 'file:///viewer-edit-test.md',
        editorLanguage: 'markdown',
        editorRef: { current: null },
      }),
    )

    await tick(6)

    const workspaceFormattingMenu = container.querySelector('menu[aria-label="Formatting"]') as HTMLElement | null
    if (workspaceFormattingMenu) {
      throw new Error('expected viewer workspace toolbar to defer duplicate formatting buttons to the inline floating toolbar SSOT')
    }

    const host = container.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected viewer first line host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    await act(async () => {
      host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 }))
      await tick(6)
    })

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor in viewer mode')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected viewer editor text node')
    const range = doc.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(6, String(textNode.textContent || '').length))
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection object')
    sel.removeAllRanges()
    sel.addRange(range)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    await act(async () => {
      editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      await tick(4)
    })

    const inlineToolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!inlineToolbar) throw new Error('expected inline floating formatting toolbar after viewer click-to-edit selection')
    const boldButton = inlineToolbar.querySelector('button[title="Bold"]') as HTMLButtonElement | null
    if (!boldButton) throw new Error('expected inline floating formatting toolbar to keep Bold action available')
  } finally {
    try {
      await act(async () => {
        root.unmount()
      })
    } catch {
      void 0
    }
    restore()
  }
}

export async function testMarkdownWorkspaceViewerInlineEditDoubleClickWordSelectionShowsToolbar() {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    await act(async () => {
      root.render(
        React.createElement(MarkdownWorkspaceMain, {
          themeMode: 'light',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          explorerOpen: false,
          setExplorerOpen: () => void 0,
          layoutMode: 'viewer',
          setLayoutMode: () => void 0,
          markdownWordWrap: true,
          setMarkdownWordWrap: () => void 0,
          markdownTextHighlight: false,
          setMarkdownTextHighlight: () => void 0,
          onToggleFullscreen: () => void 0,
          presentationApiRef: { current: null },
          isEditing: false,
          isMarkdown: true,
          onFormatAction: () => void 0,
          activeText: ['Viewer edit line one', '', 'Viewer edit line two'].join('\n'),
          setActiveText: () => void 0,
          activeDocumentKey: '/viewer-edit-test.md',
          highlightedLineRange: null,
          revealLineInEditor: () => void 0,
          showInViewer: () => void 0,
          showInPresentation: () => void 0,
          showInSlidesGallery: () => void 0,
          editorUri: 'file:///viewer-edit-test.md',
          editorLanguage: 'markdown',
          editorRef: { current: null },
        }),
      )
      await tick(6)
    })

    const host = container.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected viewer first line host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    host.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 28, clientY: 16, detail: 2 }))
    await tick(6)

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor after double-click')

    const selectionText = String(dom.window.getSelection()?.toString() || '').trim()
    if (!selectionText) throw new Error('expected non-empty word selection after double-click open')

    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    await tick(4)

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected floating selection toolbar after double-click word selection')
  } finally {
    try { root.unmount() } catch { void 0 }
    restore()
  }
}

export async function testMarkdownWorkspaceViewerInlineEditEditorDoubleClickDoesNotFreeze() {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    root.render(
      React.createElement(MarkdownWorkspaceMain, {
        themeMode: 'light',
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        explorerOpen: false,
        setExplorerOpen: () => void 0,
        layoutMode: 'viewer',
        setLayoutMode: () => void 0,
        markdownWordWrap: true,
        setMarkdownWordWrap: () => void 0,
        markdownTextHighlight: false,
        setMarkdownTextHighlight: () => void 0,
        onToggleFullscreen: () => void 0,
        presentationApiRef: { current: null },
        isEditing: false,
        isMarkdown: true,
        onFormatAction: () => void 0,
        activeText: ['Viewer edit line one', '', 'Viewer edit line two'].join('\n'),
        setActiveText: () => void 0,
        activeDocumentKey: '/viewer-edit-test.md',
        highlightedLineRange: null,
        revealLineInEditor: () => void 0,
        showInViewer: () => void 0,
        showInPresentation: () => void 0,
        showInSlidesGallery: () => void 0,
        editorUri: 'file:///viewer-edit-test.md',
        editorLanguage: 'markdown',
        editorRef: { current: null },
      }),
    )

    await tick(6)

    const host = container.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected viewer first line host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    await act(async () => {
      host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 }))
      await tick(6)
    })

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor after single-click open')

    editor.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 28, clientY: 16, detail: 2 }))
    await tick(6)

    const stillEditingAfterDblClick = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!stillEditingAfterDblClick) throw new Error('expected viewer editor to remain active after editor double-click')

    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected viewer editor text node after double-click')
    const range = doc.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(6, String(textNode.textContent || '').length))
    const sel = dom.window.getSelection()
    if (!sel) throw new Error('expected selection object after double-click')
    sel.removeAllRanges()
    sel.addRange(range)

    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    await act(async () => {
      editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      await tick(4)
    })

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected floating selection toolbar after editor double-click')

    const stillEditing = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!stillEditing) throw new Error('expected viewer editor to remain active after editor double-click selection')
  } finally {
    try {
      await act(async () => {
        root.unmount()
      })
    } catch {
      void 0
    }
    restore()
  }
}
