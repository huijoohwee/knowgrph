import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { resolveInitialMarkdownExplorerActivePath } from '@/features/markdown-explorer/store'

export async function testMarkdownExplorerStoreBootstrapSuppressesPersistedInitializationPaths() {
  const { restore } = initJsdomHarness()
  try {
    const readme = resolveInitialMarkdownExplorerActivePath('/README.md')
    if (readme !== null) {
      throw new Error(`expected persisted README initialization path to be ignored on cold boot, got ${String(readme)}`)
    }

    const videoDemo = resolveInitialMarkdownExplorerActivePath('/knowgrph-video-demo.md')
    if (videoDemo !== null) {
      throw new Error(`expected persisted video-demo initialization path to be ignored on cold boot, got ${String(videoDemo)}`)
    }

    const custom = resolveInitialMarkdownExplorerActivePath('/notes/custom.md')
    if (custom !== '/notes/custom.md') {
      throw new Error(`expected custom workspace path to remain restorable, got ${String(custom)}`)
    }
  } finally {
    restore()
  }
}
