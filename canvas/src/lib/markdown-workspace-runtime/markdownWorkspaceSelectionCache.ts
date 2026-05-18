import type { WorkspacePath } from '@/features/workspace-fs/types'
import { isInitializationWorkspacePath } from '@/features/workspace-fs/workspaceFs'

export function shouldTrustEmptyWorkspaceSelectionCache(args: {
  cachedText: string | null
  path: WorkspacePath
  lastLoaded: { path: WorkspacePath; text: string } | null
}): boolean {
  if (args.cachedText !== '') return false
  const lastLoaded = args.lastLoaded
  if (!lastLoaded || lastLoaded.path !== args.path || lastLoaded.text !== '') return false
  // Initialization docs can be chunk-only in storage; never lock in blank cache for them.
  if (isInitializationWorkspacePath(args.path)) return false
  return true
}
