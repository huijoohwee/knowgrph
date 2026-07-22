import {
  extractProbeTreeClarificationContextText,
  extractProbeTreeUserInputText,
} from '@/features/agent-ready/probeTreeUserInputRelevance.mjs'
import { sanitizeRuntimeInvocationQueryText } from '@/features/chat/chatRuntimeInvocationQuery'

type JsonRecord = Record<string, unknown>

const readRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
)

const readText = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const stripProviderRoutingTokens = (value: unknown): string => (
  sanitizeRuntimeInvocationQueryText(value, 8_000)
    .replace(/(^|\s)[/#@][A-Za-z0-9_.-]+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
)

const readSelectionOptions = (value: unknown): string[] => (
  (Array.isArray(value) ? value : [])
    .map(option => {
      const record = readRecord(option)
      return readText(record.label || record.text || option)
    })
    .filter(Boolean)
    .slice(0, 4)
)

const projectProviderCard = (value: unknown): JsonRecord | null => {
  const card = readRecord(value)
  const question = readText(card.question || card.text || card.label)
  const selectionOptions = readSelectionOptions(card.selectionOptions)
  if (!question || selectionOptions.length < 2) return null
  return {
    question,
    rationale: readText(card.rationale),
    evidenceNeeded: readText(card.evidenceNeeded || card.evidence_needed),
    selectionOptions,
  }
}

export function projectStoryboardWidgetProbeTreeProviderMcpEvidence(mcpResult: JsonRecord): JsonRecord {
  const structuredContent = readRecord(mcpResult.structuredContent)
  const response = readRecord(structuredContent.response)
  const responseContent = readRecord(response.structuredContent)
  const costLog = readRecord(structuredContent.cost_log)
  const model = readText(costLog.model) || 'none'
  const cards = (model.toLowerCase() === 'none' ? [] : Array.isArray(responseContent.cards) ? responseContent.cards : [])
    .map(projectProviderCard)
    .filter((card): card is JsonRecord => Boolean(card))
    .slice(0, 4)
  return {
    isError: mcpResult.isError === true,
    structuredContent: {
      contractVersion: readText(structuredContent.contractVersion),
      ok: structuredContent.ok === true,
      degraded: structuredContent.degraded === true,
      degradedReason: readText(structuredContent.degraded_reason),
      model,
      cards,
    },
  }
}

export function projectStoryboardWidgetProbeTreeProviderSemanticContext(contextText: string): JsonRecord {
  const activeSelectedInput = stripProviderRoutingTokens(extractProbeTreeUserInputText(contextText))
  const precedingQuestionAndLineage = stripProviderRoutingTokens(
    extractProbeTreeClarificationContextText(contextText),
  )
  return {
    topicAuthority: 'active-selected-input',
    activeSelectedInput: activeSelectedInput || '',
    ...(precedingQuestionAndLineage ? { precedingQuestionAndLineage } : {}),
  }
}
