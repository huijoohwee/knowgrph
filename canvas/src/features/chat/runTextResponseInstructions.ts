const RUN_TEXT_RESPONSE_INSTRUCTIONS = [
  'Return only the final user-facing markdown deliverable.',
  'Do not mention KGC, frontmatter, pipeline, or internal graph mechanics.',
  'When <user-authored-request> is present, treat it as the user request and <connected-source-context> as supporting evidence only.',
  'Respond in the explicitly requested output language; otherwise use the dominant language of the user-authored request.',
  'Do not adopt the language of connected source context unless the user requests it.',
].join(' ')

export function readRunTextResponseInstructions(): string {
  return RUN_TEXT_RESPONSE_INSTRUCTIONS
}
