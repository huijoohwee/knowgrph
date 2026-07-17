import {
  findComposedSourceFileByPath,
  normalizeComposedSourcePath,
} from '@/features/source-files/composedSourceSelection'
import type { GraphState } from '@/hooks/store/types'

export type StoryboardCardMediaGraphSourceOwner = {
  documentName?: string | null
  documentText?: string | null
}

export function resolveStoryboardCardMediaGraphSourceOwner(args: {
  state: GraphState
  sourceOwner?: StoryboardCardMediaGraphSourceOwner
}): { state: GraphState; ownerPath: string } {
  const activePath = normalizeComposedSourcePath(args.state.markdownDocumentName)
  const requestedPath = normalizeComposedSourcePath(args.sourceOwner?.documentName)
  const ownerPath = requestedPath || activePath
  if (!requestedPath || requestedPath === activePath) return { state: args.state, ownerPath }

  const ownerFile = findComposedSourceFileByPath({
    sourceFiles: args.state.sourceFiles || [],
    targetPath: ownerPath,
  })
  const indexedOwnerText = String(ownerFile?.text || '')
  const capturedOwnerText = String(args.sourceOwner?.documentText || '')
  return {
    ownerPath,
    state: {
      ...args.state,
      markdownDocumentName: ownerPath,
      markdownDocumentText: indexedOwnerText || capturedOwnerText,
    },
  }
}

export function shouldUpdateStoryboardCardMediaGraphActiveDocument(args: {
  currentDocumentName?: string | null
  ownerPath: string
}): boolean {
  const ownerPath = normalizeComposedSourcePath(args.ownerPath)
  if (!ownerPath) return true
  return normalizeComposedSourcePath(args.currentDocumentName) === ownerPath
}
