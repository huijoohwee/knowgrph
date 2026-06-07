import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { FlowEditorInlineValueEditor } from '@/components/FlowEditor/FlowEditorInlineValueEditor'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const readUtf8 = (relativePath: string) => {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

export function testPlainTextInputEditorUsesReactChangeContract() {
  const plainTextInput = readUtf8('../components/ui/PlainTextInputEditor.tsx')
  if (plainTextInput.includes('onInput=')) {
    throw new Error('expected PlainTextInputEditor to avoid native onInput handlers and reuse the shared React change contract')
  }
  const changeHandlerCount = (plainTextInput.match(/onChange=\{ev => onChange\?\.\(ev\.currentTarget\.value\)\}/g) || []).length
  if (changeHandlerCount < 2) {
    throw new Error(`expected PlainTextInputEditor to publish the React change contract for both input variants, got ${changeHandlerCount}`)
  }
  for (const snippet of ['value={value}', 'value={value}\n        defaultValue={defaultValue}', 'value={value}\n      defaultValue={defaultValue}']) {
    if (!plainTextInput.includes(snippet)) {
      throw new Error(`expected PlainTextInputEditor to keep controlled value ownership for shared editors: ${snippet}`)
    }
  }
}

export function testCardInlineTextEditorPreservesSharedMultilineCommitContract() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  for (const snippet of [
    '<PlainTextInputEditor',
    'value={draft}',
    'onChange={setDraft}',
    "editActivation = 'doubleClick'",
    'data-kg-card-inline-edit-activation={editActivation}',
    "if (editActivation !== 'click') return",
    'onBlur={() => {',
    'commit()',
    "if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey))",
    'onCommit?.(next)',
  ]) {
    if (!cardInlineEditor.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditor to preserve the shared multiline commit contract: ${snippet}`)
    }
  }
}

export function testCardInlineTextEditorAvoidsRuntimeFocusPolyfill() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  for (const fragment of ['attach' + 'Event', 'detach' + 'Event']) {
    if (cardInlineEditor.includes(fragment)) {
      throw new Error(`expected CardInlineTextEditor to avoid runtime focus polyfill fragment: ${fragment}`)
    }
  }
}

export async function testCardInlineTextEditorAllowsSharedClickActivation() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Revenue card',
          ariaLabel: 'Card title',
          placeholder: 'Add title',
          canEdit: true,
          editActivation: 'click',
          onCommit: () => void 0,
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card inline editor to expose the click activation marker')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const input = container.querySelector('input[aria-label="Card title"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected shared card inline editor click activation to open the editable input')
    }
    if (input.value !== 'Revenue card') {
      throw new Error(`expected click activation to preserve current card value, got ${JSON.stringify(input.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorCanPropagateActivationClick() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let parentClicks = 0

  try {
    await act(async () => {
      root.render(
        React.createElement('section', {
          onClick: () => {
            parentClicks += 1
          },
        }, React.createElement(CardInlineTextEditor, {
          value: 'Metric target',
          ariaLabel: 'Metric target',
          placeholder: 'Add target',
          canEdit: true,
          editActivation: 'click',
          stopActivationPropagation: false,
          onCommit: () => void 0,
        })),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card inline editor to expose the click activation marker')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (parentClicks !== 1) {
      throw new Error(`expected shared inline editor to allow activation click propagation when requested, got ${parentClicks}`)
    }
    const input = container.querySelector('input[aria-label="Metric target"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected propagated activation click to still open the editable input')
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testFlowEditorInlineValueEditorFirstInactiveClickCommits() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let committed = ''
  let parentClicks = 0

  function Harness() {
    const [active, setActive] = React.useState(false)
    return React.createElement('section', {
      onClick: () => {
        parentClicks += 1
        setActive(true)
      },
    }, React.createElement(FlowEditorInlineValueEditor, {
      id: 'flow-editor-first-click-value',
      value: '50',
      active,
      ariaLabel: 'Metric target',
      onCommit: next => {
        committed = next
      },
    }))
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected Flow Editor Value cell to render the shared click-activated inline editor')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (parentClicks !== 0) {
      throw new Error(`expected first inactive Flow Editor value click to stay local and avoid workspace/indexing activation, got ${parentClicks}`)
    }

    const input = container.querySelector('input[aria-label="Metric target"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected first inactive Flow Editor value click to open the shared editable input')
    }
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
    if (!setter) throw new Error('expected input value setter')

    await act(async () => {
      setter.call(input, '77')
      Simulate.change(input)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    await act(async () => {
      Simulate.keyDown(input, { key: 'Enter' })
    })

    if (committed !== '77') {
      throw new Error(`expected first Flow Editor inline edit value to commit without requiring a second click, got ${JSON.stringify(committed)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
