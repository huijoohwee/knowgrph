import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
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
