export type HighlightedLineRange = { start: number; end: number } | null

export type MarkdownPresentationApi = {
  prev: () => void
  next: () => void
}

