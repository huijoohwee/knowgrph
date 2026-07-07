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

export function testWorkspaceSourceRootPathsIncludeAgenticOsDocsRoot(): void {
  const { restore } = initJsdomHarness()
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousValue = readWorkspaceImportShareExportRootPathSetting()
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = path.join(os.tmpdir(), 'kg-root', 'docs')
    writeWorkspaceImportShareExportRootPathSetting('/docs_')
    const roots = resolveWorkspaceSourceRootPaths()
    if (!roots.includes('/agentic-os-docs')) {
      throw new Error(`expected sibling agentic-os-docs root to participate in workspace source roots, got ${roots.join(', ')}`)
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
  const agenticDocsRoot = path.join(tmpRoot, 'agentic-os-docs')
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = docsRoot
    await fsPromises.mkdir(docsRoot, { recursive: true })
    await fsPromises.mkdir(agenticDocsRoot, { recursive: true })
    await fsPromises.writeFile(path.join(docsRoot, 'workspace-readme.md'), '# Docs Root\n')
    await fsPromises.writeFile(path.join(agenticDocsRoot, 'RUNTIME-READINESS.md'), '# Runtime Readiness\n')

    const mirrored = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
    const relPaths = new Set(mirrored.map(entry => entry.relPath))
    if (!relPaths.has('workspace-readme.md')) throw new Error(`expected canonical docs root entry to stay unprefixed, got ${JSON.stringify([...relPaths])}`)
    if (!relPaths.has('agentic-os-docs/RUNTIME-READINESS.md')) throw new Error(`expected sibling agentic-os-docs entry to keep its workspace root prefix, got ${JSON.stringify([...relPaths])}`)
    if (relPaths.has('RUNTIME-READINESS.md')) throw new Error('expected sibling agentic-os-docs entry not to flatten into the docs root')
  } finally {
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    await fsPromises.rm(tmpRoot, { recursive: true, force: true })
  }
}
