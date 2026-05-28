import { buildResolvableVarKeySet, validateChatMarkdown } from '../chatMarkdownValidation'
import { isKgcStructuredMarkdown } from '../chatHistoryWorkspace'
import { extractKgcBlockFromAssistantText } from '../FloatingPanelChat.helpers'
import { buildCorrectionPrompt } from './floatingPanelChatCorrectionPrompt'
import type { JSONValue } from '@/lib/graph/types'

export type ChatKnowgrphAttemptValidationState = {
  stage: 'retrying' | 'validated' | 'failed'
  attempt: number
  maxAttempts: number
  failedRuleId: string | null
  failedMessage: string | null
  correctionPromptPreview: string | null
  hasStructuredKgc: boolean
  hasYamlFrontmatter: boolean
  validatedKgcLength: number
}

export type ChatKnowgrphAttemptResolution =
  | {
    kind: 'retry'
    correctionPrompt: string
    validation: ChatKnowgrphAttemptValidationState
  }
  | {
    kind: 'final'
    finalAssistantText: string
    validatedKgc: string | null
    status: 'ok' | 'error'
    validation: ChatKnowgrphAttemptValidationState
  }

const buildValidationState = (args: {
  stage: 'retrying' | 'validated' | 'failed'
  attempt: number
  maxAttempts: number
  failedRuleId?: string | null
  failedMessage?: string | null
  correctionPromptPreview?: string | null
  candidateKgc?: string | null
  validatedKgc?: string | null
}): ChatKnowgrphAttemptValidationState => {
  const candidateKgc = String(args.candidateKgc || '').trim()
  const validatedKgc = String(args.validatedKgc || '').trim()
  return {
    stage: args.stage,
    attempt: args.attempt,
    maxAttempts: args.maxAttempts,
    failedRuleId: args.failedRuleId || null,
    failedMessage: args.failedMessage || null,
    correctionPromptPreview: args.correctionPromptPreview || null,
    hasStructuredKgc: Boolean(candidateKgc),
    hasYamlFrontmatter: candidateKgc.startsWith('---\n'),
    validatedKgcLength: validatedKgc.length,
  }
}

export const resolveKgcCorrectionInvalidMarkdown = (args: {
  rawAssistantText: string
  extracted: { answer: string; kgc: string | null }
}): string => {
  const kgc = typeof args.extracted.kgc === 'string' ? args.extracted.kgc.trim() : ''
  if (kgc) return kgc
  const answer = String(args.extracted.answer || '').trim()
  if (answer) return answer
  return String(args.rawAssistantText || '').trim()
}

export const resolveChatKnowgrphAttempt = (args: {
  assistantText: string
  packedFrontmatter: Record<string, JSONValue> | null | undefined
  attempt: number
  maxValidationAttempts: number
}): ChatKnowgrphAttemptResolution => {
  const assistantText = String(args.assistantText || '')
  const extracted = extractKgcBlockFromAssistantText(assistantText)
  const kgc = typeof extracted.kgc === 'string' ? extracted.kgc.trim() : ''
  const correctionInvalidMarkdown = resolveKgcCorrectionInvalidMarkdown({
    rawAssistantText: assistantText,
    extracted,
  })
  const hasRetryRemaining = args.attempt < args.maxValidationAttempts
  if (!kgc) {
    const message = 'Previous answer did not include a parseable standalone KGC document. Return exactly one complete KGC markdown document.'
    if (hasRetryRemaining) {
      return {
        kind: 'retry',
        correctionPrompt: buildCorrectionPrompt({
          ruleId: 'V-03',
          message,
          invalidMarkdown: correctionInvalidMarkdown,
        }),
        validation: buildValidationState({
          stage: 'retrying',
          attempt: args.attempt,
          maxAttempts: args.maxValidationAttempts,
          failedRuleId: 'V-03',
          failedMessage: message,
          correctionPromptPreview: correctionInvalidMarkdown,
        }),
      }
    }
    return {
      kind: 'final',
      finalAssistantText: assistantText,
      validatedKgc: null,
      status: 'ok',
      validation: buildValidationState({
        stage: 'failed',
        attempt: args.attempt,
        maxAttempts: args.maxValidationAttempts,
        failedRuleId: 'V-03',
        failedMessage: message,
      }),
    }
  }
  if (!isKgcStructuredMarkdown(kgc)) {
    const message = 'Previous KGC payload was incomplete or not structurally parseable. Return one complete KGC markdown document with valid frontmatter and required sections.'
    if (hasRetryRemaining) {
      return {
        kind: 'retry',
        correctionPrompt: buildCorrectionPrompt({
          ruleId: 'V-03',
          message,
          invalidMarkdown: correctionInvalidMarkdown,
        }),
        validation: buildValidationState({
          stage: 'retrying',
          attempt: args.attempt,
          maxAttempts: args.maxValidationAttempts,
          failedRuleId: 'V-03',
          failedMessage: message,
          correctionPromptPreview: correctionInvalidMarkdown,
          candidateKgc: kgc,
        }),
      }
    }
    return {
      kind: 'final',
      finalAssistantText: assistantText,
      validatedKgc: null,
      status: 'ok',
      validation: buildValidationState({
        stage: 'failed',
        attempt: args.attempt,
        maxAttempts: args.maxValidationAttempts,
        failedRuleId: 'V-03',
        failedMessage: message,
        candidateKgc: kgc,
      }),
    }
  }

  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: args.packedFrontmatter, markdown: kgc })
  const validation = validateChatMarkdown({ markdown: kgc, resolvableVarKeys })
  if (validation.ok) {
    return {
      kind: 'final',
      finalAssistantText: assistantText,
      validatedKgc: kgc,
      status: 'ok',
      validation: buildValidationState({
        stage: 'validated',
        attempt: args.attempt,
        maxAttempts: args.maxValidationAttempts,
        candidateKgc: kgc,
        validatedKgc: kgc,
      }),
    }
  }

  const first = validation.errors[0]
  const nextRule = first?.ruleId || 'V-03'
  const nextMsg = first?.message || 'Validation failed.'
  if (hasRetryRemaining) {
    return {
      kind: 'retry',
      correctionPrompt: buildCorrectionPrompt({
        ruleId: nextRule,
        message: nextMsg,
        invalidMarkdown: correctionInvalidMarkdown,
      }),
      validation: buildValidationState({
        stage: 'retrying',
        attempt: args.attempt,
        maxAttempts: args.maxValidationAttempts,
        failedRuleId: nextRule,
        failedMessage: nextMsg,
        correctionPromptPreview: correctionInvalidMarkdown,
        candidateKgc: kgc,
      }),
    }
  }
  return {
    kind: 'final',
    finalAssistantText: assistantText,
    validatedKgc: null,
    status: 'ok',
    validation: buildValidationState({
      stage: 'failed',
      attempt: args.attempt,
      maxAttempts: args.maxValidationAttempts,
      failedRuleId: nextRule,
      failedMessage: nextMsg,
      candidateKgc: kgc,
    }),
  }
}
