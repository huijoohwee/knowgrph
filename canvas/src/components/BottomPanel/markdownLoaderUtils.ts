export function normalizeMarkdownDocumentKey(input: string): string {
  const trimmed = String(input || '').trim()
  if (!trimmed) return ''
  const base = trimmed.split('#')[0]?.trim() || ''
  if (!base) return ''
  const last = base.split(/[/\\]/).filter(Boolean).pop() || ''
  return String(last).trim()
}

export function shouldPreferImportedMarkdown(args: {
  activeDocumentPath: string
  importedMarkdownText: string
  markdownDocumentName: string
}): boolean {
  const importedText = String(args.importedMarkdownText || '')
  if (!importedText.trim()) return false
  const importedName = String(args.markdownDocumentName || '').trim()
  if (!importedName) return false
  const basePath = String(args.activeDocumentPath || '').split('#')[0]?.trim() || ''
  if (!basePath) return false
  if (basePath === importedName) return true
  const baseKey = normalizeMarkdownDocumentKey(basePath)
  const nameKey = normalizeMarkdownDocumentKey(importedName)
  return !!(baseKey && nameKey && baseKey === nameKey)
}

