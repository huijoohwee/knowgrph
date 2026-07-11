import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import {
  CANVAS_EMBED_SETTINGS_ROW_COUNT,
  CanvasEmbedSettingsRows,
  matchesCanvasEmbedQuery,
} from '@/features/panels/views/CanvasEmbedSettingsRows'
import {
  CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL,
  readCanvasEmbedIframeSrc,
} from '@/features/canvas/canvasEmbedImportContract'
import { normalizeCanonicalWorkspaceReadmeCanvasEmbedUrl } from '@/features/canvas/canvasEmbedPresets'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'
import { readLiveCanvasHeroSourceSelection, LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT } from '@/features/canvas/liveCanvasHeroSourceSelection'

export async function testMainPanelCanvasEmbedSettingsReuseSharedImportPanel(): Promise<void> {
  if (CANVAS_EMBED_SETTINGS_ROW_COUNT !== 1) throw new Error('expected one Canvas Embed settings row')
  if (!CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL.startsWith('https://airvio.co/knowgrph/share/')) {
    throw new Error('expected the canonical Workspace README share URL to remain source-backed')
  }
  for (const rendererParam of ['kgCanvasSurfaceMode=2d', 'kgCanvasRenderMode=2d', 'kgCanvas2dRenderer=storyboard']) {
    if (!CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL.includes(rendererParam)) {
      throw new Error(`expected the canonical embed preset to select the Storyboard 2D renderer via ${rendererParam}`)
    }
  }
  const migratedLegacySelection = normalizeCanonicalWorkspaceReadmeCanvasEmbedUrl(`${CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL}&kgPreview=1&kgLiveHero=1`)
  if (migratedLegacySelection.includes('kgPreview=') || migratedLegacySelection.includes('kgLiveHero=')) {
    throw new Error(`expected stale canonical Hero preview flags to migrate to the direct Storyboard iframe, got ${migratedLegacySelection}`)
  }
  if (readCanvasEmbedIframeSrc(`<iframe src="${CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL}"></iframe>`) !== CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL) {
    throw new Error('expected the canonical Workspace README URL to use the shared iframe parser')
  }
  if (!matchesCanvasEmbedQuery('iframe postmessage') || matchesCanvasEmbedQuery('unrelated-provider')) {
    throw new Error('expected Canvas Embed settings search to stay scoped to the embed contract')
  }

  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  let selectedEmbedUrl = ''
  const selectionListener = (event: Event) => {
    selectedEmbedUrl = readLiveCanvasHeroSourceSelection(event)?.embedUrl || ''
  }
  dom.window.addEventListener(LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT, selectionListener)
  try {
    await mountReactRoot(root, <CanvasEmbedSettingsRows />, { window: dom.window as unknown as Window, frames: 1 })
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    const importButton = buttons.find(button => button.textContent?.trim() === 'Import canvas embed')
    if (!importButton) throw new Error('expected MainPanel Settings to expose Import canvas embed')
    const presetButton = buttons.find(button => button.textContent?.trim() === 'Use Workspace README background')
    if (!presetButton) throw new Error('expected MainPanel Settings to expose the Workspace README embed preset')
    await act(async () => {
      presetButton.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (selectedEmbedUrl !== CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL) {
      throw new Error(`expected the preset to preserve the actual remote Storyboard iframe URL, got ${selectedEmbedUrl}`)
    }
    await act(async () => {
      importButton.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    const panel = container.querySelector('[aria-label="Import canvas embed panel"]')
    if (!panel || !panel.textContent?.includes('iframe + postMessage')) {
      throw new Error('expected MainPanel Settings to reuse the shared iframe and postMessage import panel')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    dom.window.removeEventListener(LIVE_CANVAS_HERO_SOURCE_SELECT_EVENT, selectionListener)
    container.remove()
    restore()
  }
}
