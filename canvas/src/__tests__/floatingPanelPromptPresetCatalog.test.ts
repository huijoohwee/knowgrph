import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { createPresetWorkspace, promptCatalogMarkdown } from '@/__tests__/floatingPanelChatVideoPreset.test'
import {
  isPromptPresetCatalogError,
  loadPromptPreset,
  loadPromptPresetCatalog,
  PROMPT_PRESET_CATALOG_WORKSPACE_PATH,
} from '@/features/chat/promptPresetCatalog'
import {
  buildPromptPresetChatInvocationCatalogEntries,
  resolveChatInvocationCatalogEntryInsertionText,
} from '@/features/chat/chatInvocationRegistry'
import { FloatingPanelPromptPresetsView } from '@/features/toolbar/FloatingPanelPromptPresetsView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

export async function testFloatingPanelChatPromptPresetCatalogLoadsSixCentralizedPresets() {
  const workspace = await createPresetWorkspace()
  const catalog = await loadPromptPresetCatalog(workspace)
  if (isPromptPresetCatalogError(catalog)) throw new Error(catalog.error)
  if (catalog.sourcePath !== PROMPT_PRESET_CATALOG_WORKSPACE_PATH) throw new Error(`unexpected catalog source ${catalog.sourcePath}`)
  if (catalog.presets.map(preset => preset.id).join(',') !== 'video-agent,image-to-threejs,image-to-glb,sme-care-agent,investment-research-agent,crawler-agent') throw new Error(`unexpected centralized prompt presets ${JSON.stringify(catalog.presets)}`)
  for (const preset of catalog.presets) {
    const loaded = await loadPromptPreset(preset.id, workspace)
    if (isPromptPresetCatalogError(loaded) || !loaded.preset.prompt.startsWith(preset.runtimeCommand)) throw new Error(`expected ${preset.id} to load from the centralized catalog, got ${JSON.stringify(loaded)}`)
  }
  const invocationEntries = buildPromptPresetChatInvocationCatalogEntries(catalog.presets)
  if (invocationEntries.map(entry => entry.token).join(',') !== '/video-prompt-preset,/image.to-threejs,/image.to-glb,/sme-care-prompt-preset,/investment-research-prompt-preset,/crawler-prompt-preset') {
    throw new Error(`expected every centralized preset in the slash invocation projection, got ${JSON.stringify(invocationEntries)}`)
  }
  for (const [index, entry] of invocationEntries.entries()) {
    if (resolveChatInvocationCatalogEntryInsertionText(entry) !== catalog.presets[index]?.prompt) {
      throw new Error(`expected ${entry.token} to insert its complete centralized prompt`)
    }
  }
  const extendedCatalogMarkdown = promptCatalogMarkdown.replace('\n---\n\n# Prompt presets', [
    '', '  - id: "crawler-agent-reference"', '    label: "Crawler Agent Reference"',
    '    slash_command: "/crawler-reference-prompt-preset"', '    runtime_command: "/crawler-agent"',
    '    description: "Reference crawler preset"', '    activation: "chat-agent"', '    prompt: |-',
    '      /crawler-agent @url:https://example.invalid @reference-policy #canvas', '',
    '      Crawl the referenced website with the reference policy.', '---', '', '# Prompt presets',
  ].join('\n'))
  await workspace.writeFileText(PROMPT_PRESET_CATALOG_WORKSPACE_PATH, extendedCatalogMarkdown)
  const extendedCatalog = await loadPromptPresetCatalog(workspace)
  if (isPromptPresetCatalogError(extendedCatalog) || extendedCatalog.presets.length !== 7) throw new Error(`expected the source-backed catalog to accept future presets, got ${JSON.stringify(extendedCatalog)}`)
  const extendedInvocationEntries = buildPromptPresetChatInvocationCatalogEntries(extendedCatalog.presets)
  if (extendedInvocationEntries.at(-1)?.token !== '/crawler-reference-prompt-preset') {
    throw new Error(`expected future source-backed presets to join slash invocation without a local registry edit, got ${JSON.stringify(extendedInvocationEntries)}`)
  }
}

export async function testFloatingPanelPromptPresetsViewRendersAndInvokesAgentChoices() {
  const workspace = await createPresetWorkspace()
  const catalog = await loadPromptPresetCatalog(workspace)
  if (isPromptPresetCatalogError(catalog)) throw new Error(catalog.error)
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const invokedPrompts: string[] = []
  try {
    await mountReactRoot(root, React.createElement(FloatingPanelPromptPresetsView, { runtime: {
      loadCatalog: async () => catalog,
      loadPrompt: async id => {
        const result = await loadPromptPreset(id, workspace)
        return isPromptPresetCatalogError(result) ? { ok: false as const, error: result.error } : { ok: true as const, prompt: result.preset.prompt }
      },
      invokePrompt: prompt => { invokedPrompts.push(prompt); return true },
    } }), { window: dom.window as unknown as Window, frames: 4 })
    const rows = [...container.querySelectorAll<HTMLButtonElement>('button[data-kg-prompt-preset-row]')]
    if (rows.map(row => row.dataset.kgPromptPresetRow).join(',') !== 'video-agent,image-to-threejs,image-to-glb,sme-care-agent,investment-research-agent,crawler-agent') throw new Error(`unexpected rendered preset rows ${rows.map(row => row.dataset.kgPromptPresetRow).join(',')}`)
    const tokens = [...container.querySelectorAll<HTMLElement>('[data-kg-prompt-preset-token-chip]')].map(token => token.textContent?.trim())
    if (tokens.join(',') !== '/video-prompt-preset,/image.to-threejs,/image.to-glb,/sme-care-prompt-preset,/investment-research-prompt-preset,/crawler-prompt-preset') throw new Error(`unexpected prompt preset invocation tokens ${tokens.join(',')}`)
    for (const row of rows) { await act(async () => { row.click() }); await waitForFrames(dom.window as unknown as Window, 3) }
    if (invokedPrompts.length !== catalog.presets.length) throw new Error(`expected each preset to invoke Chat, got ${invokedPrompts.length}`)
    for (const [index, preset] of catalog.presets.entries()) if (!invokedPrompts[index]?.startsWith(preset.runtimeCommand)) throw new Error(`expected ${preset.id} to invoke its complete centralized prompt, got ${invokedPrompts[index]}`)
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    restore()
  }
}
