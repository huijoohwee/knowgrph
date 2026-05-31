const CARD_MARKDOWN_STRUCTURAL_PATTERN = /(^|\n)\s*(?:>+|```)|!\[[^\]]*]\([^)]+?\)|(?<!!)\[[^\]]+]\([^)]+?\)|(^|[^\\])\$[^$\n]+\$|<\s*(?:iframe|img|video)\b/i

export function hasCardMarkdownPreviewSyntax(raw: string): boolean {
  return CARD_MARKDOWN_STRUCTURAL_PATTERN.test(String(raw || ''))
}
