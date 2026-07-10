import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

const FIRST_LABEL = 'Summary for first'
const SECOND_LABEL = 'Prompt for second'
const FIRST_INITIAL_TEXT = 'First editable card body.'
const FIRST_UPDATED_TEXT = 'First editable card body with committed update.'
const FIRST_FAST_UPDATED_TEXT = 'First editable card body with fast-switch update.'
const SECOND_INITIAL_TEXT = 'Second editable card body.'
const INLINE_MEDIA_MARKDOWN = '![inline media](https://media.invalid/inline-media.png)'

export async function testCardInlineTextEditorCommitsPreviousViewerWhenOpeningNext() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const firstInitial = [
    FIRST_INITIAL_TEXT,
    '',
    INLINE_MEDIA_MARKDOWN,
  ].join('\n')
  const commits: string[] = []
  function Harness() {
    const [first, setFirst] = React.useState(firstInitial)
    const [second, setSecond] = React.useState(SECOND_INITIAL_TEXT)
    return (
      <section>
        <CardInlineTextEditor
          value={first}
          ariaLabel={FIRST_LABEL}
          placeholder="Add summary"
          canEdit
          editActivation="click"
          multiline
          markdownPreview="auto"
          editorSurface="viewer"
          inlineChipDensity="compact"
          onCommit={next => { commits.push(next); setFirst(next) }}
        />
        <CardInlineTextEditor
          value={second}
          ariaLabel={SECOND_LABEL}
          placeholder="Add prompt"
          canEdit
          editActivation="click"
          multiline
          editorSurface="viewer"
          inlineChipDensity="compact"
          onCommit={next => { commits.push(next); setSecond(next) }}
        />
      </section>
    )
  }
  const readFirstTextNode = (root: HTMLElement): Text | null => {
    const walker = root.ownerDocument.createTreeWalker(root, dom.window.NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (String(node.nodeValue || '').includes(FIRST_INITIAL_TEXT)) return node as Text
      node = walker.nextNode()
    }
    return null
  }
  try {
    await act(async () => {
      root.render(<Harness />)
      await waitForFrames(dom.window, 6)
    })
    const firstDisplay = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(firstDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected first display, html=${container.innerHTML}`)
    await act(async () => {
      firstDisplay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      firstDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const firstEditor = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-viewer-edit-surface="1"]`)
    if (!(firstEditor instanceof dom.window.HTMLElement)) throw new Error(`expected first Viewer editor, html=${container.innerHTML}`)
    const firstTextNode = readFirstTextNode(firstEditor)
    if (!firstTextNode) throw new Error(`expected editable first text node, html=${firstEditor.innerHTML}`)
    firstTextNode.nodeValue = `${FIRST_UPDATED_TEXT} `
    await act(async () => {
      Simulate.input(firstEditor)
      await waitForFrames(dom.window, 8)
    })
    const secondDisplay = container.querySelector(`[aria-label="${SECOND_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(secondDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected second display, html=${container.innerHTML}`)
    await act(async () => {
      secondDisplay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      secondDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 10)
    })
    const committedFirst = commits.find(value => value.includes(FIRST_UPDATED_TEXT)) || ''
    if (!committedFirst.includes(FIRST_UPDATED_TEXT)) {
      throw new Error(`expected opening the second editor to commit the first Viewer draft, commits=${JSON.stringify(commits)}`)
    }
    if (!committedFirst.includes(INLINE_MEDIA_MARKDOWN)) {
      throw new Error(`expected previous Viewer commit to preserve media markdown, got ${JSON.stringify(committedFirst)}`)
    }
    const openEditors = Array.from(container.querySelectorAll('[data-kg-card-inline-viewer-edit-surface="1"]')) as HTMLElement[]
    if (openEditors.length !== 1 || openEditors[0]?.getAttribute('aria-label') !== SECOND_LABEL) {
      throw new Error(`expected only the newly opened Viewer editor to remain mounted, html=${container.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorCommitsViewerDomDraftDuringFastSwitch() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const firstInitial = [
    FIRST_INITIAL_TEXT,
    '',
    INLINE_MEDIA_MARKDOWN,
  ].join('\n')
  const commits: string[] = []
  function Harness() {
    const [first, setFirst] = React.useState(firstInitial)
    const [second, setSecond] = React.useState(SECOND_INITIAL_TEXT)
    return (
      <section>
        <CardInlineTextEditor
          value={first}
          ariaLabel={FIRST_LABEL}
          placeholder="Add summary"
          canEdit
          editActivation="click"
          multiline
          markdownPreview="auto"
          editorSurface="viewer"
          inlineChipDensity="compact"
          onCommit={next => { commits.push(next); setFirst(next) }}
        />
        <CardInlineTextEditor
          value={second}
          ariaLabel={SECOND_LABEL}
          placeholder="Add prompt"
          canEdit
          editActivation="click"
          multiline
          editorSurface="viewer"
          inlineChipDensity="compact"
          onCommit={next => { commits.push(next); setSecond(next) }}
        />
      </section>
    )
  }
  const readFirstTextNode = (root: HTMLElement): Text | null => {
    const walker = root.ownerDocument.createTreeWalker(root, dom.window.NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (String(node.nodeValue || '').includes(FIRST_INITIAL_TEXT)) return node as Text
      node = walker.nextNode()
    }
    return null
  }
  try {
    await act(async () => {
      root.render(<Harness />)
      await waitForFrames(dom.window, 6)
    })
    const firstDisplay = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(firstDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected first display, html=${container.innerHTML}`)
    await act(async () => {
      firstDisplay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      firstDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const firstEditor = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-viewer-edit-surface="1"]`)
    if (!(firstEditor instanceof dom.window.HTMLElement)) throw new Error(`expected first Viewer editor, html=${container.innerHTML}`)
    const secondDisplay = container.querySelector(`[aria-label="${SECOND_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(secondDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected second display, html=${container.innerHTML}`)
    const firstTextNode = readFirstTextNode(firstEditor)
    if (!firstTextNode) throw new Error(`expected editable first text node, html=${firstEditor.innerHTML}`)
    await act(async () => {
      firstTextNode.nodeValue = `${FIRST_FAST_UPDATED_TEXT} `
      Simulate.input(firstEditor)
      secondDisplay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      secondDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 10)
    })
    const committedFirst = commits.find(value => value.includes(FIRST_FAST_UPDATED_TEXT)) || ''
    if (!committedFirst.includes(FIRST_FAST_UPDATED_TEXT)) {
      throw new Error(`expected fast card switch to commit the latest Viewer DOM draft, commits=${JSON.stringify(commits)}`)
    }
    if (!committedFirst.includes(INLINE_MEDIA_MARKDOWN)) {
      throw new Error(`expected fast Viewer commit to preserve media markdown, got ${JSON.stringify(committedFirst)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorCollapsesSimultaneousViewerRequests() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const firstValue = 'First queued Viewer edit request.'
  const secondValue = 'Second queued Viewer edit request.'
  try {
    await act(async () => {
      root.render(
        <section>
          <CardInlineTextEditor
            value={firstValue}
            ariaLabel="Prompt for first queued card"
            placeholder="Add prompt"
            canEdit
            editActivation="click"
            editRequestKey={1}
            multiline
            editorSurface="viewer"
            inlineChipDensity="compact"
            onCommit={() => void 0}
          />
          <CardInlineTextEditor
            value={secondValue}
            ariaLabel="Prompt for second queued card"
            placeholder="Add prompt"
            canEdit
            editActivation="click"
            editRequestKey={1}
            multiline
            editorSurface="viewer"
            inlineChipDensity="compact"
            onCommit={() => void 0}
          />
        </section>,
      )
      await waitForFrames(dom.window, 12)
    })
    const openEditors = Array.from(container.querySelectorAll('[data-kg-card-inline-viewer-edit-surface="1"]')) as HTMLElement[]
    if (openEditors.length !== 1) {
      throw new Error(`expected simultaneous Viewer edit requests to collapse to one open editor, html=${container.innerHTML}`)
    }
    const firstDisplay = container.querySelector('[aria-label="Prompt for first queued card"][data-kg-card-inline-edit="1"]')
    if (!(firstDisplay instanceof dom.window.HTMLElement) || String(firstDisplay.textContent || '').replace(/\s+/g, ' ').trim() !== firstValue) {
      throw new Error(`expected closed first queued prompt to preserve its display value, html=${container.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorNoOpSwitchPreservesRawViewerDraft() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const rawFirstValue = [
    'Keep __authored emphasis__ and spacing.',
    '',
    INLINE_MEDIA_MARKDOWN,
    'Keep the trailing line.',
  ].join('\n')
  const commits: string[] = []
  try {
    await act(async () => {
      root.render(
        <section>
          <CardInlineTextEditor
            value={rawFirstValue}
            ariaLabel={FIRST_LABEL}
            placeholder="Add summary"
            canEdit
            editActivation="click"
            multiline
            markdownPreview="auto"
            editorSurface="viewer"
            inlineChipDensity="compact"
            onCommit={next => commits.push(next)}
          />
          <CardInlineTextEditor
            value={SECOND_INITIAL_TEXT}
            ariaLabel={SECOND_LABEL}
            placeholder="Add prompt"
            canEdit
            editActivation="click"
            multiline
            editorSurface="viewer"
            inlineChipDensity="compact"
            onCommit={next => commits.push(next)}
          />
        </section>,
      )
      await waitForFrames(dom.window, 6)
    })
    const firstDisplay = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(firstDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected first display, html=${container.innerHTML}`)
    await act(async () => {
      firstDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const firstEditor = container.querySelector(`[aria-label="${FIRST_LABEL}"][data-kg-card-inline-viewer-edit-surface="1"]`)
    if (!(firstEditor instanceof dom.window.HTMLElement)) throw new Error(`expected first Viewer editor, html=${container.innerHTML}`)
    await act(async () => {
      firstEditor.focus()
      Simulate.focus(firstEditor)
      Simulate.blur(firstEditor)
      await waitForFrames(dom.window, 8)
    })
    if (commits.length > 0) {
      throw new Error(`expected untouched Viewer focus and blur not to normalize raw Markdown, got ${JSON.stringify(commits)}`)
    }
    const secondDisplay = container.querySelector(`[aria-label="${SECOND_LABEL}"][data-kg-card-inline-edit="1"]`)
    if (!(secondDisplay instanceof dom.window.HTMLElement)) throw new Error(`expected second display, html=${container.innerHTML}`)
    await act(async () => {
      secondDisplay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 10)
    })
    if (commits.length > 0) {
      throw new Error(`expected a no-op Viewer switch not to serialize projected DOM over raw Markdown, got ${JSON.stringify(commits)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
