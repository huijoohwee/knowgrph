import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  persistMarkdownExplorerModePreferences,
  readMarkdownExplorerModePreferences,
} from '@/features/markdown/ui/markdownExplorerModePreferencesPersistence'

export async function testMarkdownExplorerModePreferencesPersistenceCentralizesFolderModeAndLayoutMode() {
  const { dom, restore } = initJsdomHarness()

  try {
    dom.window.localStorage.clear()

    const initial = readMarkdownExplorerModePreferences(dom.window.localStorage)
    if (initial.folderModeContract !== 'sitemap' || initial.layoutMode !== 'split') {
      throw new Error(`expected default explorer mode preferences, got ${JSON.stringify(initial)}`)
    }

    dom.window.localStorage.setItem('kg:ui:markdown:explorer:folderModeContract', JSON.stringify('invalid-mode'))
    dom.window.localStorage.setItem('kg:ui:markdown:layoutMode', JSON.stringify('not-a-layout'))
    const normalized = readMarkdownExplorerModePreferences(dom.window.localStorage)
    if (normalized.folderModeContract !== 'sitemap' || normalized.layoutMode !== 'viewer') {
      throw new Error(`expected invalid stored values to normalize through shared parsers, got ${JSON.stringify(normalized)}`)
    }

    const persisted = persistMarkdownExplorerModePreferences(
      {
        folderModeContract: 'user-journey',
        layoutMode: 'presentation',
      },
      dom.window.localStorage,
    )
    if (persisted.folderModeContract !== 'user-journey' || persisted.layoutMode !== 'presentation') {
      throw new Error(`expected persisted explorer mode preferences, got ${JSON.stringify(persisted)}`)
    }

    const partial = persistMarkdownExplorerModePreferences(
      {
        folderModeContract: 'sitemap',
      },
      dom.window.localStorage,
    )
    if (partial.folderModeContract !== 'sitemap' || partial.layoutMode !== 'presentation') {
      throw new Error(`expected partial mode update to preserve layout mode, got ${JSON.stringify(partial)}`)
    }
  } finally {
    restore()
  }
}
