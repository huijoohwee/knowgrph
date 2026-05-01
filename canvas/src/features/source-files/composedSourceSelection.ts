import type { GraphState } from '@/hooks/store/types'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

type ComposedSourceSelectionState = Pick<GraphState, 'sourceFiles' | 'markdownDocumentName'>

export function normalizeComposedSourcePath(raw: unknown): string {
  const text = String(raw || '').trim().replace(/\\/g, '/')
  if (!text) return ''
  const withoutWorkspacePrefix = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)
  return normalized === '/' ? '' : normalized
}

export function resolvePreferredComposedActivePath(args: {
  markdownDocumentName?: unknown
  explorerActivePath?: unknown
  fallbackName?: unknown
}): string {
  return (
    normalizeComposedSourcePath(args.markdownDocumentName) ||
    normalizeComposedSourcePath(args.explorerActivePath) ||
    normalizeComposedSourcePath(args.fallbackName)
  )
}

export function resolvePreferredComposedDocumentPathFromState(args: {
  state: Pick<GraphState, 'markdownDocumentName'>
  explorerActivePath?: unknown
  fallbackName?: unknown
}): string {
  return resolvePreferredComposedActivePath({
    markdownDocumentName: args.state.markdownDocumentName,
    explorerActivePath: args.explorerActivePath,
    fallbackName: args.fallbackName,
  })
}

export function readComposedSourceFilePath(file: GraphState['sourceFiles'][number] | null | undefined): string {
  return normalizeComposedSourcePath(file?.source?.path || file?.name || '')
}

export function findComposedSourceFileByPath(args: {
  sourceFiles: GraphState['sourceFiles']
  targetPath?: unknown
  enabledOnly?: boolean
}): GraphState['sourceFiles'][number] | null {
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const targetPath = normalizeComposedSourcePath(args.targetPath)
  if (!targetPath) return null
  return (
    sourceFiles.find(file => {
      if (args.enabledOnly && !file?.enabled) return false
      const sourcePath = readComposedSourceFilePath(file)
      return !!sourcePath && sourcePath === targetPath
    }) || null
  )
}

export function resolvePreferredComposedSourceFile(args: {
  sourceFiles: GraphState['sourceFiles']
  markdownDocumentName?: unknown
  explorerActivePath?: unknown
  fallbackName?: unknown
  enabledOnly?: boolean
}): GraphState['sourceFiles'][number] | null {
  const targetPath = resolvePreferredComposedActivePath({
    markdownDocumentName: args.markdownDocumentName,
    explorerActivePath: args.explorerActivePath,
    fallbackName: args.fallbackName,
  })
  const exact = findComposedSourceFileByPath({
    sourceFiles: args.sourceFiles,
    targetPath,
    enabledOnly: args.enabledOnly,
  })
  if (exact) return exact
  const fallbackName = String(args.fallbackName || '').trim()
  if (!fallbackName) return null
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  return (
    sourceFiles.find(file => {
      if (args.enabledOnly && !file?.enabled) return false
      return String(file?.name || '').trim() === fallbackName
    }) || null
  )
}

export function resolvePreferredComposedSourceFileFromState(args: {
  state: ComposedSourceSelectionState
  explorerActivePath?: unknown
  fallbackName?: unknown
  enabledOnly?: boolean
}): GraphState['sourceFiles'][number] | null {
  return resolvePreferredComposedSourceFile({
    sourceFiles: args.state.sourceFiles,
    markdownDocumentName: args.state.markdownDocumentName,
    explorerActivePath: args.explorerActivePath,
    fallbackName: args.fallbackName,
    enabledOnly: args.enabledOnly,
  })
}

export function resolvePreferredEnabledComposedSourceFile(args: {
  sourceFiles: GraphState['sourceFiles']
  markdownDocumentName?: unknown
  explorerActivePath?: unknown
  fallbackName?: unknown
}): GraphState['sourceFiles'][number] | null {
  return resolvePreferredComposedSourceFile({
    ...args,
    enabledOnly: true,
  })
}

export function resolvePreferredEnabledComposedSourceFileFromState(args: {
  state: ComposedSourceSelectionState
  explorerActivePath?: unknown
  fallbackName?: unknown
}): GraphState['sourceFiles'][number] | null {
  return resolvePreferredComposedSourceFileFromState({
    ...args,
    enabledOnly: true,
  })
}

export function resolvePreferredComposedSourceRawText(args: {
  sourceFiles: GraphState['sourceFiles']
  markdownDocumentName?: unknown
  explorerActivePath?: unknown
  fallbackName?: unknown
}): string {
  const activeSourceFile = resolvePreferredEnabledComposedSourceFile(args)
  if (activeSourceFile && String(activeSourceFile.text || '').trim()) {
    return String(activeSourceFile.text || '')
  }
  const sourceFiles = Array.isArray(args.sourceFiles) ? args.sourceFiles : []
  const firstEnabledSeed = sourceFiles.find(file => file?.enabled && String(file.text || '').trim())
  return firstEnabledSeed ? String(firstEnabledSeed.text || '') : ''
}

export function resolvePreferredComposedSourceRawTextFromState(args: {
  state: ComposedSourceSelectionState
  explorerActivePath?: unknown
  fallbackName?: unknown
}): string {
  return resolvePreferredComposedSourceRawText({
    sourceFiles: args.state.sourceFiles,
    markdownDocumentName: args.state.markdownDocumentName,
    explorerActivePath: args.explorerActivePath,
    fallbackName: args.fallbackName,
  })
}
