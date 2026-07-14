import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

export async function testCardInlineTextEditorViewerSurfaceEditsSingleLineTitles() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Runtime Gate',
          ariaLabel: 'Storyboard title for workspace-runtime',
          placeholder: 'Add title',
          canEdit: true,
          editActivation: 'click',
          editorSurface: 'viewer',
          inlineChipDensity: 'compact',
          displayClassName: 'min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-[color:var(--kg-text-primary)]',
          editorClassName: 'min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-[color:var(--kg-text-primary)]',
          onCommit: value => committedValues.push(value),
        }),
      )
      await waitForFrames(dom.window, 4)
    })
    const display = container.querySelector('[aria-label="Storyboard title for workspace-runtime"][data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Storyboard title display to use the shared card inline display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const viewerEditor = container.querySelector('[data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')
    if (!(viewerEditor instanceof dom.window.HTMLElement)) throw new Error(`expected title edit to open the shared Viewer contenteditable surface, html=${container.innerHTML}`)
    if (viewerEditor.getAttribute('aria-multiline') !== 'false') {
      throw new Error(`expected title Viewer edit surface to stay single-line, html=${viewerEditor.outerHTML}`)
    }
    if (container.querySelector('input[aria-label="Storyboard title for workspace-runtime"]')) {
      throw new Error('expected title edit not to reopen the legacy PanelTextInput surface')
    }
    const hiddenProxy = container.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]')
    if (!(hiddenProxy instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected single-line Viewer title edit to keep the hidden command proxy')
    await act(async () => {
      viewerEditor.textContent = 'Runtime Gateway'
      Simulate.input(viewerEditor)
      Simulate.keyDown(viewerEditor, { key: 'Enter' })
      await waitForFrames(dom.window, 4)
    })
    if (committedValues.at(-1) !== 'Runtime Gateway') {
      throw new Error(`expected Enter to commit single-line Viewer title edits, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
