import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import type { VideoDownloadResultOk } from './types'

export type RegisterVideoDownloadResult =
  | { ok: true; workspacePath: WorkspacePath }
  | { ok: false; error: string }

function buildDownloadDocumentText(result: VideoDownloadResultOk): string {
  const fileUrl = String(result.fileUrl || '').trim()
  return [
    '---',
    `kgVideoDownloadFileName: ${JSON.stringify(result.fileName)}`,
    `kgVideoDownloadFilePath: ${JSON.stringify(result.filePath)}`,
    ...(fileUrl ? [`kgVideoDownloadFileUrl: ${JSON.stringify(fileUrl)}`] : []),
    `kgVideoDownloadMimeType: ${JSON.stringify(result.mimeType)}`,
    `kgVideoDownloadSizeBytes: ${result.sizeBytes}`,
    `kgVideoDownloadSourceUrl: ${JSON.stringify(result.sourceUrl)}`,
    '---',
    '',
    `# ${result.fileName}`,
    '',
    ...(fileUrl ? [`![video](${fileUrl})`, '', `[Open local video](${fileUrl})`, ''] : []),
    `File name: ${result.fileName}`,
    `File path: ${result.filePath}`,
    ...(fileUrl ? [`File URL: ${fileUrl}`] : []),
    `MIME type: ${result.mimeType}`,
    `Size bytes: ${result.sizeBytes}`,
    `Source URL: ${result.sourceUrl}`,
  ].join('\n')
}

export async function registerVideoDownloadInWorkspace(args: {
  result: VideoDownloadResultOk
  fs?: WorkspaceFs
}): Promise<RegisterVideoDownloadResult> {
  try {
    const [
      { getWorkspaceFs },
      { WORKSPACE_ROOT_PATH },
      { setWorkspaceEntrySource },
      { notifyWorkspaceFsChanged },
      { upsertWorkspaceTextDocument },
    ] = await Promise.all([
      import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
      import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
      import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
      import('@/features/workspace-fs/upsertWorkspaceTextDocument') as Promise<typeof import('@/features/workspace-fs/upsertWorkspaceTextDocument')>,
    ])
    const fs = args.fs || await getWorkspaceFs()
    const workspacePath = await upsertWorkspaceTextDocument({
      fs,
      parentPath: WORKSPACE_ROOT_PATH,
      name: `${args.result.fileName}.md`,
      text: buildDownloadDocumentText(args.result),
    })
    setWorkspaceEntrySource(workspacePath, { kind: 'url', url: args.result.sourceUrl })
    notifyWorkspaceFsChanged({ op: 'writeFileText', path: workspacePath })
    return { ok: true, workspacePath }
  } catch (error) {
    return { ok: false, error: String((error as { message?: unknown })?.message ?? error) }
  }
}
