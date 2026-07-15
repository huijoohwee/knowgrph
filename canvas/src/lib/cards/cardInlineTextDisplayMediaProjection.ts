import { readCardInlineTextMediaCandidateKey } from '@/lib/cards/CardInlineTextEditorSupport'
import { sourceContainsInlineMediaUrl } from '@/lib/command-menu/inlineMediaUrlIdentity'
import {
  collectTextareaInvocationMediaAttachmentCandidateChips,
  collectTextareaInvocationProjectedMediaChips,
  type TextareaInvocationMediaAttachment,
  type TextareaInvocationProjectedMediaChip,
} from '@/lib/ui/textareaInvocationProjection'

export function resolveCardInlineTextDisplayProjectionSource(args: {
  displayValue: string
  multiline: boolean
  projectedMediaAttachments?: readonly TextareaInvocationMediaAttachment[] | null
  value: string
}): string {
  if (!args.multiline || !args.projectedMediaAttachments?.some(attachment => sourceContainsInlineMediaUrl(args.value, attachment.sourceUrl))) {
    return args.displayValue
  }
  return args.value
}

export function buildCardInlineTextDisplayMediaCandidateMap(
  source: string,
  attachments?: readonly TextareaInvocationMediaAttachment[] | null,
): Map<string, TextareaInvocationProjectedMediaChip> {
  if (!attachments?.length) return new Map()
  const candidates = [
    ...collectTextareaInvocationMediaAttachmentCandidateChips(attachments),
    ...collectTextareaInvocationProjectedMediaChips(source, { mediaAttachments: attachments }),
  ]
  return new Map(candidates.map(chip => [readCardInlineTextMediaCandidateKey(chip), chip]))
}
