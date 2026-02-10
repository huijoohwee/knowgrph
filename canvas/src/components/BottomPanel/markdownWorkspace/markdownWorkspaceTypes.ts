export type HighlightedLineRange = { start: number; end: number } | null

export type MarkdownPresentationApi = {
  prev: () => void
  next: () => void
}

export type MarkdownWorkspaceStatus =
  | {
      kind: 'progress'
      label: string
      current?: number | null
      total?: number | null
      bytesCurrent?: number | null
      bytesTotal?: number | null
    }
  | { kind: 'info'; label: string }
  | { kind: 'error'; label: string }
  | null
