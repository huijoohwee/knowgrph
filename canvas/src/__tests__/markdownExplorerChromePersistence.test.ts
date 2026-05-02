import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  persistMarkdownExplorerChromeState,
  readMarkdownExplorerChromeState,
} from '@/features/markdown/ui/markdownExplorerChromePersistence'

export async function testMarkdownExplorerChromePersistenceCentralizesSidebarWidthAndOpenState() {
  const { dom, restore } = initJsdomHarness()

  try {
    dom.window.localStorage.clear()

    const initial = readMarkdownExplorerChromeState({
      storage: dom.window.localStorage,
      minWidthPx: 160,
      maxWidthPx: 560,
      defaultWidthPx: 256,
    })
    if (initial.sidebarWidthPx !== 256 || initial.explorerOpen !== true) {
      throw new Error(`expected explorer chrome defaults, got ${JSON.stringify(initial)}`)
    }

    const persisted = persistMarkdownExplorerChromeState(
      {
        sidebarWidthPx: 999,
        explorerOpen: false,
      },
      {
        storage: dom.window.localStorage,
        minWidthPx: 160,
        maxWidthPx: 560,
        defaultWidthPx: 256,
      },
    )
    if (persisted.sidebarWidthPx !== 560 || persisted.explorerOpen !== false) {
      throw new Error(`expected persisted explorer chrome state to clamp width and keep open flag, got ${JSON.stringify(persisted)}`)
    }

    const roundTrip = readMarkdownExplorerChromeState({
      storage: dom.window.localStorage,
      minWidthPx: 160,
      maxWidthPx: 560,
      defaultWidthPx: 256,
    })
    if (roundTrip.sidebarWidthPx !== 560 || roundTrip.explorerOpen !== false) {
      throw new Error(`expected explorer chrome state to round-trip, got ${JSON.stringify(roundTrip)}`)
    }

    const widthOnly = persistMarkdownExplorerChromeState(
      {
        sidebarWidthPx: 120,
      },
      {
        storage: dom.window.localStorage,
        minWidthPx: 160,
        maxWidthPx: 560,
        defaultWidthPx: 256,
      },
    )
    if (widthOnly.sidebarWidthPx !== 160 || widthOnly.explorerOpen !== false) {
      throw new Error(`expected width-only persist to preserve open flag and clamp min width, got ${JSON.stringify(widthOnly)}`)
    }
  } finally {
    restore()
  }
}
