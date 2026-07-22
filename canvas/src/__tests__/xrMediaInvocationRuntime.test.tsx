import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { XrInvocationButton } from '@/features/command-menu/XrMediaLibraryPanel'
import { buildXrMediaInvocationControlInput } from '@/features/command-menu/xrMediaInvocationRuntime'
import { normalizeXrSceneControl } from '@/features/three/xrSceneMcpRuntime'
import {
  buildXrPlaceInvocation,
  buildXrTransformInvocation,
} from '@/features/three/xrSceneMcpContract.mjs'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'

export async function testXrMediaInvocationChipsDispatchDisplayedLiteral() {
  const placeInvocation = buildXrPlaceInvocation('person-adult', 'linear', 'MCP Cast / Beta')
  const transformInvocation = buildXrTransformInvocation('actor with spaces/β', {
    assetId: 'prop-ball',
    position: [1, 0, -2],
    rotationYDegrees: 45,
    scale: 1.25,
    color: '#38bdf8',
  })
  const placeControl = normalizeXrSceneControl(buildXrMediaInvocationControlInput(placeInvocation))
  const structuredLabelControl = normalizeXrSceneControl({ action: 'place', assetId: 'person-adult', label: 'MCP%20Cast' })
  if (placeInvocation !== '/xr.place @person-adult transition=linear label=MCP%20Cast%20%2F%20Beta'
    || placeControl?.label !== 'MCP Cast / Beta'
    || structuredLabelControl?.label !== 'MCP%20Cast') {
    throw new Error(`expected labeled XR placement to round-trip through one literal invocation, got ${placeInvocation}`)
  }
  const staticInvocation = buildXrPlaceInvocation('prop-table', 'hold')
  if (normalizeXrSceneControl(buildXrMediaInvocationControlInput(staticInvocation))?.transition !== 'hold') {
    throw new Error('expected static XR placement to preserve its displayed hold transition')
  }

  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const dispatchedInputs: Array<Readonly<{ invocation: string }>> = []
  const onInvoke = (invocation: string) => {
    dispatchedInputs.push(buildXrMediaInvocationControlInput(invocation))
  }

  try {
    await mountReactRoot(root, React.createElement(React.Fragment, null,
      React.createElement(XrInvocationButton, { invocation: placeInvocation, disabled: false, onInvoke }),
      React.createElement(XrInvocationButton, { invocation: transformInvocation, disabled: false, onInvoke }),
    ), { window: dom.window as unknown as Window, frames: 2 })
    const buttons = Array.from(container.querySelectorAll('[data-kg-media-xr-invocation]')) as HTMLButtonElement[]
    if (buttons.length !== 2 || buttons.some((button, index) => (
      button.dataset.kgMediaXrInvocation !== [placeInvocation, transformInvocation][index]
      || button.getAttribute('aria-label') !== `Invoke ${[placeInvocation, transformInvocation][index]}`
      || button.textContent?.replace(/\s+/g, ' ').trim() !== [placeInvocation, transformInvocation][index]
    ))) throw new Error('expected XR Media chips to expose the exact executable invocation')

    for (const button of buttons) {
      await act(async () => {
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
        await waitForNextFrame(dom.window)
      })
    }
    const dispatched = dispatchedInputs.map(input => input.invocation)
    if (dispatched.join('|') !== [placeInvocation, transformInvocation].join('|')
      || dispatchedInputs.some(input => Object.keys(input).join(',') !== 'invocation')) {
      throw new Error(`expected XR Media clicks to dispatch only their displayed literal, got ${dispatched.join('|')}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
