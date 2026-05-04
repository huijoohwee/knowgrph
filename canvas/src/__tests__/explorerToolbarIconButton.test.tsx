import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { ExplorerToolbarIconButton } from '@/features/markdown-workspace/ExplorerToolbarIconButton'

export async function testExplorerToolbarIconButtonUsesSharedButtonShell() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let clicks = 0

  try {
    await act(async () => {
      root.render(
        React.createElement(
          ExplorerToolbarIconButton,
          {
            ariaLabel: 'Shared button',
            title: 'Shared button',
            onClick: () => {
              clicks += 1
            },
            children: React.createElement('span', null, 'X'),
          },
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const button = container.querySelector('button')
    if (!(button instanceof dom.window.HTMLButtonElement)) throw new Error('expected shared toolbar icon button to render a button')
    if (button.getAttribute('aria-label') !== 'Shared button') throw new Error(`expected shared aria-label, got ${String(button.getAttribute('aria-label') || '')}`)
    if (!String(button.className || '').includes('kg-toolbar-btn')) throw new Error(`expected shared toolbar class, got ${String(button.className || '')}`)

    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    if (clicks !== 1) throw new Error(`expected shared toolbar button click handler once, got ${String(clicks)}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
