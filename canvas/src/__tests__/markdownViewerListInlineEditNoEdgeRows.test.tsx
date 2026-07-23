import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownListBlock } from '@/features/markdown/ui/MarkdownListBlock'
import fs from 'node:fs'
import { resolveRepoTestDataPath } from '@/tests/lib/repoTestData'

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
      const textRaw = String(editor.textContent || '').replace(/\u200B/g, '')
      const textTrimmed = textRaw.trim()
      if (!textTrimmed) throw new Error(`expected markdown list editor text; html=${editor.innerHTML}`)
      if (textRaw.startsWith('\n')) throw new Error(`expected no leading blank row; text=${JSON.stringify(textRaw)}`)
      if (textRaw.endsWith('\n')) throw new Error(`expected no trailing blank row; text=${JSON.stringify(textRaw)}`)
      return
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
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
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
          activeDocumentPath: '/fixtures/md-demo-00.md',
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
    const host = await waitForElement(() => {
      const rowHost = dom.window.document.querySelector('[data-kg-list-item-start-line]') as HTMLElement | null
      if (rowHost) {
        const startLine = Number(rowHost.getAttribute('data-kg-list-item-start-line') || '')
        if (Number.isFinite(startLine) && startLine > 0) {
          const rowEditableHost = rowHost.querySelector(`[data-start-line="${startLine}"]`) as HTMLElement | null
          return rowEditableHost || rowHost
        }
        return rowHost
      }
      return dom.window.document.querySelector('[data-start-line]') as HTMLElement | null
    })
    if (!host) throw new Error(`expected list host with data-start-line; dom=${container.innerHTML}`)
    const clickTarget = Number.isFinite(args.clickListItemIndex as number)
      ? (() => {
          const row = dom.window.document.querySelector(`[data-kg-list-item-index="${args.clickListItemIndex}"]`) as HTMLElement | null
          if (!row) return host
          const startLine = Number(row.getAttribute('data-kg-list-item-start-line') || '')
          if (!Number.isFinite(startLine) || startLine <= 0) return row
          return (row.querySelector(`[data-start-line="${startLine}"]`) as HTMLElement | null) || row
        })()
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
  const demoPath = resolveRepoTestDataPath('md-demo-01.md')
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

export async function testMarkdownViewerNestedListQuestionKeepsRenderedEditSurfaceParity() {
  const fixturePath = resolveRepoTestDataPath('probe-tree-rich-media-edit-parity.md')
  if (!fs.existsSync(fixturePath)) throw new Error(`missing Probe-Tree edit parity fixture: ${fixturePath}`)
  const markdown = fs.readFileSync(fixturePath, { encoding: 'utf8' })
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const reactDomClient = await import('react-dom/client')
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const { tokens } = lexMarkdown(markdown)
    const listToken = tokens.find(t => String((t as unknown as { type?: unknown }).type || '') === 'list')
    if (!listToken) throw new Error('missing nested list token')
    const replaceCalls: Array<{ startLine: number; endLine: number; replacementLines: string[] }> = []
    const root = reactDomClient.createRoot(container)
    root.render(
      <MarkdownListBlock
        token={listToken}
        highlightClass=""
        baseTextClass="text-sm"
        wrapClass=""
        opts={{
          activeDocumentPath: '/fixtures/probe-tree.md',
          uiPanelTextFontClass: 'font-sans',
          uiPanelMonospaceTextClass: 'font-mono',
          markdownPresentationMode: false,
          highlightedLineRange: null,
          markdownWordWrap: true,
          mermaidFrontmatterConfig: null,
          rootThemeMode: 'light',
          previewOverlayScope: 'container',
          markdownSourceLines: markdown.split('\n'),
          viewerBlockEditingEnabled: true,
          markdownBlockGutterEnabled: false,
          onReplaceLineRange: change => replaceCalls.push(change),
          forbidCopy: true,
        }}
      />,
    )
    await tick()
    await tick()

    const outerRows = Array.from(
      dom.window.document.querySelectorAll('section[data-start-line="14"] > ol > li[data-kg-list-item-index]'),
    ) as HTMLElement[]
    if (outerRows.length !== 2) {
      throw new Error(`expected two outer probe-tree rows, html=${container.innerHTML}`)
    }
    const rowRanges = outerRows.map(row => ({
      start: row.getAttribute('data-kg-list-item-start-line'),
      end: row.getAttribute('data-kg-list-item-end-line'),
    }))
    if (
      rowRanges[0]?.start !== '14'
      || rowRanges[0]?.end !== '20'
      || rowRanges[1]?.start !== '21'
      || rowRanges[1]?.end !== '27'
    ) {
      throw new Error(`expected indentation-aware outer row ranges, got ${JSON.stringify(rowRanges)}`)
    }

    const question = outerRows[0]?.querySelector('p[data-start-line="14"]') as HTMLElement | null
    if (!question || !question.querySelector('strong')) {
      throw new Error(`expected rendered bold question, html=${outerRows[0]?.innerHTML}`)
    }
    question.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 42,
      width: 400,
      height: 42,
      toJSON: () => ({}),
    } as unknown as DOMRect)
    question.dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 8,
      clientY: 8,
    }))
    await tick()
    await tick()

    const editor = await waitForElement(() => (
      outerRows[0]?.querySelector('p[data-start-line="14"] [contenteditable="true"]') as HTMLElement | null
    ))
    if (!editor) throw new Error(`expected nested question editor, html=${outerRows[0]?.innerHTML}`)
    if (
      !editor.querySelector('strong')
      || editor.innerHTML.includes('**')
      || /^\s*1[.)]\s/.test(String(editor.textContent || ''))
    ) {
      throw new Error(`expected rendered bold HTML edit surface without source list markers, html=${editor.innerHTML}`)
    }
    const rowText = String(outerRows[0]?.textContent || '')
    if (
      !rowText.includes('优先批发库存以实现规模效应')
      || !rowText.includes('The active input asks about viable sourcing paths')
      || !rowText.includes('Evidence regarding成本结构')
    ) {
      throw new Error(`expected nested branch content to remain rendered during question edit, text=${JSON.stringify(rowText)}`)
    }
    if (replaceCalls.length !== 0) {
      throw new Error(`expected entering edit to avoid source mutation, got ${JSON.stringify(replaceCalls)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}
