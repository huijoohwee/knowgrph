import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  persistMarkdownExplorerViewPreferences,
  readMarkdownExplorerViewPreferences,
} from '@/features/markdown/ui/markdownExplorerViewPreferencesPersistence'

export async function testMarkdownExplorerViewPreferencesPersistenceCentralizesWordWrapAndTextHighlight() {
  const { dom, restore } = initJsdomHarness()

  try {
    dom.window.localStorage.clear()

    const initial = readMarkdownExplorerViewPreferences(dom.window.localStorage)
    if (initial.markdownWordWrap !== true || initial.markdownTextHighlight !== false) {
      throw new Error(`expected default explorer view preferences, got ${JSON.stringify(initial)}`)
    }

    const persisted = persistMarkdownExplorerViewPreferences(
      {
        markdownWordWrap: false,
        markdownTextHighlight: true,
      },
      dom.window.localStorage,
    )
    if (persisted.markdownWordWrap !== false || persisted.markdownTextHighlight !== true) {
      throw new Error(`expected persisted explorer view preferences, got ${JSON.stringify(persisted)}`)
    }

    const roundTrip = readMarkdownExplorerViewPreferences(dom.window.localStorage)
    if (roundTrip.markdownWordWrap !== false || roundTrip.markdownTextHighlight !== true) {
      throw new Error(`expected round-trip explorer view preferences, got ${JSON.stringify(roundTrip)}`)
    }

    const partial = persistMarkdownExplorerViewPreferences(
      {
        markdownWordWrap: true,
      },
      dom.window.localStorage,
    )
    if (partial.markdownWordWrap !== true || partial.markdownTextHighlight !== true) {
      throw new Error(`expected partial update to preserve text-highlight flag, got ${JSON.stringify(partial)}`)
    }
  } finally {
    restore()
  }
}
