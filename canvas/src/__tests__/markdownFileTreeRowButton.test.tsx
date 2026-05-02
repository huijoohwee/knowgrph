import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownFileTreeRowButton } from '@/components/BottomPanel/MarkdownFileTreeRowButton'

export async function testMarkdownFileTreeRowButtonReusesSharedRowShell() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let clicks = 0
  let contextMenus = 0

  try {
    await act(async () => {
      root.render(
        React.createElement(
          MarkdownFileTreeRowButton,
          {
            ariaLabel: 'File note.md',
            indent: 12,
            isActive: true,
            textClassName: 'text-sm',
            onClick: () => {
              clicks += 1
            },
            onContextMenu: event => {
              event.preventDefault()
              contextMenus += 1
            },
          },
          React.createElement('span', null, 'note.md'),
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const button = container.querySelector('button')
    if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error('expected shared file-tree row button to render a button')
    if (button.getAttribute('aria-label') !== 'File note.md') throw new Error(`expected row aria-label, got ${String(button.getAttribute('aria-label') || '')}`)
    if (!String(button.className || '').includes('flex-1')) throw new Error(`expected shared row button shell classes, got ${String(button.className || '')}`)

    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    button.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    if (clicks !== 1) throw new Error(`expected shared row click once, got ${String(clicks)}`)
    if (contextMenus !== 1) throw new Error(`expected shared row context menu once, got ${String(contextMenus)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
