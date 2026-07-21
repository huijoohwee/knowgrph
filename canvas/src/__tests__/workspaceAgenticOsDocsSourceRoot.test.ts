import path from 'node:path'
import os from 'node:os'
import fsPromises from 'node:fs/promises'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  readWorkspaceImportShareExportRootPathSetting,
  writeWorkspaceImportShareExportRootPathSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'
import { resolveWorkspaceSourceRootPaths } from '@/features/workspace-fs/workspaceSourceRoots'
import { readWorkspaceInitializationDocsMirrorEntries } from '@/features/workspace-fs/workspaceSeedProvider'
import { resolveWorkspaceDocsMirrorLocalRootRequests } from '@/features/workspace-fs/workspaceDocsMirrorLocalRoots'
import { resetCanonicalAgenticDocsMirrorCacheForTests } from '@/features/workspace-fs/workspaceGithubDocsMirror'

export function testWorkspaceSourceRootPathsKeepAgenticOsDocsOutOfExplorer(): void {
  const { restore } = initJsdomHarness()
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousValue = readWorkspaceImportShareExportRootPathSetting()
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = path.join(os.tmpdir(), 'kg-root', 'docs')
    writeWorkspaceImportShareExportRootPathSetting('/docs_')
    const roots = resolveWorkspaceSourceRootPaths()
    if (roots.includes('/agentic-canvas-os/docs')) {
      throw new Error(`expected runtime-only agentic-canvas-os/docs root to stay out of Source Files, got ${roots.join(', ')}`)
    }
    if (!roots.includes('/notes')) {
      throw new Error(`expected authored notes to remain isolated as a workspace source root, got ${roots.join(', ')}`)
    }
    if (!roots.includes('/docs_')) {
      throw new Error(`expected generated output root to remain visible in Source Files, got ${roots.join(', ')}`)
    }
    if (!roots.includes('/docs')) {
      throw new Error(`expected runnable demo root to remain visible in Source Files, got ${roots.join(', ')}`)
    }
  } finally {
    writeWorkspaceImportShareExportRootPathSetting(previousValue)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    restore()
  }
}

export async function testWorkspaceSeedProviderIncludesSiblingAgenticOsDocsMirrorRoot() {
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'kg-agentic-docs-mirror-'))
  const docsRoot = path.join(tmpRoot, 'docs')
  const agenticDocsRoot = path.join(tmpRoot, 'agentic-canvas-os', 'docs')
  const previousAgenticDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = docsRoot
    process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT = agenticDocsRoot
    await fsPromises.mkdir(docsRoot, { recursive: true })
    await fsPromises.mkdir(agenticDocsRoot, { recursive: true })
    await fsPromises.writeFile(path.join(docsRoot, 'workspace-readme.md'), '# Docs Root\n')
    await fsPromises.writeFile(path.join(agenticDocsRoot, 'RUNTIME-READINESS.md'), '# Runtime Readiness\n')

    const mirrored = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
    const relPaths = new Set(mirrored.map(entry => entry.relPath))
    if (!relPaths.has('workspace-readme.md')) throw new Error(`expected canonical docs root entry to stay unprefixed, got ${JSON.stringify([...relPaths])}`)
    if (!relPaths.has('agentic-canvas-os/docs/RUNTIME-READINESS.md')) throw new Error(`expected sibling agentic-canvas-os/docs entry to keep its workspace root prefix, got ${JSON.stringify([...relPaths])}`)
    if (relPaths.has('RUNTIME-READINESS.md')) throw new Error('expected sibling agentic-canvas-os/docs entry not to flatten into the docs root')
  } finally {
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousAgenticDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT = previousAgenticDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT
    await fsPromises.rm(tmpRoot, { recursive: true, force: true })
  }
}

export function testWorkspaceDocsMirrorLocalRootsPromotesAgenticFallbackWhenPrimaryRootIsAbsent(): void {
  const fallbackOnly = resolveWorkspaceDocsMirrorLocalRootRequests({
    docsAbsRoot: '',
    agenticDocsAbsRoot: '/tmp/agentic-canvas-os/docs',
  })
  if (fallbackOnly.length !== 1 || fallbackOnly[0]?.workspaceRootName) {
    throw new Error(`expected the sole Agentic docs root to project unprefixed, got ${JSON.stringify(fallbackOnly)}`)
  }
  const combined = resolveWorkspaceDocsMirrorLocalRootRequests({
    docsAbsRoot: '/tmp/knowgrph/docs',
    agenticDocsAbsRoot: '/tmp/agentic-canvas-os/docs',
  })
  if (combined[1]?.workspaceRootName !== 'agentic-canvas-os/docs') {
    throw new Error(`expected a secondary Agentic docs root to retain its namespace, got ${JSON.stringify(combined)}`)
  }
}

export async function testWorkspaceSeedProviderUsesLocalAgenticDocsWhenGitHubIsUnavailable() {
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousAgenticDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT
  const previousFetch = globalThis.fetch
  const globals = globalThis as typeof globalThis & { window?: Window }
  const previousWindow = globals.window
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'kg-agentic-docs-fallback-'))
  const agenticDocsRoot = path.join(tmpRoot, 'agentic-canvas-os', 'docs')
  try {
    delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT = agenticDocsRoot
    await fsPromises.mkdir(agenticDocsRoot, { recursive: true })
    await fsPromises.writeFile(path.join(agenticDocsRoot, 'README.md'), '# Local Agentic Docs\n')
    globalThis.fetch = async () => new Response('', { status: 403 })
    delete globals.window
    resetCanonicalAgenticDocsMirrorCacheForTests()

    const mirrored = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
    const readme = mirrored.find(entry => entry.relPath === 'README.md')
    if (readme?.text !== '# Local Agentic Docs\n') {
      throw new Error(`expected local README fallback after GitHub 403, got ${JSON.stringify(mirrored)}`)
    }
    if (mirrored.some(entry => entry.relPath === 'agentic-canvas-os/docs/README.md')) {
      throw new Error('expected the sole Agentic docs root to materialize directly beneath /docs')
    }
  } finally {
    resetCanonicalAgenticDocsMirrorCacheForTests()
    globalThis.fetch = previousFetch
    if (previousWindow) globals.window = previousWindow
    else delete globals.window
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousAgenticDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT = previousAgenticDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_AGENTIC_CANVAS_OS_DOCS_ABS_ROOT
    await fsPromises.rm(tmpRoot, { recursive: true, force: true })
  }
}
