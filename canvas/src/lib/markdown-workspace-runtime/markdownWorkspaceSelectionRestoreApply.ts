import type { applyActiveMarkdownDocumentPayload } from '@/features/markdown/activeMarkdownDocument'
import { buildMarkdownWorkspaceRestoredActiveDocumentArgs } from './markdownWorkspaceActiveDocumentRestore'

export function resolveMarkdownWorkspaceSelectionRestoreApply(args: {
  text: string
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
}): {
  text: string
  restoredActiveDocumentArgs: Omit<Parameters<typeof applyActiveMarkdownDocumentPayload>[0], 'setActiveMarkdownDocument'> | null
} {
  return {
    text: args.text,
    restoredActiveDocumentArgs: buildMarkdownWorkspaceRestoredActiveDocumentArgs({
      activeDocumentKey: args.activeDocumentKey,
      text: args.text,
      activeDocumentSourceUrl: args.activeDocumentSourceUrl,
    }),
  }
}
