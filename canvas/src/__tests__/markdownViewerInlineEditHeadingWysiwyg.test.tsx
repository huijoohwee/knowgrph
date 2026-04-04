import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testMarkdownViewerInlineEditHeadingUsesHtmlEditingAndPreservesHeight() {
  const headingPath = path.resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownHeadingBlock.tsx')
  const headingText = fs.readFileSync(headingPath, { encoding: 'utf8' })
  if (!headingText.includes('editPresentation="html"')) {
    throw new Error('expected MarkdownHeadingBlock to use html edit presentation')
  }

  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const reactDomClient = await import('react-dom/client')
    const createRoot = reactDomClient.createRoot

    const root = createRoot(container)
    root.render(<div data-test-probe="1">probe</div>)
    await tick()
    if (!dom.window.document.querySelector('[data-test-probe="1"]')) {
      throw new Error('expected react root to render a probe element')
    }

    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <MarkdownBlockContainer
        as="h2"
        className="font-semibold text-xl"
        highlightClass=""
        startLine={1}
        endLine={1}
        inlineEditable
        sourceLines={['## Hello world']}
        onReplaceLineRange={() => {}}
        editPresentation="html"
        editHtmlRender="inline"
        editStripLinePrefix={(line: string) => {
          const m = line.match(/^(\s*#{1,6}\s+)([\s\S]*)$/)
          if (!m) return { prefix: '', content: line }
          return { prefix: m[1] || '', content: m[2] || '' }
        }}
        forbidCopy
      >
        <span>Hello world</span>
      </MarkdownBlockContainer>,
    )

    await tick()

    const host = dom.window.document.querySelector('h2') as HTMLElement | null
    if (!host) throw new Error('expected host h2')

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

    host.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    )
    await tick()

    const editor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!editor) throw new Error('expected contenteditable editor to mount after click')
    if (!editor.className.includes('[&_p]:m-0')) {
      throw new Error('expected html normalize class names on html editing surface')
    }

    const wrapper = editor.parentElement as HTMLElement | null
    if (!wrapper) throw new Error('expected editor wrapper')
    if (String(wrapper.style.minHeight || '') !== '42px') {
      throw new Error('expected editor wrapper to set a minHeight to reduce layout jump')
    }

    const copyEvent = new dom.window.Event('copy', { bubbles: true, cancelable: true })
    editor.dispatchEvent(copyEvent)
    if (!copyEvent.defaultPrevented) {
      throw new Error('expected copy to be prevented when forbidCopy is true')
    }

    root.unmount()
  } finally {
    restore()
  }
}
