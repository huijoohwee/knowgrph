import { buildResolvableVarKeySet, validateChatMarkdown } from '../chatMarkdownValidation'
import { isKgcStructuredMarkdown } from '../chatHistoryWorkspace'
import { extractKgcBlockFromAssistantText } from '../SidePanelChat.helpers'
import { buildCorrectionPrompt } from './sidePanelChatCorrectionPrompt'

export type ChatKnowgrphAttemptResolution =
  | {
    kind: 'retry'
    correctionPrompt: string
  }
  | {
    kind: 'final'
    finalAssistantText: string
    validatedKgc: string | null
    status: 'ok' | 'error'
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
  packedFrontmatter: string | null | undefined
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
    if (hasRetryRemaining) {
      return {
        kind: 'retry',
        correctionPrompt: buildCorrectionPrompt({
          ruleId: 'V-03',
          message: 'Previous answer did not include a parseable standalone KGC document. Return exactly one complete KGC markdown document.',
          invalidMarkdown: correctionInvalidMarkdown,
        }),
      }
    }
    return {
      kind: 'final',
      finalAssistantText: assistantText,
      validatedKgc: null,
      status: 'ok',
    }
  }
  if (!isKgcStructuredMarkdown(kgc)) {
    if (hasRetryRemaining) {
      return {
        kind: 'retry',
        correctionPrompt: buildCorrectionPrompt({
          ruleId: 'V-03',
          message: 'Previous KGC payload was incomplete or not structurally parseable. Return one complete KGC markdown document with valid frontmatter and required sections.',
          invalidMarkdown: correctionInvalidMarkdown,
        }),
      }
    }
    return {
      kind: 'final',
      finalAssistantText: assistantText,
      validatedKgc: null,
      status: 'ok',
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
    }
  }
  return {
    kind: 'final',
    finalAssistantText: assistantText,
    validatedKgc: null,
    status: 'ok',
  }
}
