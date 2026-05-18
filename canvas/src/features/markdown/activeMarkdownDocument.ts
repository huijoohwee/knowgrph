import type { RecentFileEntry } from '@/hooks/store/types'
import { normalizeWebpageFrontmatterView, type CanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

export type ActiveMarkdownDocumentPayload = {
  name: string
  text: string
  normalizeMermaidMmd: false
  sourceUrl?: string | null
  jsonSourceText?: string | null
  autoEnableFrontmatter?: boolean
  applyViewPreset?: boolean
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'> | null
  applyToGraph?: boolean
  forceApplyToGraph?: boolean
  canvasWorkspacePreset?: CanvasWorkspaceFrontmatterPreset | null
}

export function buildActiveMarkdownDocumentPayload(args: {
  name: string
  text: string
  sourceUrl?: string | null
  jsonSourceText?: string | null
  autoEnableFrontmatter?: boolean
  applyViewPreset?: boolean
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'> | null
  applyToGraph?: boolean
  forceApplyToGraph?: boolean
  canvasWorkspacePreset?: CanvasWorkspaceFrontmatterPreset | null
  normalizeWebpageFrontmatterToMarkdown?: boolean
}): ActiveMarkdownDocumentPayload {
  const name = String(args.name || '').trim()
  const rawText = String(args.text || '')
  const text = args.normalizeWebpageFrontmatterToMarkdown
    ? normalizeWebpageFrontmatterView(rawText, 'markdown')
    : rawText

  return {
    name,
    text,
    normalizeMermaidMmd: false,
    ...(args.sourceUrl === null || typeof args.sourceUrl === 'string' ? { sourceUrl: args.sourceUrl ?? null } : {}),
    ...(args.jsonSourceText === null || typeof args.jsonSourceText === 'string' ? { jsonSourceText: args.jsonSourceText ?? null } : {}),
    ...(typeof args.autoEnableFrontmatter === 'boolean' ? { autoEnableFrontmatter: args.autoEnableFrontmatter } : {}),
    ...(typeof args.applyViewPreset === 'boolean' ? { applyViewPreset: args.applyViewPreset } : {}),
    ...(args.recent ? { recent: args.recent } : {}),
    ...(typeof args.applyToGraph === 'boolean' ? { applyToGraph: args.applyToGraph } : {}),
    ...(typeof args.forceApplyToGraph === 'boolean' ? { forceApplyToGraph: args.forceApplyToGraph } : {}),
    ...(args.canvasWorkspacePreset !== undefined ? { canvasWorkspacePreset: args.canvasWorkspacePreset } : {}),
  }
}

export function applyActiveMarkdownDocumentPayload(args: {
  setActiveMarkdownDocument: (payload: ActiveMarkdownDocumentPayload) => Promise<boolean>
  name: string
  text: string
  sourceUrl?: string | null
  jsonSourceText?: string | null
  autoEnableFrontmatter?: boolean
  applyViewPreset?: boolean
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'> | null
  applyToGraph?: boolean
  forceApplyToGraph?: boolean
  canvasWorkspacePreset?: CanvasWorkspaceFrontmatterPreset | null
  normalizeWebpageFrontmatterToMarkdown?: boolean
}): Promise<boolean> | null {
  const payload = buildActiveMarkdownDocumentPayload(args)
  if (!payload.name) return null
  return args.setActiveMarkdownDocument(payload)
}
