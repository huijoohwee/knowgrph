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
  const flowEditorOverlayProxy = readUtf8('../lib/canvas/flow-editor-overlay-proxy.ts')
  for (const snippet of [
    '<PlainTextInputEditor',
    'value={draft}',
    'onChange={setDraft}',
    "editActivation = 'doubleClick'",
    'data-kg-card-inline-edit-activation={editActivation}',
    'onPointerDown={event => {',
    'shouldOpenMarkdownViewerInlineEditorFromReadClick',
    'onBlur={event => {',
    'commit()',
    "if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey))",
    'onCommit?.(next)',
  ]) {
    if (!cardInlineEditor.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditor to preserve the shared multiline commit contract: ${snippet}`)
    }
  }
  if (!flowEditorOverlayProxy.includes('[data-kg-card-inline-edit="1"]')) {
    throw new Error('expected Flow Editor overlay pointer routing to treat shared card inline editors as interactive controls')
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
  const committedValues: string[] = []

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

export async function testCardInlineTextEditorMarkdownCommandMenusApplySlashAndVariableActions() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Widget panel text',
          ariaLabel: 'Widget text',
          placeholder: 'Add text',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: [
            'imageUrl: "https://media.example.test/poster.jpg"',
            'videoUrl: "https://www.youtube.com/watch?v=demoVideoId"',
          ].join('\n'),
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card editor display surface')
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Widget text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected multiline card editor textarea')
    }
    const slashButton = container.querySelector('button[title="Slash commands"]')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(slashButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected slash command launcher')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      slashButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      slashButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const slashInput = dom.window.document.querySelector('input[placeholder="Type a command"]')
    if (!(slashInput instanceof dom.window.HTMLInputElement)) throw new Error('expected slash command search input')
    const checklistButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card slash commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Checklist'),
    )
    if (!(checklistButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Checklist slash command')
    await act(async () => {
      checklistButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      checklistButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('- [ ] Widget panel text')) {
      throw new Error(`expected slash command to transform widget panel text into a checklist item, got ${JSON.stringify(textarea.value)}`)
    }

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const variableInput = dom.window.document.querySelector('input[placeholder="Find variable or action"]')
    if (!(variableInput instanceof dom.window.HTMLInputElement)) throw new Error('expected variable command search input')
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
    if (!setter) throw new Error('expected input value setter')
    await act(async () => {
      setter.call(variableInput, 'venue')
      Simulate.change(variableInput)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const insertReferenceButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Insert reference'),
    )
    if (!(insertReferenceButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Insert reference variable command')
    await act(async () => {
      insertReferenceButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insertReferenceButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('{{venue}}')) {
      throw new Error(`expected variable command to insert markdown variable token, got ${JSON.stringify(textarea.value)}`)
    }
    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const imageInsertButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Image: imageUrl') && String(el.textContent || '').includes('https://media.example.test/poster.jpg'),
    )
    if (!(imageInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Image @ media insertion command with resolved URL')
    const imageThumbnail = imageInsertButton.querySelector('[data-kg-inline-command-thumbnail="image"] img')
    if (!(imageThumbnail instanceof dom.window.HTMLImageElement)) throw new Error('expected Image @ media insertion command to show a thumbnail')
    if (imageThumbnail.getAttribute('src') !== 'https://media.example.test/poster.jpg') {
      throw new Error(`expected Image @ media thumbnail to use the resolved image URL, got ${JSON.stringify(imageThumbnail.getAttribute('src'))}`)
    }
    await act(async () => {
      imageInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      imageInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('![image](https://media.example.test/poster.jpg)')) {
      throw new Error(`expected @ Image command to insert resolved image embed, got ${JSON.stringify(textarea.value)}`)
    }
    if (!committedValues.some(value => value.includes('![image](https://media.example.test/poster.jpg)'))) {
      throw new Error(`expected @ Image command to persist the resolved image embed immediately, got ${JSON.stringify(committedValues)}`)
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const activeTextareaAfterImageInsert = container.querySelector('textarea[aria-label="Widget text"]')
    if (activeTextareaAfterImageInsert) {
      throw new Error('expected persisted @ Image insertion to close the editor so the saved thumbnail preview can render')
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorVideoCommandPersistsPosterThumbnail() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Send approved sequence to video generation.',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: 'videoUrl: "https://www.youtube.com/watch?v=demoVideoId"',
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const videoInsertButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => el.id === 'Card variable commands-insert-video' && String(el.textContent || '').includes('https://www.youtube.com/watch?v=demoVideoId'),
    )
    if (!(videoInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected generic Video @ media insertion command to resolve the contextual URL')
    const videoThumbnail = videoInsertButton.querySelector('[data-kg-inline-command-thumbnail="video"] img')
    if (!(videoThumbnail instanceof dom.window.HTMLImageElement)) throw new Error('expected Video @ media insertion command to show a thumbnail')
    if (videoThumbnail.getAttribute('src') !== 'https://i.ytimg.com/vi/demoVideoId/hqdefault.jpg') {
      throw new Error(`expected Video @ media thumbnail to use derived poster URL, got ${JSON.stringify(videoThumbnail.getAttribute('src'))}`)
    }

    await act(async () => {
      Simulate.blur(textarea, { relatedTarget: null })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!dom.window.document.querySelector('#Card\\ variable\\ commands-insert-video')) {
      throw new Error('expected @ Video command menu to stay open across null relatedTarget blur')
    }

    await act(async () => {
      videoInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      videoInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const persisted = committedValues.find(value => value.includes('<video'))
    if (!persisted) throw new Error(`expected @ Video command to persist a video embed, got ${JSON.stringify(committedValues)}`)
    if (!persisted.includes('poster="https://i.ytimg.com/vi/demoVideoId/hqdefault.jpg"')) {
      throw new Error(`expected persisted @ Video embed to include a poster thumbnail, got ${JSON.stringify(persisted)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorGenericMediaPlaceholderStaysEditable() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Inline media placeholder',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          onCommit: () => {},
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const imageInsertButton = dom.window.document.querySelector('#Card\\ variable\\ commands-insert-image')
    if (!(imageInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected generic Image @ media insertion command')

    await act(async () => {
      imageInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      imageInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const activeTextarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(activeTextarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected unresolved @ Image insertion to stay in the inline text box')
    }
    if (!activeTextarea.value.includes('![Image alt](image-url)')) {
      throw new Error(`expected unresolved @ Image insertion to add an editable markdown placeholder, got ${JSON.stringify(activeTextarea.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorMarkdownPreviewOneClickReopensDefaultEditor() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review evidence 123 ![image](https://media.example.test/poster.jpg)',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          multiline: true,
          markdownPreview: 'auto',
          onCommit: () => {},
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="doubleClick"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card editor display surface to preserve default double-click activation')
    }
    const previewRoot = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!(previewRoot instanceof dom.window.HTMLElement)) {
      throw new Error('expected markdown preview read surface to render inside the shared card editor display')
    }
    const previewImage = previewRoot.querySelector('img[data-kg-media-thumbnail="1"]')
    if (!(previewImage instanceof dom.window.HTMLImageElement)) {
      throw new Error('expected markdown preview media thumbnail to render inside the shared card editor display')
    }

    await act(async () => {
      previewRoot.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, detail: 1 }))
      previewRoot.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }))
      previewRoot.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected one click on the markdown preview read surface to reopen the default shared inline editor')
    }
    if (!textarea.value.includes('![image](https://media.example.test/poster.jpg)')) {
      throw new Error(`expected reopened editor to preserve the inserted image markdown, got ${JSON.stringify(textarea.value)}`)
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
  let parentPointerDowns = 0

  function Harness() {
    const [active, setActive] = React.useState(false)
    return React.createElement('section', {
      onPointerDown: () => {
        parentPointerDowns += 1
      },
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
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (parentPointerDowns !== 0) {
      throw new Error(`expected first inactive Flow Editor value pointer-down to stay local and avoid workspace/indexing activation, got ${parentPointerDowns}`)
    }
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
