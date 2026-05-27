import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  ensureWorkspaceChatMirrorFolder,
  upsertWorkspaceChatMirrorText,
} from '@/features/workspace-fs/workspaceSeedProvider'

export const ensureChatWorkspaceMirrorFolder = async (workspacePath: string): Promise<boolean> => {
  const normalizedPath = normalizeWorkspacePath(String(workspacePath || '').trim())
  if (!normalizedPath || normalizedPath === '/') return false
  try {
    return await ensureWorkspaceChatMirrorFolder({ workspacePath: normalizedPath })
  } catch {
    return false
  }
}

export const mirrorChatWorkspaceFileToHost = async (args: {
  workspacePath: string
  text: string
}): Promise<boolean> => {
  const normalizedPath = normalizeWorkspacePath(String(args.workspacePath || '').trim())
  if (!normalizedPath || normalizedPath === '/') return false
  try {
    return await upsertWorkspaceChatMirrorText({
      workspacePath: normalizedPath,
      text: String(args.text ?? ''),
    })
  } catch {
    return false
  }
}
