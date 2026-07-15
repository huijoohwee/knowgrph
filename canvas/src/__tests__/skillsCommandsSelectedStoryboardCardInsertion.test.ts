import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveChatInvocationCatalogEntries, type ChatInvocationCatalogPrefixFilter } from '@/features/chat/chatInvocationRegistry'
import { resolveInlineInvocationChipClassName } from '@/features/markdown/ui/dataViewChipStyles'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import {
  insertTextIntoActiveCardInlineTextEditor,
  setActiveCardInlineTextExternalCommandTarget,
  setCardInlineTextExternalCommandElementTarget,
} from '@/lib/cards/cardInlineTextExternalCommands'
import { replaceTextRangeWithInvocationBoundary, splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export async function testSkillsCommandsInsertTokensIntoSelectedStoryboardCardPrompt() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const staleSelectionTokens: string[] = []
  const initialValue = 'Generate a text response for the active request.'
  let staleField: HTMLElement | null = null

  function SelectedWidgetCard() {
    const [prompt, setPrompt] = React.useState(initialValue)
    return React.createElement(
      'article',
      { 'data-kg-storyboard-widget-selected': '1' },
      React.createElement(CardInlineTextEditor, {
        value: 'Widget Card',
        ariaLabel: 'Storyboard title for selected-card',
        placeholder: 'Add title',
        canEdit: true,
        editActivation: 'click',
      }),
      React.createElement(CardInlineTextEditor, {
        value: prompt,
        ariaLabel: 'Prompt for selected-card',
        placeholder: 'Add prompt',
        canEdit: true,
        editActivation: 'click',
        editorSurface: 'viewer',
        inlineChipDensity: 'compact',
        markdownPreview: 'auto',
        mediaCommandMode: 'external',
        multiline: true,
        openOnPointerDown: true,
        showCommandLaunchers: false,
        onCommit: nextValue => {
          committedValues.push(nextValue)
          setPrompt(nextValue)
        },
      }),
    )
  }

  try {
    setActiveCardInlineTextExternalCommandTarget(null)
    await act(async () => {
      root.render(React.createElement(SelectedWidgetCard))
      await waitForFrames(dom.window, 4)
    })

    const promptDisplay = container.querySelector('[aria-label="Prompt for selected-card"]')
    if (!(promptDisplay instanceof dom.window.HTMLElement) || promptDisplay.getAttribute('data-kg-card-inline-external-text-target') !== '1') {
      throw new Error('Expected the selected Widget Card prompt to expose its external text insertion target')
    }
    setCardInlineTextExternalCommandElementTarget(promptDisplay, null)
    staleField = dom.window.document.createElement('section')
    staleField.setAttribute('data-kg-card-inline-edit', '1')
    staleField.textContent = 'Unselected card prompt'
    dom.window.document.body.prepend(staleField)
    setCardInlineTextExternalCommandElementTarget(staleField, {
      id: 'unselected-card-prompt',
      insertMedia: () => false,
      insertText: token => { staleSelectionTokens.push(token); return true },
    })
    const staleRange = dom.window.document.createRange()
    staleRange.selectNodeContents(staleField)
    dom.window.getSelection()?.removeAllRanges()
    dom.window.getSelection()?.addRange(staleRange)

    const tokens = ['/prd-tad.create', '#long-horizon-harness', '@message-gateway']
    for (const token of tokens) {
      await act(async () => {
        if (!insertTextIntoActiveCardInlineTextEditor(token)) {
          throw new Error(`Expected selected Widget Card prompt to accept ${token}`)
        }
        await waitForFrames(dom.window, 2)
      })
    }

    const prompt = container.querySelector('[aria-label="Prompt for selected-card"]')
    const finalValue = String(prompt?.textContent || committedValues.at(-1) || '')
    if (!committedValues.length || staleSelectionTokens.length || !finalValue.includes(initialValue) || !tokens.every(token => finalValue.includes(token))) {
      throw new Error(`Expected selected Widget Card or Rich Media Panel prompt to receive /, #, and @ tokens, got ${JSON.stringify(prompt?.textContent || committedValues.at(-1) || '')}`)
    }
  } finally {
    setCardInlineTextExternalCommandElementTarget(staleField, null)
    setActiveCardInlineTextExternalCommandTarget(null)
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    staleField?.remove()
    container.remove()
    restore()
  }
}

export function testCardInvocationInsertionPreservesSharedCatalogChipContract() {
  const source = 'Generate a text response for the active request.'
  const start = source.indexOf('text')
  const cases: Array<{ prefix: ChatInvocationCatalogPrefixFilter; preferredToken: string }> = [
    { prefix: 'slash', preferredToken: '/sme-care-agent' },
    { prefix: 'hash', preferredToken: '#agent' },
    { prefix: 'at', preferredToken: '@agent' },
  ]
  cases.forEach(({ prefix, preferredToken }) => {
    const entries = resolveChatInvocationCatalogEntries(prefix, '')
    const entry = entries.find(candidate => candidate.token === preferredToken) || entries[0]
    if (!entry) throw new Error(`Expected at least one shared ${prefix} invocation catalog entry`)
    const token = entry.token
    const result = replaceTextRangeWithInvocationBoundary({ text: source, start, end: start, replacement: entry.token })
    const expected = `Generate a ${token} text response for the active request.`
    if (result.text !== expected || !result.text.slice(result.cursor).startsWith('text response')) {
      throw new Error(`Expected ${token} insertion to preserve both invocation boundaries, got ${JSON.stringify(result)}`)
    }
    const tokenSegments = splitInvocationTokenSegments(result.text).filter(segment => segment.kind === 'token')
    if (tokenSegments.length !== 1 || tokenSegments[0]?.value !== token) {
      throw new Error(`Expected ${token} to remain an exact shared invocation token, got ${JSON.stringify(tokenSegments)}`)
    }
    const catalogClass = resolveInlineInvocationChipClassName({ value: entry.token })
    const cardClass = resolveInlineInvocationChipClassName({ value: tokenSegments[0].value })
    if (cardClass !== catalogClass) throw new Error(`Expected card and catalog chip classes to match for ${token}`)
  })
}

export async function testCardInlineInvocationMenusReuseAllSkillsCommandsTokens() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const cases: Array<{ ariaLabel: string, prefix: ChatInvocationCatalogPrefixFilter, sigil: '/' | '#' | '@', token: string }> = [
    { ariaLabel: 'Card slash commands', prefix: 'slash', sigil: '/', token: '/storybuilding' },
    { ariaLabel: 'Card keyword commands', prefix: 'hash', sigil: '#', token: '#agent' },
    { ariaLabel: 'Card variable commands', prefix: 'at', sigil: '@', token: '@agent' },
  ]

  function InvocationSurface() {
    const [prompt, setPrompt] = React.useState('Generate a text response for the active request.')
    return React.createElement('article', { 'data-kg-storyboard-widget-selected': '1' }, React.createElement(CardInlineTextEditor, {
      value: prompt,
      ariaLabel: 'Prompt for inline catalog',
      placeholder: 'Add prompt',
      canEdit: true,
      editActivation: 'click',
      editorSurface: 'viewer',
      inlineChipDensity: 'compact',
      markdownPreview: 'auto',
      mediaCommandMode: 'external',
      multiline: true,
      openOnPointerDown: true,
      showCommandLaunchers: false,
      onCommit: nextValue => { committedValues.push(nextValue); setPrompt(nextValue) },
    }))
  }

  try {
    for (const testCase of cases) {
      committedValues.length = 0
      await act(async () => {
        root.render(React.createElement(InvocationSurface, { key: testCase.sigil }))
        await waitForFrames(dom.window, 4)
      })
      const display = container.querySelector('[aria-label="Prompt for inline catalog"]')
      if (!(display instanceof dom.window.HTMLElement)) throw new Error(`Expected prompt display for ${testCase.sigil}`)
      await act(async () => {
        display.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: testCase.sigil }))
        await waitForFrames(dom.window, 4)
      })
      const expectedEntries = resolveChatInvocationCatalogEntries(testCase.prefix, '')
      const commandItems = dom.window.document.querySelectorAll(`[role="listbox"][aria-label="${testCase.ariaLabel}"] [data-kg-inline-command-item-id]`) as NodeListOf<Element>
      const actualIds = new Set(Array.from(commandItems)
        .map(item => item.getAttribute('data-kg-inline-command-item-id') || ''))
      const missing = expectedEntries.filter(entry => !actualIds.has(`skills-commands-${testCase.prefix}-${entry.id}`))
      if (missing.length) throw new Error(`Expected ${testCase.sigil} inline menu to reuse every Skills & Commands entry; missing ${missing.slice(0, 5).map(entry => entry.token).join(', ')}`)
      const selectedEntry = expectedEntries.find(entry => entry.token === testCase.token) || expectedEntries[0]
      const option = selectedEntry
        ? dom.window.document.querySelector(`[data-kg-inline-command-item-id="skills-commands-${testCase.prefix}-${selectedEntry.id}"]`)
        : null
      if (!(option instanceof dom.window.HTMLElement) || !selectedEntry) throw new Error(`Expected an invokable token in ${testCase.ariaLabel}`)
      await act(async () => {
        option.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
        await waitForFrames(dom.window, 4)
      })
      const prompt = container.querySelector('[aria-label="Prompt for inline catalog"]')
      if (!String(prompt?.textContent || committedValues.at(-1) || '').includes(selectedEntry.token)) {
        throw new Error(`Expected ${selectedEntry.token} selection to insert into the active prompt`)
      }
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
