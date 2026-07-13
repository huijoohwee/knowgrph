import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import { getInlineMediaEditorMarkdownSelectionOffsets } from '@/lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

const SOURCE_LINK = '[AI视频-执行总表.md](workspace:/docs/AI视频-执行总表.md)'
const INITIAL_VALUE = `/video-agent @video-generation-demo-script @provider.byteplus #spec.low ${SOURCE_LINK}\n\nBuild the sequence.`

export async function testFloatingPanelChatComposerReusesCardViewerEditSurface() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await mountReactRoot(root, React.createElement(FloatingPanelChatComposer, {
      input: INITIAL_VALUE,
      setInput: () => undefined,
      markdownText: '# Brief',
      isLoading: false,
      isSubmitDisabled: false,
      uiPanelTextFontClass: 'text-sm',
      placeholder: 'Ask a question',
    }), { window: dom.window as unknown as Window, frames: 4 })
    const editor = container.querySelector('[data-kg-chat-input="1"][data-kg-card-inline-viewer-edit-surface="1"]')
    const proxy = container.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]')
    if (!(editor instanceof dom.window.HTMLElement) || !(proxy instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error(`expected Chat to reuse the Card/Widget contenteditable surface and hidden command proxy, html=${container.innerHTML}`)
    }
    if (container.querySelector('textarea:not(.sr-only)')) throw new Error('expected Chat to remove the legacy visible textarea projection')
    const tokens = (Array.from(editor.querySelectorAll('[data-kg-inline-invocation-edit-token="1"]')) as HTMLElement[]).map(node => node.textContent)
    for (const token of ['/video-agent', '@video-generation-demo-script', '@provider.byteplus', '#spec.low']) {
      if (!tokens.includes(token)) throw new Error(`expected shared Card/Widget edit chip ${token}, got ${JSON.stringify(tokens)}`)
    }
    const range = dom.window.document.createRange()
    range.selectNodeContents(editor)
    const selection = dom.window.getSelection()
    if (!selection) throw new Error('expected browser selection')
    selection.removeAllRanges(); selection.addRange(range); Simulate.mouseUp(editor)
    const offsets = getInlineMediaEditorMarkdownSelectionOffsets(editor)
    if (!offsets || offsets.startOffset !== 0 || offsets.endOffset !== INITIAL_VALUE.length) {
      throw new Error(`expected Select All to include text, links, and atomic chips in one source range, got ${JSON.stringify(offsets)}, html=${editor.innerHTML}`)
    }
    if (proxy.value !== INITIAL_VALUE) throw new Error(`expected hidden proxy to preserve authored Markdown, got ${JSON.stringify(proxy.value)}`)
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}

export async function testFloatingPanelChatCardViewerEditSurfacePublishesMutationOnce() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const published: string[] = []
  function Harness() {
    const [input, setInput] = React.useState(INITIAL_VALUE)
    return <><output data-kg-chat-raw-input="1">{input}</output><FloatingPanelChatComposer input={input} setInput={next => setInput(previous => {
      const value = typeof next === 'function' ? next(previous) : next
      published.push(value)
      return value
    })} markdownText="# Brief" isLoading={false} isSubmitDisabled={false} uiPanelTextFontClass="text-sm" placeholder="Ask a question" /></>
  }
  try {
    await mountReactRoot(root, <Harness />, { window: dom.window as unknown as Window, frames: 4 })
    const editor = container.querySelector('[data-kg-chat-input="1"]')
    if (!(editor instanceof dom.window.HTMLElement)) throw new Error('expected shared Chat contenteditable editor')
    await act(async () => {
      editor.append(dom.window.document.createTextNode(' updated'))
      Simulate.input(editor)
      await waitForFrames(dom.window as unknown as Window, 3)
    })
    const expected = `${INITIAL_VALUE} updated`
    if (published.length !== 1 || published[0] !== expected || container.querySelector('[data-kg-chat-raw-input="1"]')?.textContent !== expected) {
      throw new Error(`expected one source mutation from the shared Card/Widget serializer, got ${JSON.stringify(published)}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
