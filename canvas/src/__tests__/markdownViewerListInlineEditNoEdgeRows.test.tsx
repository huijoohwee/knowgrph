import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownListBlock } from '@/features/markdown/ui/MarkdownListBlock'
import fs from 'node:fs'
import path from 'node:path'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const waitForElement = async (query: () => HTMLElement | null, attempts: number = 12) => {
  for (let i = 0; i < attempts; i += 1) {
    const el = query()
    if (el) return el
    await tick()
  }
  return null
}

const assertNoEdgeRows = (editor: HTMLElement) => {
  const elements = Array.from(editor.children) as HTMLElement[]
  if (elements.length === 0) {
    const textRaw = String(editor.textContent || '').replace(/\u200B/g, '')
    const textTrimmed = textRaw.trim()
    if (!textTrimmed) throw new Error(`expected markdown list editor text; html=${editor.innerHTML}`)
    const lines = textRaw.split('\n')
    const first = String(lines[0] || '').trim()
    const last = String(lines[lines.length - 1] || '').trim()
    if (!first) throw new Error(`expected first editable row non-empty; text=${JSON.stringify(textRaw)}`)
    if (!last) throw new Error(`expected last editable row non-empty; text=${JSON.stringify(textRaw)}`)
    if (textRaw.startsWith('\n')) throw new Error(`expected no leading blank row; text=${JSON.stringify(textRaw)}`)
    if (textRaw.endsWith('\n')) throw new Error(`expected no trailing blank row; text=${JSON.stringify(textRaw)}`)
    return
  }
  const firstTag = String(elements[0]?.tagName || '').toLowerCase()
  let items: HTMLElement[] = []
  if (firstTag === 'li') {
    if (!elements.every(e => String(e.tagName || '').toLowerCase() === 'li')) {
      throw new Error(`expected only li children when li mode is used; html=${editor.innerHTML}`)
    }
    items = elements
  } else {
    if (elements.length !== 1) {
      throw new Error(`expected single list root or li children; html=${editor.innerHTML}`)
    }
    if (firstTag !== 'ol' && firstTag !== 'ul') {
      throw new Error(`expected list root ol/ul/li; got=${firstTag} html=${editor.innerHTML}`)
    }
    items = Array.from(elements[0].querySelectorAll(':scope > li')) as HTMLElement[]
  }
  if (items.length < 1) throw new Error(`expected list items in editable list root; html=${editor.innerHTML}`)
  const firstText = String(items[0]?.textContent || '').replace(/\u200B/g, '').trim()
  const lastText = String(items[items.length - 1]?.textContent || '').replace(/\u200B/g, '').trim()
  if (!firstText) throw new Error(`expected first editable list item non-empty; html=${editor.innerHTML}`)
  if (!lastText) throw new Error(`expected last editable list item non-empty; html=${editor.innerHTML}`)
  const rawText = String(editor.textContent || '').replace(/\u200B/g, '')
  if (rawText.startsWith('\n')) throw new Error(`expected no leading blank row; text=${JSON.stringify(rawText)} html=${editor.innerHTML}`)
  if (rawText.endsWith('\n')) throw new Error(`expected no trailing blank row; text=${JSON.stringify(rawText)} html=${editor.innerHTML}`)
}

const runListInteractionCase = async (args: {
  markdown: string
  listIndex: number
  clickListItemIndex?: number
  expectContains?: string[]
  expectNotContains?: string[]
}) => {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const { tokens } = lexMarkdown(args.markdown)
    const listTokens = tokens.filter(t => String((t as unknown as { type?: unknown }).type || '') === 'list')
    const listToken = listTokens[args.listIndex]
    if (!listToken) throw new Error(`missing list token at index ${args.listIndex}`)

    const sourceLines = args.markdown.split('\n')
    const root = createRoot(container)
    root.render(
      <MarkdownListBlock
        token={listToken}
        highlightClass=""
        baseTextClass="text-sm"
        wrapClass=""
        opts={{
          activeDocumentPath: '/sandbox/demo/md-demo-00.md',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          markdownPresentationMode: false,
          highlightedLineRange: null,
          markdownWordWrap: true,
          mermaidFrontmatterConfig: null,
          rootThemeMode: 'light',
          previewOverlayScope: 'container',
          markdownSourceLines: sourceLines,
          viewerBlockEditingEnabled: true,
          markdownBlockGutterEnabled: false,
          onReplaceLineRange: () => {},
          forbidCopy: true,
        }}
      />,
    )

    await tick()
    const host = await waitForElement(() => dom.window.document.querySelector('[data-start-line]') as HTMLElement | null)
    if (!host) throw new Error(`expected list host with data-start-line; dom=${container.innerHTML}`)
    const clickTarget = Number.isFinite(args.clickListItemIndex as number)
      ? (host.querySelector(`[data-kg-list-item-index="${args.clickListItemIndex}"]`) as HTMLElement | null) || host
      : host
    clickTarget.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 24,
      width: 400,
      height: 24,
      toJSON: () => ({}),
    } as unknown as DOMRect)
    clickTarget.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 8, clientY: 8 }))
    await tick()
    await tick()

    const editor = await waitForElement(() => dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null)
    if (!editor) throw new Error('expected inline list editor')
    const wrapper = editor.parentElement as HTMLElement | null
    if (!wrapper) throw new Error('expected editable wrapper')
    assertNoEdgeRows(editor)
    const text = String(editor.textContent || '')
    for (const s of args.expectContains || []) {
      if (!text.includes(s)) throw new Error(`expected editor text to include "${s}", got=${JSON.stringify(text)}`)
    }
    for (const s of args.expectNotContains || []) {
      if (text.includes(s)) throw new Error(`expected editor text to exclude "${s}", got=${JSON.stringify(text)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditOrderedListHasNoEdgeRows() {
  await runListInteractionCase({
    markdown: '1. one\n2. two',
    listIndex: 0,
  })
}

export async function testMarkdownViewerInlineEditUnorderedListHasNoEdgeRows() {
  await runListInteractionCase({
    markdown: '- one\n- two',
    listIndex: 0,
  })
}

export async function testMarkdownViewerInlineEditMdDemo01ListHasNoEdgeRows() {
  const demoPath = path.resolve(process.cwd(), '..', '..', 'sandbox', 'demo', 'md-demo-01.md')
  if (!fs.existsSync(demoPath)) throw new Error(`missing demo file: ${demoPath}`)
  const markdown = fs.readFileSync(demoPath, { encoding: 'utf8' })
  await runListInteractionCase({
    markdown,
    listIndex: 0,
    clickListItemIndex: 1,
    expectContains: ['Edges/flows'],
  })
}

export async function testMarkdownViewerInlineEditListWithFenceUsesEditAsIs() {
  await runListInteractionCase({
    markdown: '1. Step one\\n\\n   ```ts\\n   const n = 1\\n   ```\\n\\n2. Step two',
    listIndex: 0,
    expectContains: ['Step one', 'const n = 1', 'Step two'],
  })
}
