const RUN_TEXT_RESPONSE_INSTRUCTIONS = [
  'Return only the final user-facing markdown deliverable.',
  'Do not mention KGC, frontmatter, pipeline, or internal graph mechanics.',
  'When <user-authored-request> is present, treat it as the user request and <connected-source-context> as supporting evidence only.',
  'Infer response-language intent semantically from the user-authored request instead of using a fixed language list, locale table, or script detector.',
  'When the requested output language is explicit or the authored request makes it clear, respond in that language.',
  'When connected context uses a different language and it is genuinely ambiguous whether the user wants translation or continuation in the authored-request language, ask one concise clarification in the authored-request language before producing the deliverable.',
  'Do not ask for clarification solely because connected source context uses another language when the authored request is otherwise clear.',
].join(' ')

export function readRunTextResponseInstructions(): string {
  return RUN_TEXT_RESPONSE_INSTRUCTIONS
}
