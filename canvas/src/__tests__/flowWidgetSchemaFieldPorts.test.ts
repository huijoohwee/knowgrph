import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { defaultSchema } from '@/lib/graph/schema'
import { NodeOverlayEditorForm } from '@/components/FlowEditor/NodeOverlayEditorForm'

export const testFlowWidgetSchemaFieldPortsRenderRowHandles = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const schema = {
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, portHandles: { ...defaultSchema.behavior.portHandles, enabled: true } },
  }

  const node = {
    id: 'table:products',
    label: 'Products',
    type: 'Schema',
    properties: {
      'schema:fields': ['id', { title: 'warehouse_id', type: 'uuid' }],
    },
  }

  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)

  root.render(
    React.createElement(NodeOverlayEditorForm, {
      active: true,
      node,
      schema,
      hideFields: true,
      labelInputRef: { current: null },
      onSetLabel: () => void 0,
      onSetType: () => void 0,
      onPatchProperties: () => void 0,
      onSetProperties: () => void 0,
      onValidate: () => void 0,
      onSchemaPortHandleClick: () => void 0,
    }),
  )

  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const inButtons = host.querySelectorAll('button[aria-label^="Input port:"]')
  const outButtons = host.querySelectorAll('button[aria-label^="Output port:"]')
  if (inButtons.length !== 2) throw new Error(`expected 2 input port buttons, got ${inButtons.length}`)
  if (outButtons.length !== 2) throw new Error(`expected 2 output port buttons, got ${outButtons.length}`)

  root.unmount()
}
