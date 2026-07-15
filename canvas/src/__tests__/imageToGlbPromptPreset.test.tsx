import React from 'react'
import { createRoot } from 'react-dom/client'
import { resetAgenticOsRemoteGrammarCatalogForTests } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { resolveChatInvocationCatalogEntries } from '@/features/chat/chatInvocationRegistry'
import {
  IMAGE_TO_GLB_PROMPT_PRESET_ID,
  IMAGE_TO_GLB_PROMPT_PRESET_TOKENS,
  buildImageToGlbPromptPreset,
  isImageToGlbPromptPreset,
} from '@/features/image-to-glb/imageToGlbPromptPreset'
import SkillsCommandsView from '@/features/panels/views/SkillsCommandsView'
import { setActiveCardInlineTextExternalCommandTarget } from '@/lib/cards/cardInlineTextExternalCommands'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'

export function testImageToGlbPromptPresetComposesSharedGrammarBeforeAuthoredRequest() {
  const request = 'Construct a procedural GLB from the selected reference image.'
  const preset = buildImageToGlbPromptPreset(request)
  const expected = `${IMAGE_TO_GLB_PROMPT_PRESET_TOKENS.join(' ')}\n\n${request}`
  if (!isImageToGlbPromptPreset(preset) || preset !== expected) {
    throw new Error(`expected image-to-glb preset to preserve authored request after its shared grammar, got ${preset}`)
  }
}

export async function testImageToGlbPromptPresetLoadsSharedGrammarIntoSelectedWidgetCard() {
  resetAgenticOsRemoteGrammarCatalogForTests()
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const sourceCard = {
    prompt: 'Generate a text response for the active request.',
    sourceMedia: { url: 'workspace:/media/reference.png', kind: 'image' },
  }
  const sourceMediaBefore = JSON.stringify(sourceCard.sourceMedia)

  setActiveCardInlineTextExternalCommandTarget({
    id: 'selected-image-glb-widget-card',
    insertMedia: () => false,
    insertText: replacement => {
      sourceCard.prompt = `${sourceCard.prompt}\n${replacement}`
      return true
    },
  })

  try {
    const presetEntry = resolveChatInvocationCatalogEntries('slash', 'image to glb')
      .find(entry => entry.promptPresetId === IMAGE_TO_GLB_PROMPT_PRESET_ID)
    const semanticEntry = resolveChatInvocationCatalogEntries('hash', 'image to glb')
      .find(entry => entry.token === '#image-to-glb')
    const bindingEntry = resolveChatInvocationCatalogEntries('at', 'image to glb')
      .find(entry => entry.token === '@image-to-glb')
    if (
      !presetEntry
      || presetEntry.insertionText !== buildImageToGlbPromptPreset()
      || !semanticEntry
      || !bindingEntry
    ) {
      throw new Error(`expected source-backed image-to-glb /, #, and @ catalog entries, got ${JSON.stringify({ presetEntry, semanticEntry, bindingEntry })}`)
    }

    await mountReactRoot(root, React.createElement(SkillsCommandsView, { searchQuery: 'image to glb' }), {
      window: dom.window as unknown as Window,
      frames: 2,
    })
    const presetRow = container.querySelector(`[data-kg-skill-command-prompt-preset="${IMAGE_TO_GLB_PROMPT_PRESET_ID}"]`) as HTMLElement | null
    if (!presetRow || presetRow.getAttribute('data-kg-skill-command-token') !== '/image.to-glb') {
      throw new Error('expected the shared Skills & Commands catalog to expose the image-to-glb prompt preset')
    }

    presetRow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitForNextFrame(dom.window)

    const tokens = splitInvocationTokenSegments(sourceCard.prompt)
      .filter(segment => segment.kind === 'token')
      .map(segment => segment.value)
    if (
      !sourceCard.prompt.startsWith('Generate a text response for the active request.')
      || tokens.join('|') !== IMAGE_TO_GLB_PROMPT_PRESET_TOKENS.join('|')
      || JSON.stringify(sourceCard.sourceMedia) !== sourceMediaBefore
    ) {
      throw new Error(`expected the preset to append only its shared grammar without mutating source media, got ${JSON.stringify(sourceCard)}`)
    }
  } finally {
    setActiveCardInlineTextExternalCommandTarget(null)
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
    resetAgenticOsRemoteGrammarCatalogForTests()
  }
}
