import { CHAT_TABLE_PERSISTENCE_CONTRACT_PROMPT } from './chatTablePersistenceContract'

export const CHAT_AI_MARKDOWN_MODEL_DEFAULT = 'claude-sonnet-4-20250514'

export const CHAT_AI_MARKDOWN_TEMPERATURE_DEFAULT = 0.3
export const CHAT_AI_MARKDOWN_MAX_TOKENS_DEFAULT = 1000

export const CHAT_AI_MARKDOWN_MAX_RETRY = 3

export const CHAT_AI_MARKDOWN_VALIDATION_RULES = [
  'V-01',
  'V-02',
  'V-03',
  'V-04',
  'V-05',
  'V-06',
  'V-07',
  'V-10',
] as const

export type ChatAiMarkdownValidationRuleId = (typeof CHAT_AI_MARKDOWN_VALIDATION_RULES)[number]

export const CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT = 200
export const CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT = 800

const CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_CHARS = 3_600

export const clipByTokenApprox = (raw: string, maxTokens: number): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxTokens) return text
  return `${words.slice(0, Math.max(1, maxTokens)).join(' ')} ...`
}

const clipDigest = (raw: string, maxTokens: number): string => {
  const tokenClipped = clipByTokenApprox(raw, maxTokens)
  if (!tokenClipped) return ''
  if (tokenClipped.length <= CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_CHARS) return tokenClipped
  return `${tokenClipped.slice(0, Math.max(0, CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_CHARS - 3))}...`
}

export const clampChatCompletionTokens = (raw: unknown): number => {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return CHAT_AI_MARKDOWN_MAX_TOKENS_DEFAULT
  const v = Math.floor(n)
  return Math.max(64, Math.min(100_000, v))
}

export const clampChatContextMaxTokens = (raw: unknown, fallback: number): number => {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  const v = Math.floor(n)
  return Math.max(16, Math.min(10_000, v))
}

const GUIDELINE_LINES = [
  'markdown-syntax-guidelines.md (digest):',
  '- Respond ONLY with valid Markdown. No preamble. No explanation.',
  '- Variable references: `{{key}}`, optional `{{key:value}}`, optional `{{key|fallback}}`.',
  '- Annotation sigils (inline code): `#HEX:text`, `bg#HEX:text`, `#HEX|bg#HEX:text` where HEX is exactly 6 uppercase digits.',
  '- Multi-select arrays must be valid JSON when used in inline code, e.g. `["A","B"]`.',
  '- `compute: |` blocks must be pure: forbid `fetch`, `document`, `window`.',
  '- Headings (H1–H4) must not end with `...`.',
  '- `confidence:` values must be exactly `low`, `medium`, or `high`.',
  `- ${CHAT_TABLE_PERSISTENCE_CONTRACT_PROMPT.replace(/\n/g, ' ')}`,
  '',
  'Validation rules run sequentially; first failure triggers `@flag:correction`:',
  `- rules: ${CHAT_AI_MARKDOWN_VALIDATION_RULES.join(', ')}`,
  `- max_retry: ${CHAT_AI_MARKDOWN_MAX_RETRY}`,
]

export const buildGuidelineDigest = (maxTokens: number): string => {
  return clipDigest(GUIDELINE_LINES.join('\n'), Math.max(16, maxTokens))
}

export const CHAT_AI_MARKDOWN_GUIDELINE_DIGEST = buildGuidelineDigest(CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT)
