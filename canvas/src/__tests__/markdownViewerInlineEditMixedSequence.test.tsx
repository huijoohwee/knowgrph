import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const waitForElement = async <T extends HTMLElement>(query: () => T | null, attempts: number = 20) => {
  for (let i = 0; i < attempts; i += 1) {
    const el = query()
    if (el) return el
    await tick()
  }
  return null
}

const setRect = (el: HTMLElement, width: number = 480, height: number = 28) => {
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as unknown as DOMRect)
}

const openEditorAtLine = async (dom: any, line: number) => {
  const host = await waitForElement(() => {
    const rowHost = dom.document.querySelector(`[data-kg-list-item-start-line="${line}"]`) as HTMLElement | null
    if (rowHost) {
      const rowEditableHost = rowHost.querySelector(`[data-start-line="${line}"]`) as HTMLElement | null
      return rowEditableHost || rowHost
    }
    return dom.document.querySelector(`[data-start-line="${line}"]`) as HTMLElement | null
  })
  if (!host) throw new Error(`expected host for start line ${line}`)
  setRect(host)
  host.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 8, clientY: 8 }))
  await tick()
  await tick()
  const editor = await waitForElement(
    () => host.querySelector('[contenteditable="true"]') as HTMLElement | null,
  )
  if (!editor) throw new Error(`expected editor for start line ${line}`)
  return { host, editor }
}

export async function testMarkdownViewerInlineEditMixedBlockSequencePreservesInlineCodeAndListMarkers() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const markdown = [
      'Paragraph with `inline` code.',
      '',
      '```ts',
      'const value = 1',
      '```',
      '',
      '1. First `code`',
      '2. Second',
      '',
      '- Alpha `code`',
      '- Beta',
    ].join('\n')
    const sourceLines = markdown.split('\n')
    const { tokens } = lexMarkdown(markdown)

    const root = createRoot(container)
    root.render(
      <MarkdownTokenRenderer
        tokens={tokens}
        activeDocumentPath="/sandbox/demo/mixed-sequence.md"
        highlightedLineRange={null}
        markdownWordWrap
        markdownPresentationMode={false}
        uiPanelTextFontClass="font-sans"
        uiPanelMonospaceTextClass="font-mono text-xs"
        mermaidFrontmatterConfig={null}
        rootThemeMode="light"
        previewOverlayScope="container"
        markdownSourceLines={sourceLines}
        viewerBlockEditingEnabled
        onReplaceLineRange={() => {}}
        forbidCopy
      />,
    )
    await tick()

    const paragraph = await openEditorAtLine(dom.window, 1)
    if (!paragraph.editor.className.includes('[&_code]:text-[length:var(--kg-inline-code-font-size,inherit)]')) {
      throw new Error('expected paragraph inline editor to preserve inline-code font-size via css var contract')
    }
    if (!paragraph.editor.className.includes('[&_code]:py-0')) {
      throw new Error('expected paragraph inline editor to avoid inline-code vertical padding spacing mutation')
    }
    if (!paragraph.editor.className.includes('[&_code]:px-1.5')) {
      throw new Error('expected paragraph inline editor to preserve inline-code horizontal padding spacing contract')
    }

    paragraph.editor.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: true }))
    await tick()

    const codeBlock = await openEditorAtLine(dom.window, 3)
    if (!codeBlock.editor.className.includes('whitespace-pre')) {
      throw new Error('expected fenced code block editor to preserve preformatted edit surface')
    }

    codeBlock.editor.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: true }))
    await tick()

    const ordered = await openEditorAtLine(dom.window, 7)
    if (!ordered.editor.className.includes('whitespace-pre-wrap')) {
      throw new Error('expected ordered list row editor to use normal-text style pre-wrap editing surface')
    }
    if (!ordered.editor.className.includes('break-words')) {
      throw new Error('expected ordered list row editor to preserve normal-text break-words behavior')
    }
    if (ordered.editor.className.includes('[&_ol]:list-decimal')) {
      throw new Error('expected ordered list row editor to avoid block-level list-surface classes')
    }

    ordered.editor.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: true }))
    await tick()

    const unordered = await openEditorAtLine(dom.window, 10)
    if (!unordered.editor.className.includes('whitespace-pre-wrap')) {
      throw new Error('expected unordered list row editor to use normal-text style pre-wrap editing surface')
    }
    if (!unordered.editor.className.includes('break-words')) {
      throw new Error('expected unordered list row editor to preserve normal-text break-words behavior')
    }
    if (unordered.editor.className.includes('[&_ul]:list-disc')) {
      throw new Error('expected unordered list row editor to avoid block-level list-surface classes')
    }

    root.unmount()
  } finally {
    restore()
  }
}
