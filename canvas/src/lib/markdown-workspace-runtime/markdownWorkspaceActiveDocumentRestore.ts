import type { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'

export function buildMarkdownWorkspaceRestoredActiveDocumentArgs(args: {
  activeDocumentKey: string
  text: string
  activeDocumentSourceUrl: string | null
}): Omit<Parameters<typeof applyActiveMarkdownDocumentPayload>[0], 'setActiveMarkdownDocument'> | null {
  const name = String(args.activeDocumentKey || '').trim()
  if (!name) return null
  return {
    name,
    text: args.text,
    sourceUrl: args.activeDocumentSourceUrl,
    autoEnableFrontmatter: false,
    applyViewPreset: false,
    normalizeWebpageFrontmatterToMarkdown: true,
  }
}
