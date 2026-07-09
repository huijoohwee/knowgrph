import { analyzeKgcRequest, isAttachedImageQuestionTerm } from './chatKgcRequestProfile'
import { buildBody, buildResponseOnlyBody } from './chatHistoryWorkspace.kgc.bodyFallback'
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
import { hasRecognizedChatRuntimeInvocation } from './chatRuntimeInvocationProfile'
import { resolveChatRuntimeInvocationQuery } from './chatRuntimeInvocationQuery'

const hasRequestedSections = (profile: ReturnType<typeof analyzeKgcRequest>): boolean =>
  Object.values(profile.requestedSections).some(Boolean)

const shouldUseResponseOnlyBaseTemplate = (args: {
  profile: ReturnType<typeof analyzeKgcRequest>
  requestText: string
  assistantText: string
}): boolean => {
  const profile = args.profile
  if (!hasRecognizedChatRuntimeInvocation(args.requestText)) return true
  const runtimeQuery = resolveChatRuntimeInvocationQuery(args.requestText)
  if (runtimeQuery.leadingRoute) {
    return isAttachedImageQuestionTerm(profile.intent)
  }
  if (profile.signals.computingFlow || shouldMaterializeHeadlessResponseSurface(profile)) return false
  if (hasRequestedSections(profile)) return false
  return !profile.product &&
    !profile.domain &&
    !profile.subject &&
    !profile.artifact &&
    profile.topics.length === 0 &&
    profile.namedTerms.length === 0
}

const projectResponseOnlyProfile = (
  profile: ReturnType<typeof analyzeKgcRequest>,
  assistantText: string,
): ReturnType<typeof analyzeKgcRequest> => {
  if (isTraceOnlyAssistantText(assistantText)) {
    return {
      ...profile,
      invocation: null,
      product: '',
      artifact: '',
      objective: profile.intent,
      namedTerms: [],
    }
  }
  if (!profile.invocation || !isAttachedImageQuestionTerm(profile.intent)) return profile
  return {
    ...profile,
    invocation: null,
    artifact: '',
    objective: profile.intent,
  }
}

export const buildDeterministicBaseTemplateKgcTurn = (args: BaseFallbackArgs): string => {
  void args.timestampMs
  const profile = analyzeKgcRequest(args.requestText)
  const assistantText = String(args.assistantText || '')
  const responseSurface = extractChatResponseStructuredSurface(assistantText)
  const responseOnly = responseSurface
    ? false
    : shouldUseResponseOnlyBaseTemplate({ profile, requestText: args.requestText, assistantText })
  const outputProfile = responseOnly ? projectResponseOnlyProfile(profile, assistantText) : profile
  const useComputingFlowResponse = (
    outputProfile.signals.computingFlow ||
    (!responseOnly && !responseSurface && !shouldMaterializeHeadlessResponseSurface(outputProfile) && (
      hasCompleteAssistantMarkdownAnswer(assistantText)
    ))
  )
  if (useComputingFlowResponse) {
    return buildDeterministicComputingFlowKgcTurn(args)
  }
  const projectedResponseSurface = responseSurface || buildHeadlessResponseSurface({ profile: outputProfile, assistantText })
  const fileName = String(args.fileName || '').trim() || 'kgc.md'
  const frontmatter = projectChatResponseStructuredSurfaceIntoKgcFrontmatter({
    frontmatter: buildFrontmatter({ fileName, profile: outputProfile, assistantText, responseOnly }),
    surface: projectedResponseSurface,
  })
  const body = responseOnly
    ? buildResponseOnlyBody({ assistantText, profile: outputProfile })
    : buildBody({
        requestText: args.requestText,
        assistantText,
        profile: outputProfile,
        fileName,
        responseSurfaceBlock: buildChatResponseStructuredSurfaceBlock(projectedResponseSurface),
      })
  return ['---', frontmatter, '---', body].join('\n').trimEnd() + '\n'
}
