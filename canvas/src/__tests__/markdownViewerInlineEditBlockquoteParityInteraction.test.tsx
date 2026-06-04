import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const tick = async (n: number = 1) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

export async function testMarkdownViewerInlineEditBlockquoteDoesNotDriftRightward() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="blockquote"
        className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2`}
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['> quoted line']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editSigilRenderMode="plain"
        editStripLinePrefix={(line: string) => {
          const m = line.match(/^(\s*>\s*)([\s\S]*)$/)
          if (!m) return { prefix: '', content: line }
          return { prefix: m[1] || '', content: m[2] || '' }
        }}
        editCaptureLayoutSpacing
      >
        <span>quoted line</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)
    const host = dom.window.document.querySelector('blockquote') as HTMLElement | null
    if (!host) throw new Error('expected host blockquote')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(2)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected blockquote editor')
    if (
      editor.style.paddingTop ||
      editor.style.paddingLeft ||
      editor.style.paddingBottom ||
      editor.style.marginTop ||
      editor.style.marginLeft ||
      editor.style.marginBottom ||
      editor.style.textIndent
    ) {
      throw new Error('expected blockquote edit surface to avoid horizontal spacing replay that causes rightward drift')
    }
    if (
      editor.style.borderTopWidth ||
      editor.style.borderLeftWidth ||
      editor.style.borderBottomWidth ||
      editor.style.borderTopStyle ||
      editor.style.borderLeftStyle ||
      editor.style.borderBottomStyle ||
      editor.style.borderTopColor ||
      editor.style.borderLeftColor ||
      editor.style.borderBottomColor ||
      editor.style.borderRadius ||
      editor.style.backgroundColor
    ) {
      throw new Error('expected blockquote edit surface not to inline-override left border so quote rail remains visible')
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditBlankBlockquoteKeepsLineByLineSpacing() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="blockquote"
        className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2`}
        highlightClass=""
        startLine={1}
        endLine={3}
        inlineEditable
        sourceLines={['>', '>', '>']}
        onReplaceLineRange={() => {}}
        editPresentation="markdown"
        editStripLinePrefix={(line: string) => {
          const m = line.match(/^(\s*>\s*)([\s\S]*)$/)
          if (!m) return { prefix: '', content: line }
          return { prefix: m[1] || '', content: m[2] || '' }
        }}
        editTrimEdgeNewlines
      >
        <span> </span>
      </MarkdownBlockContainer>,
    )

    await tick(2)
    const host = dom.window.document.querySelector('blockquote') as HTMLElement | null
    if (!host) throw new Error('expected host blockquote')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(2)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected blockquote editor')
    const html = String(editor.innerHTML || '')
    const brCount = (html.match(/<br\s*\/?>/gi) || []).length
    if (brCount < 3) {
      throw new Error(`expected blank blockquote edit surface to preserve first/last line spacing with visible blank-line breaks; html=${JSON.stringify(html)}`)
    }
    const rowCount = (html.match(/<section>\s*<br\s*\/?>\s*<\/div>/gi) || []).length
    if (rowCount < 3) {
      throw new Error(`expected blank blockquote edit surface to preserve three explicit blank line rows; html=${JSON.stringify(html)}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditBlockquoteDoesNotShowSigilAsCodeOrStyledColor() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="blockquote"
        className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2`}
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['> `#EF4444|bg#FEF08A:Hello`']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editSigilRenderMode="plain"
        editStripLinePrefix={(line: string) => {
          const m = line.match(/^(\s*(?:>\s*)+)?([\s\S]*)$/)
          const prefix = m?.[1] || ''
          const content = m?.[2] ?? line
          return { prefix, content }
        }}
        editPreserveWhitespace
        editTrimEdgeNewlines
      >
        <span>Hello</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)
    const host = dom.window.document.querySelector('blockquote') as HTMLElement | null
    if (!host) throw new Error('expected host blockquote')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(2)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected blockquote editor')
    const sigilSpan = editor.querySelector('[data-kg-sigil="1"]') as HTMLElement | null
    if (sigilSpan) throw new Error('expected blockquote edit surface not to render sigil as styled span')
    const codeLike = Array.from(editor.querySelectorAll('code')).find(n => (n.textContent || '').includes('#EF4444'))
    if (codeLike) throw new Error('expected blockquote edit surface not to show sigil inline code token')
    if (!String(editor.textContent || '').includes('Hello')) {
      throw new Error('expected blockquote edit surface to show plain text content without sigil code or style wrappers')
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testMarkdownViewerInlineEditMultiLineBlockquoteDoesNotAppendTrailingEmptyRow() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="blockquote"
        className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2`}
        highlightClass=""
        startLine={1}
        endLine={3}
        inlineEditable
        sourceLines={['> a', '> b', '> c']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        editSigilRenderMode="plain"
        editStripLinePrefix={(line: string) => {
          const m = line.match(/^(\s*(?:>\s*)+)?([\s\S]*)$/)
          const prefix = m?.[1] || ''
          const content = m?.[2] ?? line
          return { prefix, content }
        }}
        editPreserveWhitespace
        editTrimEdgeNewlines
        editTrimEmptyBlockEdges
      >
        <span>a</span>
      </MarkdownBlockContainer>,
    )

    await tick(2)
    const host = dom.window.document.querySelector('blockquote') as HTMLElement | null
    if (!host) throw new Error('expected host blockquote')
    host.getBoundingClientRect = () => {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 42,
        width: 320,
        height: 42,
        toJSON: () => ({}),
      } as unknown as DOMRect
    }
    host.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await tick(3)

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected blockquote editor')
    const rows = Array.from(editor.children).filter(node => {
      const tag = String((node as HTMLElement).tagName || '').toLowerCase()
      return tag === 'p' || tag === 'div'
    }) as HTMLElement[]
    if (rows.length !== 3) {
      throw new Error(`expected multiline blockquote editor to keep exactly three content rows; html=${JSON.stringify(String(editor.innerHTML || ''))}`)
    }
    const lastRow = rows[rows.length - 1]
    const lastRowText = String(lastRow.textContent || '').replace(/[\u200B\u00A0\uFEFF]/g, '').trim()
    if (!lastRowText) {
      throw new Error(`expected multiline blockquote editor not to append trailing empty row; html=${JSON.stringify(String(editor.innerHTML || ''))}`)
    }
    const editorChildNodes = Array.from(editor.childNodes)
    const edgeWhitespaceNodes = editorChildNodes.filter((node, index) => {
      if (index !== 0 && index !== editorChildNodes.length - 1) return false
      if (node.nodeType !== dom.window.Node.TEXT_NODE) return false
      return !String(node.textContent || '').trim()
    })
    if (edgeWhitespaceNodes.length > 0) {
      throw new Error(`expected multiline blockquote editor not to keep whitespace-only edge nodes that render blank rows; html=${JSON.stringify(String(editor.innerHTML || ''))}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}
