import React from 'react'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

const clickToEdit = async (host: HTMLElement, dom: ReturnType<typeof initJsdomHarness>['dom']) => {
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
  await tick()
}

export async function testMarkdownViewerInlineEditHeadingAndParagraphDoNotDriftRightward() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const reactDomClient = await import('react-dom/client')
    const root = reactDomClient.createRoot(container)
    const mod = await import('@/features/markdown/ui/MarkdownBlockContainer')
    const MarkdownBlockContainer = mod.MarkdownBlockContainer

    root.render(
      <section>
        <MarkdownBlockContainer
          as="h2"
          className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2 font-semibold text-xl`}
          highlightClass=""
          startLine={1}
          endLine={1}
          inlineEditable
          sourceLines={['## Heading line']}
          onReplaceLineRange={() => {}}
          editPresentation="html"
          editHtmlRender="inline"
          editStripLinePrefix={(line: string) => {
            const m = line.match(/^(\s*#{1,6}\s+)([\s\S]*)$/)
            if (!m) return { prefix: '', content: line }
            return { prefix: m[1] || '', content: m[2] || '' }
          }}
        >
          <span>Heading line</span>
        </MarkdownBlockContainer>
        <MarkdownBlockContainer
          as="p"
          className={`mt-2 mb-2 ${UI_RESPONSIVE_CONTENT_START_PADDING_CLASSNAME} pr-2 text-sm`}
          highlightClass=""
          startLine={2}
          endLine={2}
          inlineEditable
          sourceLines={['Normal paragraph line']}
          onReplaceLineRange={() => {}}
          editPresentation="html"
          editHtmlRender="inline"
        >
          <span>Normal paragraph line</span>
        </MarkdownBlockContainer>
      </section>,
    )

    await tick()
    await tick()

    const headingHost = dom.window.document.querySelector('h2[data-start-line="1"]') as HTMLElement | null
    if (!headingHost) throw new Error('expected heading host')
    await clickToEdit(headingHost, dom)
    const headingEditor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!headingEditor) throw new Error('expected heading editor')
    if (headingEditor.style.paddingLeft || headingEditor.style.marginLeft || headingEditor.style.textIndent) {
      throw new Error('expected heading edit surface not to reapply captured left spacing by default')
    }
    headingEditor.textContent = 'Heading line x'
    headingEditor.dispatchEvent(new dom.window.Event('input', { bubbles: true, cancelable: true }))
    await tick()
    if (headingEditor.style.paddingLeft || headingEditor.style.marginLeft || headingEditor.style.textIndent) {
      throw new Error('expected heading edit surface left spacing to stay stable after interaction')
    }

    headingEditor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()

    const paragraphHost = dom.window.document.querySelector('p[data-start-line="2"]') as HTMLElement | null
    if (!paragraphHost) throw new Error('expected paragraph host')
    await clickToEdit(paragraphHost, dom)
    const paragraphEditor = dom.window.document.querySelector('[contenteditable="true"]') as HTMLElement | null
    if (!paragraphEditor) throw new Error('expected paragraph editor')
    if (paragraphEditor.style.paddingLeft || paragraphEditor.style.marginLeft || paragraphEditor.style.textIndent) {
      throw new Error('expected paragraph edit surface not to reapply captured left spacing by default')
    }
    paragraphEditor.textContent = 'Normal paragraph line y'
    paragraphEditor.dispatchEvent(new dom.window.Event('input', { bubbles: true, cancelable: true }))
    await tick()
    if (paragraphEditor.style.paddingLeft || paragraphEditor.style.marginLeft || paragraphEditor.style.textIndent) {
      throw new Error('expected paragraph edit surface left spacing to stay stable after interaction')
    }

    root.unmount()
  } finally {
    restore()
  }
}
