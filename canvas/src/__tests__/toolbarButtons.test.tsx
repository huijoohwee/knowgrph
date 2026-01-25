import React from 'react'
import { createRoot } from 'react-dom/client'
import IconButton from '@/components/IconButton'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToolbarIconTooltipsDoNotInterceptClicks() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    let clicks = 0
    const root = createRoot(container)
    root.render(
      <IconButton title="Status" onClick={() => { clicks += 1 }} showTooltip>
        <span>OK</span>
      </IconButton>,
    )

    await tick()

    const btn = dom.window.document.querySelector('button[aria-label="Status"]') as HTMLButtonElement | null
    if (!btn) throw new Error('expected Status IconButton')

    const wrapper = btn.parentElement as HTMLElement | null
    if (!wrapper) throw new Error('expected IconButton wrapper')
    wrapper.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }))

    await tick()

    const tooltip = dom.window.document.querySelector('[data-kg-tooltip-root="1"]') as HTMLElement | null
    if (!tooltip) throw new Error('expected tooltip to mount on hover')
    if (!tooltip.className.includes('pointer-events-none')) {
      throw new Error('expected tooltip to use pointer-events-none to avoid intercepting clicks')
    }

    btn.click()
    await tick()
    if (clicks !== 1) throw new Error(`expected click handler to fire once, got ${clicks}`)

    root.unmount()
  } finally {
    restore()
  }
}

export async function testIconButtonStopsPropagation() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    let parentClicks = 0
    let buttonClicks = 0

    const root = createRoot(container)
    root.render(
      <div
        onClick={() => {
          parentClicks += 1
        }}
      >
        <IconButton
          title="Launch"
          onClick={() => {
            buttonClicks += 1
          }}
          showTooltip
        >
          <span>Go</span>
        </IconButton>
      </div>,
    )

    await tick()

    const btn = dom.window.document.querySelector('button[aria-label="Launch"]') as HTMLButtonElement | null
    if (!btn) throw new Error('expected Launch IconButton')

    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    if (buttonClicks !== 1) throw new Error(`expected button click handler once, got ${buttonClicks}`)
    if (parentClicks !== 0) throw new Error(`expected parent click handler to remain 0, got ${parentClicks}`)

    root.unmount()
  } finally {
    restore()
  }
}
