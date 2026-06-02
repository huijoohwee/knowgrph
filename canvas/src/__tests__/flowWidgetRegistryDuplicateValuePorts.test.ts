import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'

import { NodeOverlayEditorRegistrySection } from '@/components/FlowEditor/NodeOverlayEditorRegistrySection'

type DomGlobalState = {
  window?: unknown
  document?: unknown
  Event?: unknown
  InputEvent?: unknown
  HTMLElement?: unknown
  HTMLInputElement?: unknown
  HTMLTextAreaElement?: unknown
  IS_REACT_ACT_ENVIRONMENT?: unknown
}

const restoreDomGlobal = (target: DomGlobalState, key: keyof DomGlobalState, value: unknown) => {
  if (typeof value === 'undefined') {
    delete target[key]
    return
  }
  target[key] = value
}

const installDomGlobals = (dom: JSDOM): (() => void) => {
  const g = globalThis as unknown as DomGlobalState
  const previous: DomGlobalState = {
    window: g.window,
    document: g.document,
    Event: g.Event,
    InputEvent: g.InputEvent,
    HTMLElement: g.HTMLElement,
    HTMLInputElement: g.HTMLInputElement,
    HTMLTextAreaElement: g.HTMLTextAreaElement,
    IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT,
  }
  g.window = dom.window
  g.document = dom.window.document
  g.Event = dom.window.Event
  g.InputEvent = dom.window.InputEvent
  g.HTMLElement = dom.window.HTMLElement
  g.HTMLInputElement = dom.window.HTMLInputElement
  g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  g.IS_REACT_ACT_ENVIRONMENT = true
  return () => {
    Object.entries(previous).forEach(([key, value]) => restoreDomGlobal(g, key as keyof DomGlobalState, value))
    dom.window.close()
  }
}

export const testWidgetRegistryDuplicateValueAndPortRowsUseUniqueControlNames = async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const restoreGlobals = installDomGlobals(dom)
  const host = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(host)
  const root = createRoot(host)
  const patched: Array<Record<string, unknown>> = []
  try {
    await act(() => {
      root.render(
        React.createElement(NodeOverlayEditorRegistrySection, {
          active: true,
          properties: { value: 1, nested: { value: 2 } },
          registryEntry: {
            id: 'duplicate-value-widget',
            nodeTypeId: 'MetricNode',
            widgetTypeId: 'default',
            formId: 'values',
            fields: [
              { fieldKey: 'value', fieldType: 'number', schemaPath: 'properties.value', label: 'Value' },
              { fieldKey: 'value', fieldType: 'number', schemaPath: 'properties.nested.value', label: 'Value' },
            ],
            ports: [
              { portKey: 'value', direction: 'output', schemaPath: 'properties.value' },
              { portKey: 'value', direction: 'output', schemaPath: 'properties.nested.value' },
            ],
          } as any,
          microLabelClass: 'text-xs',
          monospaceTextClass: 'font-mono',
          textSizeClass: 'text-sm',
          keyValueInputClass: 'border',
          keyLabelClass: 'text-xs',
          ids: { registryField: (k: string) => k },
          dotSizePx: 10,
          dotHitPx: 18,
          portHandlesEnabled: true,
          onSetProperties: next => patched.push(next),
        }),
      )
    })
    const valueControls = Array.from(host.querySelectorAll('[data-kg-card-inline-edit][id], input[id]')) as HTMLElement[]
    const ids = valueControls.map(input => input.id).filter(Boolean)
    if (ids.length !== 2) throw new Error(`expected duplicate field/port rows to consolidate into editable Value rows, got ${ids.length}`)
    if (new Set(ids).size !== ids.length) throw new Error(`expected duplicate Value KTV rows to use unique input ids, got ${ids.join(',')}`)
    const portButtons = Array.from(host.querySelectorAll('button[data-kg-port-key="value"][data-kg-port-dir="out"]')) as HTMLButtonElement[]
    if (portButtons.length !== 2) throw new Error(`expected both duplicate semantic port rows to remain visible, got ${portButtons.length}`)
    const aria = portButtons.map(button => String(button.getAttribute('aria-label') || '').trim()).filter(Boolean)
    if (new Set(aria).size !== aria.length) throw new Error(`expected duplicate port handle rows to use unique accessible names, got ${aria.join(',')}`)
    if (!aria.every(label => label.includes('properties.'))) throw new Error(`expected duplicate port names to include schema-path identity, got ${aria.join(',')}`)
    const nestedValueInput = valueControls.find(input => input.id.includes('properties.nested.value')) || null
    if (!nestedValueInput) throw new Error(`expected nested Value input to expose schema-scoped id, got ${ids.join(',')}`)
    const portRows = portButtons.map(button => button.closest('tr')).filter((row): row is HTMLTableRowElement => Boolean(row))
    if (portRows.some(row => row.querySelector('input[disabled][readonly]'))) {
      throw new Error('expected duplicate port handles to live on editable field rows instead of read-only duplicate rows')
    }
    if (!portRows.every(row => row.querySelector('[data-kg-card-inline-edit="1"]'))) {
      throw new Error('expected every duplicate port row to keep an inline-editable Value control')
    }
    const portValues = portRows
      .map(row => String((row.querySelector('[data-kg-card-inline-edit="1"]') as HTMLElement | null)?.textContent || '').trim())
      .sort()
    if (portValues.join('|') !== '1|2') throw new Error(`expected duplicate port Value cells to show schema-path values 1 and 2, got ${JSON.stringify(portValues)}`)
    if (portValues.includes('value')) throw new Error(`expected duplicate port Value cells to avoid echoing semantic port key, got ${JSON.stringify(portValues)}`)
    await act(async () => {
      nestedValueInput.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const editable = dom.window.document.getElementById(nestedValueInput.id)
    if (
      !(editable instanceof dom.window.HTMLInputElement)
      && !(editable instanceof dom.window.HTMLTextAreaElement)
    ) {
      throw new Error('expected duplicate Value KTV row to open shared inline editor')
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      editable instanceof dom.window.HTMLTextAreaElement
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype,
      'value',
    )?.set
    if (!valueSetter) throw new Error('expected DOM input value setter')
    await act(async () => {
      valueSetter.call(editable, '9')
      Simulate.change(editable)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const changedEditable = dom.window.document.getElementById(nestedValueInput.id)
    if (
      !(changedEditable instanceof dom.window.HTMLInputElement)
      && !(changedEditable instanceof dom.window.HTMLTextAreaElement)
    ) {
      throw new Error('expected duplicate Value KTV row to keep shared inline editor open after change')
    }
    await act(async () => {
      Simulate.keyDown(changedEditable, { key: 'Enter' })
    })
    if (!patched.some(entry => ((entry.nested || {}) as Record<string, unknown>).value === 9)) {
      throw new Error(`expected duplicate Value KTV row edit to update nested value, got ${JSON.stringify(patched)}`)
    }
  } finally {
    await act(() => {
      root.unmount()
    })
    restoreGlobals()
  }
}
