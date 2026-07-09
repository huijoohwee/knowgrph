import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { buildInlineMediaCommandContextFromRecord } from '@/lib/command-menu/inlineMediaCommandContext'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'

export function testInlineMediaCommandContextFromRecordFindsNestedMediaUrls() {
  const context = buildInlineMediaCommandContextFromRecord({
    id: 'node-1',
    media: {
      sourceUrl: 'https://media.example.test/runtime/storyboard-frame.mp4?token=abc',
      thumbnailUrl: 'https://media.example.test/runtime/storyboard-frame.jpg',
    },
    nested: {
      ignored: 'https://example.test/document',
      prompt: 'Render from https://media.example.test/runtime/reference.png',
    },
  })
  for (const expected of [
    'media.sourceUrl: "https://media.example.test/runtime/storyboard-frame.mp4?token=abc"',
    'media.thumbnailUrl: "https://media.example.test/runtime/storyboard-frame.jpg"',
    'nested.prompt: "Render from https://media.example.test/runtime/reference.png"',
  ]) {
    if (!context.includes(expected)) {
      throw new Error(`expected shared inline media command context to include ${expected}, got ${context}`)
    }
  }
  if (context.includes('https://example.test/document')) {
    throw new Error(`expected shared inline media command context to ignore non-media URLs, got ${context}`)
  }
}

export async function testCardInlineTextEditorShiftedAtKeyOpensVariableCommands() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Storyboard card summary',
          ariaLabel: 'Storyboard card summary',
          placeholder: 'Add summary',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: 'imageUrl: "https://media.example.test/storyboard-frame.jpg"',
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

    const textarea = container.querySelector('textarea[aria-label="Storyboard card summary"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected card editor textarea')
    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Digit2',
        key: '2',
        shiftKey: true,
      }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const variableMenu = dom.window.document.querySelector('section[aria-label="Card variable commands"]')
    if (!(variableMenu instanceof dom.window.HTMLElement)) {
      throw new Error('expected shifted @ key chord to open shared card variable commands')
    }
    const imageCommand = (Array.from(variableMenu.querySelectorAll('button')) as HTMLButtonElement[]).find(button => {
      return String(button.textContent || '').includes('Image: imageUrl')
        && String(button.textContent || '').includes('https://media.example.test/storyboard-frame.jpg')
    })
    if (!(imageCommand instanceof dom.window.HTMLButtonElement)) {
      throw new Error('expected shifted @ menu to reuse shared inline media command candidates')
    }
    if (textarea.value.endsWith('@')) {
      throw new Error(`expected shifted @ key chord to open commands without inserting a literal @, got ${JSON.stringify(textarea.value)}`)
    }
    await act(async () => {
      textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')?.set
    if (!valueSetter) throw new Error('expected textarea value setter')
    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      valueSetter.call(textarea, `${textarea.value}@`)
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      Simulate.change(textarea)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const fallbackVariableMenu = dom.window.document.querySelector('section[aria-label="Card variable commands"]')
    if (!(fallbackVariableMenu instanceof dom.window.HTMLElement)) {
      throw new Error('expected inserted @ value change to open shared card variable commands')
    }
    if (textarea.value.endsWith('@')) {
      throw new Error(`expected inserted @ fallback to remove the literal sigil, got ${JSON.stringify(textarea.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorDisplaySurfaceSigilOpensVariableCommands() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Storyboard card summary',
          ariaLabel: 'Storyboard display summary',
          placeholder: 'Add summary',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          showCommandLaunchers: false,
          markdownCommandContextText: 'mediaUrl: "https://media.example.test/storyboard-display.jpg"',
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-command-display="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared command display surface')
    if (container.querySelector('menu[aria-label="Card inline command launchers"]')) {
      throw new Error('expected display command test surface to hide visible / @ # launcher icons')
    }
    await act(async () => {
      display.focus()
      display.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Digit2',
        key: '2',
        shiftKey: true,
      }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Storyboard display summary"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected display-surface @ command to open shared textarea editor')
    }
    if (container.querySelector('menu[aria-label="Card inline command launchers"]')) {
      throw new Error('expected hidden launcher setting to preserve editor keyboard commands without visible / @ # icons')
    }
    const variableMenu = dom.window.document.querySelector('section[aria-label="Card variable commands"]')
    if (!(variableMenu instanceof dom.window.HTMLElement)) {
      throw new Error('expected display-surface @ command to open shared card variable commands')
    }
    const mediaCommand = (Array.from(variableMenu.querySelectorAll('button')) as HTMLButtonElement[]).find(button => {
      return String(button.textContent || '').includes('Image: mediaUrl')
        && String(button.textContent || '').includes('https://media.example.test/storyboard-display.jpg')
    })
    if (!(mediaCommand instanceof dom.window.HTMLButtonElement)) {
      throw new Error('expected display-surface @ command to reuse shared inline media command candidates')
    }
    if (textarea.value.endsWith('@')) {
      throw new Error(`expected display-surface @ command to open commands without inserting a literal @, got ${JSON.stringify(textarea.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorSelectedDisplayTextSigilOpensVariableCommands() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const selectedMediaCandidates: InlineMediaCommandCandidate[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'List reusable characters, locations, props, evidence cards, UI states, or shots.',
          ariaLabel: 'Summary for starter-elements-card',
          placeholder: 'Add summary',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: 'imageUrl: "https://media.example.test/reusable-elements.jpg"',
          onCommit: next => {
            committedValues.push(next)
          },
          onMediaCommandSelect: candidate => {
            selectedMediaCandidates.push(candidate)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[aria-label="Summary for starter-elements-card"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected starter elements summary display')
    const range = dom.window.document.createRange()
    range.selectNodeContents(display)
    const selection = dom.window.getSelection()
    if (!selection) throw new Error('expected browser selection')
    selection.removeAllRanges()
    selection.addRange(range)

    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'Digit2',
        key: '2',
        shiftKey: true,
      }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Summary for starter-elements-card"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected selected display text @ command to open shared textarea editor')
    }
    const variableMenu = dom.window.document.querySelector('section[aria-label="Card variable commands"]')
    if (!(variableMenu instanceof dom.window.HTMLElement)) {
      throw new Error('expected selected display text @ command to open shared card variable commands')
    }
    if (String(dom.window.getSelection?.() || '')) {
      throw new Error('expected selected display text @ command to clear stale browser selection')
    }
    if (textarea.value.endsWith('@')) {
      throw new Error(`expected selected display text @ command to avoid literal @ insertion, got ${JSON.stringify(textarea.value)}`)
    }
    const imageCommand = (Array.from(variableMenu.querySelectorAll('button')) as HTMLButtonElement[]).find(button => {
      return String(button.textContent || '').includes('Image: imageUrl')
        && String(button.textContent || '').includes('https://media.example.test/reusable-elements.jpg')
    })
    if (!(imageCommand instanceof dom.window.HTMLButtonElement)) {
      throw new Error('expected selected display text @ command to expose contextual image media command')
    }
    await act(async () => {
      imageCommand.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      imageCommand.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const committed = committedValues.find(value => value.includes('https://media.example.test/reusable-elements.jpg'))
    if (!committed || !committed.includes('![Image: imageUrl](https://media.example.test/reusable-elements.jpg)')) {
      throw new Error(`expected selected display media command to commit image markdown, got ${JSON.stringify(committedValues)}`)
    }
    const selectedCandidate = selectedMediaCandidates[0]
    if (
      !selectedCandidate
      || selectedCandidate.kind !== 'image'
      || selectedCandidate.url !== 'https://media.example.test/reusable-elements.jpg'
      || selectedCandidate.sourceKey !== 'imageUrl'
    ) {
      throw new Error(`expected selected display media command to expose runtime-ready media candidate, got ${JSON.stringify(selectedMediaCandidates)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
