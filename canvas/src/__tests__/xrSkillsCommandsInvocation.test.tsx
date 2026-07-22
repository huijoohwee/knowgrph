import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RETIRED_BROWSER_DICTIONARY_FALLBACK_TOKENS,
  registerPinnedAgenticOsDictionaryTokensForTest,
} from '@/__tests__/helpers/pinnedAgenticOsDictionary'
import { resetAgenticOsRemoteGrammarCatalogForTests } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import SkillsCommandsView from '@/features/panels/views/SkillsCommandsView'
import {
  XR_SCENE_INVOCATION_BINDINGS,
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_INVOCATION_SEMANTICS,
} from '@/features/three/xrSceneMcpContract.mjs'
import { setActiveCardInlineTextExternalCommandTarget } from '@/lib/cards/cardInlineTextExternalCommands'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForNextFrame } from '@/tests/lib/reactRootHarness'

export async function testSkillsCommandsXrGrammarInsertsExactTokens() {
  resetAgenticOsRemoteGrammarCatalogForTests()
  registerPinnedAgenticOsDictionaryTokensForTest(RETIRED_BROWSER_DICTIONARY_FALLBACK_TOKENS)
  const tokens = [
    ...Object.values(XR_SCENE_INVOCATION_COMMANDS),
    ...Object.values(XR_SCENE_INVOCATION_BINDINGS),
    ...Object.values(XR_SCENE_INVOCATION_SEMANTICS),
  ]
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const insertedTokens: string[] = []
  setActiveCardInlineTextExternalCommandTarget({
    id: 'xr-invocation-runtime-test',
    insertMedia: () => false,
    insertText: replacement => {
      insertedTokens.push(replacement)
      return true
    },
  })

  try {
    await mountReactRoot(root, React.createElement(SkillsCommandsView), {
      window: dom.window as unknown as Window,
      frames: 2,
    })
    const rows = Array.from(container.querySelectorAll('[data-kg-skill-command-token]')) as HTMLElement[]
    for (const token of tokens) {
      const row = rows.find(candidate => candidate.dataset.kgSkillCommandToken === token)
      if (!row || row.getAttribute('aria-label') !== `Insert ${token}`) {
        throw new Error(`expected Skills & Commands to expose exact XR token ${token}`)
      }
      await act(async () => {
        row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
        await waitForNextFrame(dom.window)
      })
    }
    if (insertedTokens.join('|') !== tokens.join('|')) {
      throw new Error(`expected exact XR / @ # insertion order, got ${insertedTokens.join('|')}`)
    }
  } finally {
    setActiveCardInlineTextExternalCommandTarget(null)
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
    resetAgenticOsRemoteGrammarCatalogForTests()
  }
}
