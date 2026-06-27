import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { defaultSchema } from '@/lib/graph/schema'
import { NodeOverlayEditorPortHandles } from '@/components/FlowEditor/NodeOverlayEditorPortHandles'

export const testFlowWidgetRendersPortHandleGutterWhenEnabled = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const schema = {
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, portHandles: { ...defaultSchema.behavior.portHandles, enabled: true } },
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(
      'div',
      { style: { position: 'relative', width: 360, height: 320 } },
      React.createElement(NodeOverlayEditorPortHandles, {
        active: true,
        node: { id: 'n1', type: 'Node', properties: {} },
        schema,
        edges: [],
        minimized: false,
        toolMode: 'select',
        pendingEdgeSourceId: null,
      }),
    ),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const inputButtons = host.querySelectorAll('button[aria-label^="Input handle"]')
  const outputButtons = host.querySelectorAll('button[aria-label^="Output handle"]')
  const portHandleSurface = host.querySelector('nav[aria-label="Node port handles"]') as HTMLElement | null
  if (inputButtons.length !== 1) throw new Error(`expected 1 input handle button, got ${inputButtons.length}`)
  if (outputButtons.length !== 1) throw new Error(`expected 1 output handle button, got ${outputButtons.length}`)
  if (!portHandleSurface?.style.zIndex) throw new Error('expected port handle surface to own an elevated z-index above media bodies')

  const inputDisabled = (inputButtons[0] as HTMLButtonElement).disabled
  const outputDisabled = (outputButtons[0] as HTMLButtonElement).disabled
  if (inputDisabled !== true) throw new Error('expected input handle to be disabled in select mode')
  if (outputDisabled !== false) throw new Error('expected output handle to be enabled in select mode')

  root.unmount()
}
