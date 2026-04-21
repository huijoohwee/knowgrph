import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { NodeOverlayEditorSchemaTable } from '@/components/FlowEditor/NodeOverlayEditorSchemaTable'
import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'

export const testFlowWidgetPortHandleDomAnchorsPresent = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })

  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(
      'div',
      { style: { width: 360, height: 420 } },
      React.createElement(NodeOverlayEditorSchemaTable, {
        active: true,
        schemaFields: [{ id: 'prompt', label: 'Prompt', type: 'string' }],
        portHandlesEnabled: true,
        dotSizePx: 10,
        dotHitPx: 18,
        microLabelClass: 'text-xs',
        textSizeClass: 'text-sm',
        keyValueInputClass: 'border',
        onCommitSchemaFields: () => void 0,
      }),
      React.createElement(NodeOverlayEditorRegistrySection, {
        active: true,
        properties: {},
        registryEntry: {
          id: 'x',
          widgetTypeId: 'x',
          fields: [],
          ports: [{ portKey: 'prompt_out', direction: 'output' }],
        } as any,
        microLabelClass: 'text-xs',
        monospaceTextClass: 'font-mono',
        textSizeClass: 'text-sm',
        keyValueInputClass: 'border',
        keyLabelClass: 'text-xs',
        normalizeRegistrySchemaPath: () => '',
        ids: { registryField: (k: string) => k },
        dotSizePx: 10,
        dotHitPx: 18,
        portHandlesEnabled: true,
        onSetProperties: () => void 0,
      }),
    ),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 20))

  const schemaIn = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="in"][data-kg-port-key^="field:"]')
  const schemaOut = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="out"][data-kg-port-key^="field:"]')
  if (!schemaIn || !schemaOut) throw new Error('expected schema port handle buttons to expose DOM anchor data')

  const regOut = host.querySelector('button[data-kg-port-handle="1"][data-kg-port-dir="out"][data-kg-port-key="prompt_out"]')
  if (!regOut) throw new Error('expected registry port handle button to expose DOM anchor data')

  root.unmount()
}
