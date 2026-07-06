import React from 'react'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { SourceFile } from '@/hooks/store/types'
import { resolveWorkspaceContextCacheStatus } from '../chatPromptHelpers'
import {
  buildFloatingPanelChatSourceFilesSignature,
  buildFloatingPanelChatWorkspaceContextCacheKey,
  countEnabledChatSourceFiles,
  createFloatingPanelChatContextItems,
  createFloatingPanelChatPipelineStages,
  createFloatingPanelChatQuickActions,
  resolveChatWorkspaceLabel,
} from './floatingPanelChatSurfaceState'

type SurfaceModelArgs = {
  chatContextScope: string
  markdownDocumentName: string | null
  markdownText: string | null
  docLocationRevision: unknown
  sourceFiles: SourceFile[]
  graphData: GraphData | null
  workspaceViewMode: 'canvas' | 'editor'
  chatKnowgrphWorkspacePath: string | null
  chatHistoryWorkspacePath: string | null
  currentNode: GraphNode | null
  messageCount: number
  isLoading: boolean
  setInput: React.Dispatch<React.SetStateAction<string>>
}

export const useFloatingPanelChatSurfaceModel = (args: SurfaceModelArgs) => {
  const sourceFilesSignature = React.useMemo(
    () => buildFloatingPanelChatSourceFilesSignature(args.sourceFiles),
    [args.sourceFiles],
  )
  const workspaceContextCacheKey = React.useMemo(() => buildFloatingPanelChatWorkspaceContextCacheKey({
    chatContextScope: args.chatContextScope,
    markdownDocumentName: args.markdownDocumentName,
    docLocationRevision: args.docLocationRevision,
    markdownText: args.markdownText,
    sourceFilesSignature,
  }), [args.chatContextScope, args.docLocationRevision, args.markdownDocumentName, args.markdownText, sourceFilesSignature])
  const activeWorkspaceLabel = React.useMemo(() => resolveChatWorkspaceLabel({
    markdownDocumentName: args.markdownDocumentName,
    chatKnowgrphWorkspacePath: args.chatKnowgrphWorkspacePath,
    chatHistoryWorkspacePath: args.chatHistoryWorkspacePath,
  }), [args.chatHistoryWorkspacePath, args.chatKnowgrphWorkspacePath, args.markdownDocumentName])
  const workspaceContextCacheStatus = React.useMemo(
    () => resolveWorkspaceContextCacheStatus(workspaceContextCacheKey),
    [args.isLoading, args.messageCount, workspaceContextCacheKey],
  )
  const contextItems = React.useMemo(() => createFloatingPanelChatContextItems({
    chatContextScope: args.chatContextScope,
    enabledSourceFileCount: countEnabledChatSourceFiles(args.sourceFiles),
    activeWorkspaceLabel,
    currentNode: args.currentNode,
    messageCount: args.messageCount,
    workspaceContextCacheStatus,
  }), [activeWorkspaceLabel, args.chatContextScope, args.currentNode, args.messageCount, args.sourceFiles, workspaceContextCacheStatus])
  const quickActions = React.useMemo(
    () => createFloatingPanelChatQuickActions({ activeWorkspaceLabel, currentNode: args.currentNode }),
    [activeWorkspaceLabel, args.currentNode],
  )
  const pipelineStages = React.useMemo(() => createFloatingPanelChatPipelineStages({
    sourceFiles: args.sourceFiles,
    graphData: args.graphData,
    workspaceViewMode: args.workspaceViewMode,
  }), [args.graphData, args.sourceFiles, args.workspaceViewMode])
  const appendPrompt = React.useCallback((prompt: string) => {
    const text = String(prompt || '')
    if (!text) return
    args.setInput(previous => {
      const current = String(previous || '')
      if (!current.trim()) return text
      return `${current}${current.endsWith('\n') ? '\n' : '\n\n'}${text}`
    })
  }, [args.setInput])

  return { appendPrompt, contextItems, pipelineStages, quickActions, workspaceContextCacheKey }
}
