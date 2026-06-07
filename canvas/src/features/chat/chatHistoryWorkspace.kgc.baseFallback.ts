import { analyzeKgcRequest } from './chatKgcRequestProfile'
import { buildBody } from './chatHistoryWorkspace.kgc.bodyFallback'
import { buildDeterministicComputingFlowKgcTurn } from './chatHistoryWorkspace.kgc.computingFlowFallback'
import type { BaseFallbackArgs } from './chatHistoryWorkspace.kgc.fallbackCommon'
import { buildFrontmatter } from './chatHistoryWorkspace.kgc.frontmatterFallback'
import { buildChatResponseStructuredSurfaceBlock } from './chatHistoryWorkspace.kgc.structuredSurfaceBlock'
import {
  buildHeadlessResponseSurface,
  hasCompleteAssistantMarkdownAnswer,
  isTraceOnlyAssistantText,
  shouldMaterializeHeadlessResponseSurface,
} from './chatHistoryWorkspace.kgc.responseProjection'
import {
  extractChatResponseStructuredSurface,
  projectChatResponseStructuredSurfaceIntoKgcFrontmatter,
} from './chatResponseStructuredContent'

export const buildDeterministicBaseTemplateKgcTurn = (args: BaseFallbackArgs): string => {
  void args.timestampMs
  const profile = analyzeKgcRequest(args.requestText)
  const assistantText = String(args.assistantText || '')
  const responseSurface = extractChatResponseStructuredSurface(assistantText)
  const useComputingFlowResponse = (
    profile.signals.computingFlow ||
    (!responseSurface && !shouldMaterializeHeadlessResponseSurface(profile) && (
      hasCompleteAssistantMarkdownAnswer(assistantText) ||
      isTraceOnlyAssistantText(assistantText)
    ))
  )
  if (useComputingFlowResponse) {
    return buildDeterministicComputingFlowKgcTurn(args)
  }
  const projectedResponseSurface = responseSurface || buildHeadlessResponseSurface({ profile, assistantText })
  const fileName = String(args.fileName || '').trim() || 'kgc.md'
  const frontmatter = projectChatResponseStructuredSurfaceIntoKgcFrontmatter({
    frontmatter: buildFrontmatter({ fileName, profile, assistantText }),
    surface: projectedResponseSurface,
  })
  const body = buildBody({
    requestText: args.requestText,
    assistantText,
    profile,
    fileName,
    responseSurfaceBlock: buildChatResponseStructuredSurfaceBlock(projectedResponseSurface),
  })
  return ['---', frontmatter, '---', body].join('\n').trimEnd() + '\n'
}
