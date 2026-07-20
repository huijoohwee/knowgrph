const normalizeRepairReason = (value: string): string => (
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, 480)
)

export function buildStoryboardWidgetProbeTreeProviderRepairPrompt(args: {
  basePrompt: string
  rejectionReason: string
}): string {
  return [
    args.basePrompt,
    '',
    'The previous provider response was rejected by the Probe-Tree runtime validator.',
    `Validation feedback: ${normalizeRepairReason(args.rejectionReason) || 'No acceptable card set was returned.'}`,
    '- Make exactly one repair attempt. Return a new response rather than explaining or defending the rejected response.',
    '- Before returning, silently verify that 2-4 cards remain after validation.',
    '- Every question must add a concrete missing decision variable instead of restating the selected request.',
    '- Every answer choice must express a semantic preference, tradeoff, or consequence instead of only copying entities, amounts, ranges, or units from the request.',
    '- Keep card questions and answer-choice sets mutually distinct, with no reused choice labels.',
    '- Preserve the dominant natural language and script of the Active selected input during repair. Do not default to the language of the validation feedback, preceding question, lineage, or routing metadata.',
    '- Return only the required fenced JSON block.',
  ].join('\n')
}
