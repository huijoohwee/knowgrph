import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { ExplorerSearchControl } from '@/features/markdown-workspace/ExplorerSearchControl'

export async function testExplorerSearchControlTogglesAndClearsSearch() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let searchValue = ''

  const render = async () => {
    await act(async () => {
      root.render(
        React.createElement(ExplorerSearchControl, {
          search: searchValue,
          setSearch: next => {
            searchValue = next
          },
          panelTextClass: 'text-sm',
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }

  try {
    await render()
    const toggle = container.querySelector('button[aria-label="Show search"]')
    if (!(toggle instanceof dom.window.HTMLButtonElement)) throw new Error('expected search toggle button')

    await act(async () => {
      toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const input = container.querySelector('input')
    if (!(input instanceof dom.window.HTMLInputElement)) throw new Error('expected search input')
    if (!String(input.className || '').includes('w-40')) throw new Error(`expected expanded search width class, got ${String(input.className || '')}`)

    await act(async () => {
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      input.value = 'abc'
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    searchValue = 'abc'
    await render()

    const hideToggle = container.querySelector('button[aria-label="Hide search"]')
    if (!(hideToggle instanceof dom.window.HTMLButtonElement)) throw new Error('expected hide search button after expansion')

    const renderedInput = container.querySelector('input')
    if (!(renderedInput instanceof dom.window.HTMLInputElement)) throw new Error('expected rendered search input')

    await act(async () => {
      renderedInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (searchValue !== '') throw new Error(`expected escape to clear search text first, got ${searchValue}`)

    await render()
    const clearedInput = container.querySelector('input')
    if (!(clearedInput instanceof dom.window.HTMLInputElement)) throw new Error('expected cleared search input')
    await act(async () => {
      clearedInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const showAgain = container.querySelector('button[aria-label="Show search"]')
    if (!(showAgain instanceof dom.window.HTMLButtonElement)) throw new Error('expected second escape to collapse back to Show search')
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
