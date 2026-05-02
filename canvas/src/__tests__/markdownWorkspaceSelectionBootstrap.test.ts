import {
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { resolveMarkdownWorkspaceBootstrapActivePath } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionBootstrap'

const buildFileEntry = (path: string): WorkspaceEntry => ({
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/',
  kind: 'file',
  name: path.split('/').pop() || '',
  text: '',
  updatedAtMs: 1,
})

export function testMarkdownWorkspaceSelectionBootstrapCentralizesStartupAndFallbackSelection() {
  const defaultSeedEntries = [
    buildFileEntry(WORKSPACE_README_SEED_PATH),
    buildFileEntry(TEST_VALIDATION_WORKSPACE_SEED_PATH),
  ]

  const startup = resolveMarkdownWorkspaceBootstrapActivePath({
    entries: defaultSeedEntries,
    activePath: null,
    lastSetActivePath: null,
    lastRequestedActivePath: null,
    nowMs: 10_000,
  })
  if (startup !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected bootstrap helper to prefer the validation seed as the default initialization file, got ${String(startup)}`)
  }

  const preserveValidActivePath = resolveMarkdownWorkspaceBootstrapActivePath({
    entries: [buildFileEntry('/docs/a.md'), buildFileEntry('/docs/b.md')],
    activePath: '/docs/b.md' as never,
    lastSetActivePath: { path: '/docs/b.md' as never, atMs: 8_000 },
    lastRequestedActivePath: null,
    nowMs: 10_000,
  })
  if (preserveValidActivePath !== null) {
    throw new Error(`expected valid active path to suppress bootstrap fallback, got ${String(preserveValidActivePath)}`)
  }

  const preserveRecentMissingRequest = resolveMarkdownWorkspaceBootstrapActivePath({
    entries: [buildFileEntry('/docs/a.md')],
    activePath: '/docs/missing.md' as never,
    lastSetActivePath: null,
    lastRequestedActivePath: { path: '/docs/missing.md' as never, atMs: 9_500 },
    nowMs: 10_000,
  })
  if (preserveRecentMissingRequest !== null) {
    throw new Error(`expected recent missing request to suppress first-file fallback, got ${String(preserveRecentMissingRequest)}`)
  }

  const fallback = resolveMarkdownWorkspaceBootstrapActivePath({
    entries: [buildFileEntry('/docs/first.md'), buildFileEntry('/docs/second.md')],
    activePath: '/docs/missing.md' as never,
    lastSetActivePath: { path: '/docs/missing.md' as never, atMs: 1_000 },
    lastRequestedActivePath: null,
    nowMs: 10_000,
  })
  if (fallback !== '/docs/first.md') {
    throw new Error(`expected stale missing active path to fall back to first file, got ${String(fallback)}`)
  }
}
