import type { WorkspacePath } from '@/features/workspace-fs/types'
import { workspaceExtLower } from '@/features/workspace-fs/path'

export const SIDEBAR_MIN_PX = 220
export const SIDEBAR_MAX_PX = 520

export function languageForPath(path: WorkspacePath): string {
  const ext = workspaceExtLower(path)
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown'
  if (ext === 'json' || ext === 'jsonld' || ext === 'geojson') return 'json'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'svg') return 'html'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  if (ext === 'csv') return 'csv'
  return 'plaintext'
}

export function isMarkdownPath(path: WorkspacePath | null): boolean {
  if (!path) return false
  const ext = workspaceExtLower(path)
  return ext === 'md' || ext === 'markdown' || ext === 'mdx' || ext === 'mmd'
}
