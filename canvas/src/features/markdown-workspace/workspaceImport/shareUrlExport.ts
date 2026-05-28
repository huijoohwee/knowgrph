import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { ensureChatWorkspaceMirrorFolder, mirrorChatWorkspaceFileToHost } from '@/features/chat/chatWorkspaceMirror'
import { resolveShareUrlArtifactPaths, isShareUrlArtifactEligible } from '@/features/chat/shareUrlArtifacts'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'

const clampText = (value: unknown, maxLength: number): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : text
}

const formatReadableUtc = (timestampMs: number): string => {
  const date = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const pad2 = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    '-',
    pad2(date.getUTCMonth() + 1),
    '-',
    pad2(date.getUTCDate()),
    ' ',
    pad2(date.getUTCHours()),
    ':',
    pad2(date.getUTCMinutes()),
    ':',
    pad2(date.getUTCSeconds()),
    ' UTC',
  ].join('')
}

const stripLeadingFrontmatter = (value: string): string => {
  const text = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return text
  const closingIndex = text.indexOf('\n---\n', 4)
  if (closingIndex < 0) return text
  return text.slice(closingIndex + 5).trim()
}

const extractHeadingLines = (value: string, maxCount = 6): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  stripLeadingFrontmatter(value)
    .split('\n')
    .forEach(line => {
      const match = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line)
      const heading = clampText(match?.[1] || '', 140)
      if (!heading) return
      const key = heading.toLowerCase()
      if (seen.has(key) || out.length >= maxCount) return
      seen.add(key)
      out.push(heading)
    })
  return out
}

const extractPreviewLines = (value: string, maxCount = 8): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  stripLeadingFrontmatter(value)
    .split('\n')
    .forEach(line => {
      const normalized = clampText(line, 180)
      if (!normalized || normalized.startsWith('#') || normalized.startsWith('```') || normalized === '---') return
      const key = normalized.toLowerCase()
      if (seen.has(key) || out.length >= maxCount) return
      seen.add(key)
      out.push(normalized)
    })
  return out
}

const buildImportedShareThinkingDocument = (args: {
  url: string
  importedName: string
  importedText: string
  importedWorkspacePath: string
  exportToken: string
  exportMarkdownPath: string
  exportThinkingPath: string
}): string => {
  const headings = extractHeadingLines(args.importedText)
  const previewLines = extractPreviewLines(args.importedText)
  return [
    `# ${args.exportToken} Thinking Trace`,
    '',
    `- Share URL: ${args.url}`,
    `- Imported Workspace File: [${args.importedName}](${args.importedWorkspacePath})`,
    `- Canonical Markdown: [${args.exportToken}.md](${args.exportMarkdownPath})`,
    `- Created: ${formatReadableUtc(Date.now())}`,
    '',
    'Import trace derived from the upstream Import URL lifecycle.',
    '',
    '## Thinking Trajectory',
    '',
    '- Recognized the imported URL as a share artifact eligible for canonical export.',
    '- Reused the shared URL ingestion pipeline to fetch normalized markdown content.',
    `- Wrote the visible workspace import to ${args.importedWorkspacePath}.`,
    `- Wrote the canonical share markdown and thinking trace to ${args.exportThinkingPath.replace(/\/[^/]+$/, '')}.`,
    '',
    '## Thinking Process',
    '',
    `- Normalized source URL: ${args.url}`,
    `- Imported file name: ${args.importedName}`,
    `- Canonical share token: ${args.exportToken}`,
    `- Canonical markdown path: ${args.exportMarkdownPath}`,
    '',
    '## Searching For',
    '',
    '- A stable share-token folder under `/chat-log`.',
    '- The imported share markdown content with the original `kgWebpageUrl` preserved.',
    '- High-signal headings and preview lines from the imported workspace document.',
    '',
    '## Run Code',
    '',
    `- fetchWorkspaceUrlContent("${args.url}")`,
    `- fs.createFile({ name: "${args.importedName}" })`,
    `- writeWorkspaceFileTextEnsuringFile({ path: "${args.exportMarkdownPath}" })`,
    `- writeWorkspaceFileTextEnsuringFile({ path: "${args.exportThinkingPath}" })`,
    '',
    '## Workspace Output Snapshot',
    '',
    ...(headings.length > 0 ? headings.map(line => `- Heading: ${line}`) : ['- No markdown headings were extracted from the imported document.']),
    ...(previewLines.length > 0 ? previewLines.map(line => `- ${line}`) : ['- No preview lines were extracted from the imported document.']),
    '',
    '## Source Links',
    '',
    `- ${args.url}`,
    '',
    '## Related Artifacts',
    '',
    `- Imported Workspace File: [${args.importedName}](${args.importedWorkspacePath})`,
    `- Canonical Share Markdown: [${args.exportToken}.md](${args.exportMarkdownPath})`,
    '',
    '## Finalization',
    '',
    'Now I can write the final answer.',
    '',
  ].join('\n')
}

export const persistImportedShareUrlArtifacts = async (args: {
  fs: WorkspaceFs
  url: string
  importedName: string
  importedText: string
  importedWorkspacePath: string
  rootFolderPath?: string
}): Promise<null | {
  exportToken: string
  exportFolderPath: string
  exportMarkdownPath: string
  exportThinkingPath: string
}> => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  const {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  } = resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
  })
  const importedText = String(args.importedText || '').trimEnd() + '\n'
  const importedWorkspacePath = normalizeWorkspacePath(args.importedWorkspacePath)
  const thinkingText = buildImportedShareThinkingDocument({
    url,
    importedName: args.importedName,
    importedText,
    importedWorkspacePath: args.importedWorkspacePath,
    exportToken,
    exportMarkdownPath,
    exportThinkingPath,
  })
  if (importedWorkspacePath !== exportMarkdownPath) {
    await writeWorkspaceFileTextEnsuringFile({
      fs: args.fs,
      path: exportMarkdownPath,
      text: importedText,
    })
  }
  await writeWorkspaceFileTextEnsuringFile({
    fs: args.fs,
    path: exportThinkingPath,
    text: thinkingText,
  })
  await ensureChatWorkspaceMirrorFolder(exportFolderPath)
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportMarkdownPath,
    text: importedText,
  })
  await mirrorChatWorkspaceFileToHost({
    workspacePath: exportThinkingPath,
    text: thinkingText,
  })
  return {
    exportToken,
    exportFolderPath,
    exportMarkdownPath,
    exportThinkingPath,
  }
}

export const resolveImportedShareUrlPrimaryWorkspacePath = (args: {
  url: string
  importedName: string
  rootFolderPath?: string
}): string | null => {
  const url = String(args.url || '').trim()
  if (!isShareUrlArtifactEligible(url)) return null
  const rootFolderPath = String(args.rootFolderPath || '').trim() || readWorkspaceImportShareExportRootPathSetting()
  return resolveShareUrlArtifactPaths({
    rootFolderPath,
    url,
    importedName: args.importedName,
  }).exportMarkdownPath
}
