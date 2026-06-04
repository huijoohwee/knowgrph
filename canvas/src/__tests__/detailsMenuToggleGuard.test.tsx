import React from 'react'
import { createRoot } from 'react-dom/client'

import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { DetailsMenu } from '@/components/ui/DetailsMenu'
import { GraphTableColumnKindMenu } from '@/features/graph-table/ui/GraphTableColumnKindMenu'
import type { GraphColumnKind } from '@/features/graph-table-db/graphTableDb'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

export async function testDetailsMenuToggleGuardOnlyOpensFromToggleTarget() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const shouldToggle = (e: React.MouseEvent<HTMLElement>) => {
      const el = e.target as HTMLElement | null
      return Boolean(el?.closest('[data-kg-menu-toggle]'))
    }

    root.render(
      React.createElement(DetailsMenu, {
        ariaLabel: 'Test menu',
        detailsClassName: 'relative',
        summaryClassName: 'list-none',
        menuClassName: 'absolute left-0 mt-2',
        shouldToggleFromSummaryEvent: shouldToggle,
        summary: React.createElement(
          React.Fragment,
          null,
          React.createElement('span', { id: 'label' }, 'Label'),
          React.createElement('span', { id: 'toggle', 'data-kg-menu-toggle': 'true' }, 'v'),
        ),
        menu: React.createElement('menu', { 'aria-label': 'Inner menu' }, React.createElement('li', null, 'Item')),
      }),
    )

    await tick()

    let details: HTMLDetailsElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      details = container.querySelector('details') as HTMLDetailsElement | null
      if (details) break
    }
    if (!details) throw new Error('Expected details element')

    const label = container.querySelector('#label') as HTMLElement | null
    if (!label) throw new Error('Expected label span')
    label.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    if (details.open) throw new Error('Expected details to remain closed when clicking label')

    const toggle = container.querySelector('#toggle') as HTMLElement | null
    if (!toggle) throw new Error('Expected toggle span')
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    if (!details.open) throw new Error('Expected details to open when clicking toggle')
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}

export async function testTypeMenuClosesClosestDetailsWhenSelecting() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    let selected: GraphColumnKind | null = null
    root.render(
      React.createElement(
        'details',
        { open: true },
        React.createElement('summary', null, 'Open'),
        React.createElement(GraphTableColumnKindMenu, {
          ariaLabel: 'Property type',
          value: 'text',
          onSelect: (next) => {
            selected = next
          },
        }),
      ),
    )

    await tick()

    let details: HTMLDetailsElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      details = container.querySelector('details') as HTMLDetailsElement | null
      if (details) break
    }
    if (!details) throw new Error('Expected details element')
    if (!details.open) throw new Error('Expected details to start open')

    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    const jsonBtn = buttons.find(b => String(b.textContent || '').trim() === 'JSON') || null
    if (!jsonBtn) throw new Error('Expected JSON option button')
    jsonBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    if (selected !== 'json') throw new Error(`Expected selected kind to be json, got ${String(selected)}`)
    if (details.open) throw new Error('Expected details to close after selecting option')
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
