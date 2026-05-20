import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'

const tick = async (n: number = 1) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const waitMs = async (ms: number) => {
  await new Promise<void>(resolve => setTimeout(resolve, ms))
}

const waitForCondition = async (condition: () => boolean, attempts: number = 60, delayMs: number = 10) => {
  for (let i = 0; i < attempts; i += 1) {
    if (condition()) return true
    await waitMs(delayMs)
  }
  return condition()
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

const installInlineExecCommandStub = (
  dom: ReturnType<typeof initJsdomHarness>['dom'],
  commands: Array<'bold' | 'italic' | 'underline' | 'strikeThrough'>,
) => {
  const enabled = new Set(commands)
  const originalExecCommand = dom.window.document.execCommand
  dom.window.document.execCommand = ((cmd: string) => {
    if (!enabled.has(cmd as 'bold' | 'italic' | 'underline' | 'strikeThrough')) return false
    const sel = dom.window.getSelection()
    if (!sel || sel.rangeCount <= 0) return false
    const range = sel.getRangeAt(0)
    if (range.collapsed) return false
    const tagName = cmd === 'bold'
      ? 'strong'
      : cmd === 'italic'
        ? 'em'
        : cmd === 'strikeThrough'
          ? 's'
          : 'u'
    const wrapper = dom.window.document.createElement(tagName)
    wrapper.appendChild(range.extractContents())
    range.insertNode(wrapper)
    range.selectNodeContents(wrapper)
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }) as typeof dom.window.document.execCommand
  return () => {
    dom.window.document.execCommand = originalExecCommand
  }
}

async function runViewerToolbarActionCase(args: {
  activeText: string
  action: (ctx: {
    dom: ReturnType<typeof initJsdomHarness>['dom']
    doc: Document
    toolbar: HTMLElement
  }) => Promise<void>
  commitAfterAction?: boolean
  expectedMarkdownSnippet: string
  expectedJsonSnippet?: string | null
  expectedEditorHtmlSnippet?: string
}) {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const restoreExecCommand = installInlineExecCommandStub(dom, ['underline', 'bold', 'italic', 'strikeThrough'])
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  let latestActiveText = args.activeText
  const Harness = () => {
    const [activeText, setActiveText] = React.useState(args.activeText)
    return React.createElement(MarkdownWorkspaceMain, {
      themeMode: 'light',
      uiPanelTextFontClass: 'font-sans',
      uiPanelMonospaceTextClass: 'font-mono',
      explorerOpen: false,
      setExplorerOpen: () => void 0,
      layoutMode: 'split',
      setLayoutMode: () => void 0,
      markdownWordWrap: true,
      setMarkdownWordWrap: () => void 0,
      markdownTextHighlight: false,
      setMarkdownTextHighlight: () => void 0,
      onToggleFullscreen: () => void 0,
      presentationApiRef: { current: null },
      isMarkdown: true,
      activeText,
      setActiveText: (next: string) => {
        latestActiveText = next
        setActiveText(next)
      },
      activeDocumentKey: '/viewer-floating-toolbar-html-actions.md',
      highlightedLineRange: null,
      revealLineInEditor: () => void 0,
      showInViewer: () => void 0,
      showInPresentation: () => void 0,
      showInSlidesGallery: () => void 0,
      editorUri: 'file:///viewer-floating-toolbar-html-actions.md',
      editorLanguage: 'markdown',
      editorRef: { current: null },
    })
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await tick(6)
    })

    const markdownPaneToggle = doc.querySelector('input[aria-label="Show Markdown editor pane"]') as HTMLInputElement | null
    const jsonPaneToggle = doc.querySelector('input[aria-label="Show JSON editor pane"]') as HTMLInputElement | null
    if (!markdownPaneToggle || !jsonPaneToggle) throw new Error('expected split pane toggles for Viewer toolbar html actions test')
    await act(async () => {
      if (!markdownPaneToggle.checked) markdownPaneToggle.click()
      jsonPaneToggle.click()
      await tick(6)
    })

    const host = container.querySelector('[data-start-line="1"]') as HTMLElement | null
    if (!host) throw new Error('expected viewer first line host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    await act(async () => {
      host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 }))
      await tick(5)
    })

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected inline viewer editor')
    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected inline editor text node')
    const range = doc.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(6, String(textNode.textContent || '').length))
    const selection = dom.window.getSelection()
    if (!selection) throw new Error('expected selection object')
    selection.removeAllRanges()
    selection.addRange(range)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    await act(async () => {
      editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      await tick(4)
    })

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected floating selection toolbar')
    await args.action({ dom, doc, toolbar })
    await act(async () => {
      await tick(6)
    })

    if (args.expectedEditorHtmlSnippet) {
      const liveEditor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
      if (!liveEditor) throw new Error('expected live inline editor after toolbar action')
      if (!String(liveEditor.innerHTML || '').includes(args.expectedEditorHtmlSnippet)) {
        throw new Error(`expected editor html to include ${args.expectedEditorHtmlSnippet}; got ${JSON.stringify(liveEditor.innerHTML || '')}`)
      }
    }

    if (args.commitAfterAction) {
      const liveEditor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
      if (!liveEditor) throw new Error('expected live inline editor before commit')
      await act(async () => {
        liveEditor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', ctrlKey: true }))
        await waitMs(90)
        await tick(6)
      })
    }

    const markdownEditorTextarea = container.querySelector('textarea[aria-label="Markdown Editor Text"]') as HTMLTextAreaElement | null
    if (!markdownEditorTextarea) throw new Error('expected Markdown editor textarea')
    const expectedJsonSnippet = typeof args.expectedJsonSnippet === 'string' ? args.expectedJsonSnippet : args.expectedJsonSnippet === null ? null : args.expectedMarkdownSnippet
    const jsonEditorTextarea = container.querySelector('textarea[aria-label="JSON Editor Text"]') as HTMLTextAreaElement | null
    if (!jsonEditorTextarea) throw new Error('expected JSON editor textarea')
    await act(async () => {
      await waitForCondition(() => {
        const markdownReady =
          latestActiveText.includes(args.expectedMarkdownSnippet)
          || String(markdownEditorTextarea.value || '').includes(args.expectedMarkdownSnippet)
        const jsonReady = expectedJsonSnippet ? String(jsonEditorTextarea.value || '').includes(expectedJsonSnippet) : true
        return markdownReady && jsonReady
      })
    })
    if (!latestActiveText.includes(args.expectedMarkdownSnippet) && !String(markdownEditorTextarea.value || '').includes(args.expectedMarkdownSnippet)) {
      throw new Error(
        `expected Markdown source to include ${args.expectedMarkdownSnippet}; source=${JSON.stringify(latestActiveText)} pane=${JSON.stringify(markdownEditorTextarea.value || '')}`,
      )
    }
    if (expectedJsonSnippet && !String(jsonEditorTextarea.value || '').includes(expectedJsonSnippet)) {
      throw new Error(`expected JSON pane to include ${expectedJsonSnippet}; got ${JSON.stringify(jsonEditorTextarea.value || '')}`)
    }
  } finally {
    restoreExecCommand()
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

export async function testMarkdownWorkspaceViewerFloatingToolbarHtmlActionsSyncMarkdownAndJsonPanes() {
  await runViewerToolbarActionCase({
    activeText: ['Viewer sync line one', '', 'Viewer sync line two'].join('\n'),
    expectedMarkdownSnippet: '<u>Viewer</u>',
    expectedEditorHtmlSnippet: '<u>Viewer</u>',
    action: async ({ dom, toolbar }) => {
      const button = toolbar.querySelector('button[title="Underline"]') as HTMLButtonElement | null
      if (!button) throw new Error('expected underline button')
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        button.click()
        await tick(6)
      })
    },
  })

  await runViewerToolbarActionCase({
    activeText: ['Viewer sync line one', '', 'Viewer sync line two'].join('\n'),
    expectedMarkdownSnippet: '==Viewer==',
    expectedEditorHtmlSnippet: 'data-kg-default-highlight="1"',
    action: async ({ dom, toolbar }) => {
      const summary = toolbar.querySelector('summary[title="Highlight"]') as HTMLElement | null
      if (!summary) throw new Error('expected highlight summary')
      await act(async () => {
        summary.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
        summary.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        summary.click()
        await tick(2)
      })
      const button = toolbar.querySelector('menu[aria-label="Highlight menu"] button') as HTMLButtonElement | null
      if (!button) throw new Error('expected default highlight button')
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        button.click()
        await tick(6)
      })
    },
  })

  await runViewerToolbarActionCase({
    activeText: ['Viewer sync line one', '', 'Viewer sync line two'].join('\n'),
    expectedMarkdownSnippet: '`#EF4444:Viewer`',
    expectedEditorHtmlSnippet: 'data-kg-sigil-color="#EF4444"',
    action: async ({ dom, toolbar }) => {
      const summary = toolbar.querySelector('summary[title="Text color"]') as HTMLElement | null
      if (!summary) throw new Error('expected text color summary')
      await act(async () => {
        summary.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
        summary.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        summary.click()
        await tick(2)
      })
      const button = toolbar.querySelector('menu[aria-label="Text color menu"] button') as HTMLButtonElement | null
      if (!button) throw new Error('expected text color button')
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        button.click()
        await tick(6)
      })
    },
  })

  await runViewerToolbarActionCase({
    activeText: ['Viewer sync line one', '', 'Viewer sync line two'].join('\n'),
    expectedMarkdownSnippet: '<!-- Viewer --> sync line one',
    expectedJsonSnippet: null,
    action: async ({ dom, toolbar }) => {
      const button = toolbar.querySelector('button[title="Comment"]') as HTMLButtonElement | null
      if (!button) throw new Error('expected comment button')
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        button.click()
        await tick(6)
      })
    },
  })

  await runViewerToolbarActionCase({
    activeText: ['Viewer sync line one', '', 'Viewer sync line two'].join('\n'),
    expectedMarkdownSnippet: '- [ ] Viewer sync line one',
    expectedJsonSnippet: '[ ] Viewer sync line one',
    action: async ({ dom, toolbar }) => {
      const summary = toolbar.querySelector('summary[title="More"]') as HTMLElement | null
      if (!summary) throw new Error('expected more summary')
      await act(async () => {
        summary.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
        summary.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        summary.click()
        await tick(2)
      })
      const buttons = Array.from(toolbar.querySelectorAll('menu[aria-label="More actions"] button')) as HTMLButtonElement[]
      const checklistButton = buttons.find(candidate => String(candidate.textContent || '').trim() === 'Checklist') || null
      if (!checklistButton) throw new Error('expected checklist button')
      await act(async () => {
        checklistButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        checklistButton.click()
        await tick(6)
      })
    },
  })

}

export async function testMarkdownWorkspaceViewerTaskRowUnderlineKeepsRenderedUnderlineOnMouseRelease() {
  const { dom, restore } = initJsdomHarness()
  ensureRangeRect(dom)
  const restoreExecCommand = installInlineExecCommandStub(dom, ['underline'])
  const doc = dom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  const Harness = () => {
    const [activeText, setActiveText] = React.useState([
      '- [ ] Viewer sync line one',
      '- [ ] Viewer sync line two',
    ].join('\n'))
    return React.createElement(MarkdownWorkspaceMain, {
      themeMode: 'light',
      uiPanelTextFontClass: 'font-sans',
      uiPanelMonospaceTextClass: 'font-mono',
      explorerOpen: false,
      setExplorerOpen: () => void 0,
      layoutMode: 'split',
      setLayoutMode: () => void 0,
      markdownWordWrap: true,
      setMarkdownWordWrap: () => void 0,
      markdownTextHighlight: false,
      setMarkdownTextHighlight: () => void 0,
      onToggleFullscreen: () => void 0,
      presentationApiRef: { current: null },
      isMarkdown: true,
      activeText,
      setActiveText,
      activeDocumentKey: '/viewer-task-row-underline.md',
      highlightedLineRange: null,
      revealLineInEditor: () => void 0,
      showInViewer: () => void 0,
      showInPresentation: () => void 0,
      showInSlidesGallery: () => void 0,
      editorUri: 'file:///viewer-task-row-underline.md',
      editorLanguage: 'markdown',
      editorRef: { current: null },
    })
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await tick(6)
    })

    const markdownPaneToggle = doc.querySelector('input[aria-label="Show Markdown editor pane"]') as HTMLInputElement | null
    if (!markdownPaneToggle) throw new Error('expected markdown pane toggle')
    await act(async () => {
      if (!markdownPaneToggle.checked) markdownPaneToggle.click()
      await tick(4)
    })

    const host = (() => {
      const row = container.querySelector('[data-kg-list-item-start-line="1"]') as HTMLElement | null
      if (!row) return container.querySelector('[data-start-line="1"]') as HTMLElement | null
      return (row.querySelector('[data-start-line="1"]') as HTMLElement | null) || row
    })()
    if (!host) throw new Error('expected first task row host')
    host.getBoundingClientRect = () => {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 460, bottom: 60, width: 460, height: 60, toJSON: () => ({}),
      } as unknown as DOMRect
    }

    await act(async () => {
      host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 16 }))
      await tick(5)
    })

    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected inline task row editor')
    const textNode = editor.firstChild
    if (!textNode || textNode.nodeType !== dom.window.Node.TEXT_NODE) throw new Error('expected task row editor text node')

    const initialRange = doc.createRange()
    initialRange.setStart(textNode, 0)
    initialRange.setEnd(textNode, Math.min(6, String(textNode.textContent || '').length))
    const selection = dom.window.getSelection()
    if (!selection) throw new Error('expected selection object')
    selection.removeAllRanges()
    selection.addRange(initialRange)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    await act(async () => {
      editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      await tick(4)
    })

    const toolbar = doc.querySelector('menu[aria-label="Inline selection toolbar"]') as HTMLElement | null
    if (!toolbar) throw new Error('expected inline selection toolbar')
    const underlineButton = toolbar.querySelector('button[title="Underline"]') as HTMLButtonElement | null
    if (!underlineButton) throw new Error('expected underline button')
    await act(async () => {
      underlineButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      underlineButton.click()
      await tick(6)
    })

    const underlineTextNode = editor.querySelector('u')?.firstChild
    if (!underlineTextNode || underlineTextNode.nodeType !== dom.window.Node.TEXT_NODE) {
      throw new Error(`expected task row underline node after toolbar action, got html=${JSON.stringify(editor.innerHTML || '')}`)
    }
    const collapsedRange = doc.createRange()
    collapsedRange.setStart(underlineTextNode, 2)
    collapsedRange.setEnd(underlineTextNode, 2)
    selection.removeAllRanges()
    selection.addRange(collapsedRange)
    doc.dispatchEvent(new dom.window.Event('selectionchange'))
    await act(async () => {
      editor.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      await tick(6)
    })

    if (!String(editor.innerHTML || '').includes('<u>Viewer</u>')) {
      throw new Error(`expected task row underline to stay rendered after mouse release, got html=${JSON.stringify(editor.innerHTML || '')}`)
    }
    if (String(editor.textContent || '').includes('<u>Viewer</u>')) {
      throw new Error(`expected task row underline not to literalize after mouse release, got text=${JSON.stringify(editor.textContent || '')}`)
    }
  } finally {
    restoreExecCommand()
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
