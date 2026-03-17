export type MarkdownWorkspaceLayoutMode = 'split' | 'editor' | 'viewer' | 'presentation' | 'slides-gallery'

export function parseMarkdownWorkspaceLayoutMode(value: unknown): MarkdownWorkspaceLayoutMode {
  if (value === 'split') return 'split'
  if (value === 'editor') return 'editor'
  if (value === 'viewer') return 'viewer'
  if (value === 'presentation') return 'presentation'
  if (value === 'slides-gallery') return 'slides-gallery'
  return 'viewer'
}
