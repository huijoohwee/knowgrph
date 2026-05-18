import type { CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { readCanvasWorkspacePresetSwitchContext } from './workspaceSwitchPreset'

export type MarkdownWorkspaceFrontmatterLanding = {
  shouldApply: boolean
  preset: CanvasWorkspaceFrontmatterPreset | null
}

export function resolveMarkdownWorkspaceFrontmatterLanding(args: {
  activeDocumentKey: string
  nextText: string
  maxChars: number
  alreadyIndexedForTextHash: boolean
  currentMarkdownDocumentName?: string | null
  currentMarkdownDocumentText?: string | null
}): MarkdownWorkspaceFrontmatterLanding {
  const activeDocumentKey = String(args.activeDocumentKey || '').trim()
  const nextText = String(args.nextText || '')
  if (!activeDocumentKey || !nextText.trim() || nextText.length > args.maxChars) {
    return { shouldApply: false, preset: null }
  }
  const presetContext = readCanvasWorkspacePresetSwitchContext(nextText)
  if (!presetContext) return { shouldApply: false, preset: null }
  const currentDocumentMatches =
    String(args.currentMarkdownDocumentName || '').trim() === activeDocumentKey &&
    String(args.currentMarkdownDocumentText || '') === nextText
  if (args.alreadyIndexedForTextHash && currentDocumentMatches) {
    return { shouldApply: false, preset: presetContext.preset }
  }
  return { shouldApply: true, preset: presetContext.preset }
}
