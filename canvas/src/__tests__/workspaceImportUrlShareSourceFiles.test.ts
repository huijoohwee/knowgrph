import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { importWorkspaceUrl } from '@/features/markdown-workspace/workspaceImport'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  readWorkspaceImportShareExportRootPathSetting,
  writeWorkspaceImportShareExportRootPathSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'

export async function testWorkspaceImportUrlShareThinkingArtifactIsSourceFileVisible(): Promise<void> {
  const { restore } = initJsdomHarness()
  const previousDocsAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousChatLogAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
  const previousShareRoot = readWorkspaceImportShareExportRootPathSetting()
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'workspace-import-share-source-files-'))
  const shareUrl = 'https://claude.ai/chat/6706219f-f8d2-418a-90a9-aae18de752a7'
  const token = '6706219f-f8d2-418a-90a9-aae18de752a7'
  const thinkingPath = `/docs_/${token}/${token}-thinking.md`
  try {
    process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = `${tempRoot}/docs`
    process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = `${tempRoot}/chat-log`
    writeWorkspaceImportShareExportRootPathSetting('/docs_')
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const result = await importWorkspaceUrl({
      fs,
      urlRaw: shareUrl,
      parentPath: '/',
      fetchUrlContent: async url => ({
        normalizedUrl: url,
        name: 'claude-share.md',
        text: '# Claude Share\n',
        thinkingText: '# Thinking\n\n- visible in Source Files\n',
      }),
    })
    if (!result.sources.some(item => item.path === thinkingPath && item.source.kind === 'url')) {
      throw new Error(`expected share thinking artifact to be registered as a URL source, got ${JSON.stringify(result.sources)}`)
    }
    const sourcesByPath = Object.fromEntries(result.sources.map(item => [item.path, item.source])) as WorkspaceSourceIndex
    const sourceFiles = mergeWorkspaceEntriesIntoSourceFiles({
      existing: [],
      workspaceEntries: await fs.listEntries(),
      sourcesByPath,
      workspaceDocsOnly: true,
      workspaceSourceRootPaths: ['/docs_', '/docs', '/chat-log'],
    })
    const thinking = sourceFiles.find(file => file.source?.path === `workspace:${thinkingPath}`)
    if (!thinking) throw new Error('expected imported thinking artifact under /docs_ to remain visible in Source Files')
    if (!String(thinking.text || '').includes('visible in Source Files')) {
      throw new Error(`expected visible thinking Source File to keep imported text, got ${JSON.stringify(thinking)}`)
    }
  } finally {
    writeWorkspaceImportShareExportRootPathSetting(previousShareRoot)
    if (typeof previousDocsAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousDocsAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (typeof previousChatLogAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT = previousChatLogAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_CHAT_LOG_ABS_ROOT
    await rm(tempRoot, { recursive: true, force: true })
    restore()
  }
}

export function testConfiguredDocsRootWorkspaceFileIsVisibleWithoutLegacySourceIndex(): void {
  const token = '6706219f-f8d2-418a-90a9-aae18de752a7'
  const thinkingPath = `/docs_/${token}/${token}-thinking.md`
  const sourceFiles = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      {
        kind: 'file',
        path: thinkingPath as never,
        parentPath: `/docs_/${token}` as never,
        name: `${token}-thinking.md`,
        text: '# Already imported thinking\n',
        updatedAtMs: 1,
      },
      {
        kind: 'file',
        path: '/scratch/hidden.md' as never,
        parentPath: '/scratch' as never,
        name: 'hidden.md',
        text: '# Hidden',
        updatedAtMs: 1,
      },
    ],
    sourcesByPath: {},
    workspaceDocsOnly: true,
    workspaceSourceRootPaths: ['/docs_', '/docs', '/chat-log'],
  })
  const thinking = sourceFiles.find(file => file.source?.path === `workspace:${thinkingPath}`)
  if (!thinking) throw new Error('expected existing /docs_ workspace artifact to be visible without legacy source-index metadata')
  const hidden = sourceFiles.find(file => file.source?.path === 'workspace:/scratch/hidden.md')
  if (hidden) throw new Error('expected docs-only Source Files mode to keep non-root workspace files hidden')
}
