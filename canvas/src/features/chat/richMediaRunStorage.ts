import type { GraphNode } from '@/lib/graph/types'
import type { GeneratedBinaryAsset } from './byteplusRunGeneration'
import type { RichMediaWidgetKind } from './richMediaRun'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import type { UploadGeneratedWorkspaceBlobToKnowgrphStorageResult } from '@/features/source-files/sourceFilesBinaryStorage'

const cleanString = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

const readWorkspacePathName = (workspacePath: string): string => {
  const parts = String(workspacePath || '').split('/').filter(Boolean)
  return cleanString(parts[parts.length - 1]) || 'generated-media-output.md'
}

const readWorkspacePathParent = (workspacePath: string): string => {
  const parts = String(workspacePath || '').split('/').filter(Boolean)
  const parent = parts.slice(0, -1).join('/')
  return parent ? `/${parent}` : '/'
}

export const uploadRichMediaBinaryToStorage = async (args: {
  outputPath: string
  blob: Blob
}): Promise<UploadGeneratedWorkspaceBlobToKnowgrphStorageResult | null> => {
  try {
    const { uploadGeneratedWorkspaceBlobToKnowgrphStorage } = await import('@/features/source-files/sourceFilesBinaryStorage')
    return await uploadGeneratedWorkspaceBlobToKnowgrphStorage({
      workspacePath: args.outputPath,
      blob: args.blob,
    })
  } catch {
    return null
  }
}

export const publishGeneratedTextToStorage = async (args: {
  outputPath: string
  text: string
}): Promise<void> => {
  try {
    const { publishGeneratedWorkspaceEntriesToKnowgrphStorage } = await import('@/features/source-files/sourceFileShareUrl')
    const entry: WorkspaceEntry = {
      kind: 'file',
      path: args.outputPath,
      parentPath: readWorkspacePathParent(args.outputPath),
      name: readWorkspacePathName(args.outputPath),
      text: args.text,
      updatedAtMs: Date.now(),
    }
    await publishGeneratedWorkspaceEntriesToKnowgrphStorage({ entries: [entry] })
  } catch {
    void 0
  }
}

const escapeMarkdownTableCell = (value: unknown): string => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\|/g, '\\|')
  .replace(/\n+/g, '<br>')
  .trim()

const escapeMarkdownAltText = (value: unknown): string => String(value ?? '')
  .replace(/[\[\]\n\r]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildGeneratedMediaManifestMarkdown = (args: {
  node: GraphNode
  kind: RichMediaWidgetKind
  outputPath: string
  asset: GeneratedBinaryAsset
  storage?: UploadGeneratedWorkspaceBlobToKnowgrphStorageResult | null
  manifestMetadata?: ReadonlyArray<readonly [string, unknown]>
}): string => {
  const title = cleanString(args.node.label) || cleanString(args.node.id) || `${args.kind} output`
  const savedName = args.outputPath.split('/').filter(Boolean).pop() || args.outputPath
  const relativeAssetPath = savedName ? `./${savedName}` : args.outputPath
  const mimeType = cleanString(args.asset.blob.type) || (args.kind === 'video' ? 'video/mp4' : args.kind === 'annotation' ? 'application/json' : 'image/png')
  const rawRows: Array<[string, unknown]> = [
    ['kind', args.kind],
    ['artifactPath', relativeAssetPath],
    ['mimeType', mimeType],
    ['model', cleanString(args.asset.model)],
    ['sourceUrl', cleanString(args.asset.sourceUrl)],
    ['storageUrl', cleanString(args.storage?.publicUrl)],
    ['storageCanonicalPath', cleanString(args.storage?.canonicalPath)],
    ['r2ObjectKey', cleanString(args.storage?.objectKey)],
    ['contentHash', cleanString(args.storage?.contentHash)],
    ['sizeBytes', args.storage?.sizeBytes == null ? '' : String(args.storage.sizeBytes)],
    ['etag', cleanString(args.storage?.etag)],
    ...(Array.isArray(args.manifestMetadata) ? args.manifestMetadata : []),
  ]
  const rows = rawRows.filter(([, value]) => cleanString(value))
  const dataTable = rows.length
    ? ['| key | value |', '| --- | --- |', ...rows.map(([key, value]) => `| ${escapeMarkdownTableCell(key)} | ${escapeMarkdownTableCell(value)} |`)].join('\n')
    : ''
  const mediaBlock = args.kind === 'video'
    ? `<video controls src="${relativeAssetPath}"></video>`
    : args.kind === 'annotation'
      ? `[${escapeMarkdownAltText(title)} annotation JSON](${relativeAssetPath})`
      : `![${escapeMarkdownAltText(title)}](${relativeAssetPath})`
  return [
    `# ${title} ${args.kind === 'video' ? 'Video' : args.kind === 'annotation' ? 'Annotation' : 'Image'} Output`,
    dataTable,
    mediaBlock,
  ].filter(section => String(section || '').trim()).join('\n\n')
}
