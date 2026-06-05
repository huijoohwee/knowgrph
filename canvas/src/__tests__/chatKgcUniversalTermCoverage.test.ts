import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'
import { isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'

const readBaseTemplateSample = (): string => {
  const candidates = [
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-chat-response-base-template.md'),
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'template', 'kgc-ai-pipeline-chat-response-base-template.md'),
  ]
  const p = candidates.find(candidate => existsSync(candidate)) || candidates[0]!
  return readFileSync(p, 'utf8')
}

const assertIncludes = (md: string, snippets: string[], label: string): void => {
  snippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected ${label} to include: ${snippet}`)
    }
  })
}

const assertOmits = (md: string, snippets: string[], label: string): void => {
  snippets.forEach(snippet => {
    if (md.includes(snippet)) {
      throw new Error(`Expected ${label} to omit: ${snippet}`)
    }
  })
}

const validateGeneratedKgc = (md: string, label: string): void => {
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error(`Expected ${label} to satisfy KGC structured markdown detection`)
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new Error(`Expected ${label} to validate, got ${first?.ruleId}: ${first?.message}`)
  }
}

export function testKgcFallbackPreservesNamedTermsForUnfamiliarPromptWithoutFamilyBranches() {
  const requestText = [
    'Draft a concise implementation memo for `QNX-42 gateway`,',
    'BlueLark adapter, 17ms jitter budget, DeltaSync handoff,',
    'outputSrcDoc chart panel, and audioUrl review notes.',
  ].join(' ')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 5, 5, 4, 15, 20),
    workspacePath: '/chat-log/20260605T041520Z/kgc_20260605T041520Z.md',
    requestText,
    assistantText: readBaseTemplateSample(),
  })

  assertIncludes(md, [
    'QNX-42 gateway',
    'BlueLark adapter',
    '17ms jitter budget',
    'DeltaSync handoff',
    'outputSrcDoc chart panel',
    'audioUrl review notes',
    'Named terms',
    'Term coverage',
    'Rich Media Panels',
    'outputSrcDoc',
  ], 'universal KGC fallback')

  assertOmits(md, [
    'external discovery channels',
    'the stated revenue actions',
    'the monetized conversion trigger',
    'user-action monetization',
    'monetized user actions',
    'commercialization and integration assumptions',
    'OpenClaw marketplace distribution',
    'Swipe checkout',
  ], 'universal KGC fallback')

  validateGeneratedKgc(md, 'universal KGC fallback')
}

export function testKgcFallbackPreservesDenseSymbolicTermsWithoutPromptFamilyTemplate() {
  const requestText = [
    'Create a neutral response for AX-17 telemetry, RhoLake queue,',
    'GammaPulse adapter, 9s retry window, SigmaSwitch handoff,',
    'inline imageUrl preview, and transcriptUrl audio review.',
  ].join(' ')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 5, 5, 4, 16, 30),
    workspacePath: '/chat-log/20260605T041630Z/kgc_20260605T041630Z.md',
    requestText,
    assistantText: readBaseTemplateSample(),
  })

  assertIncludes(md, [
    'AX-17 telemetry',
    'RhoLake queue',
    'GammaPulse adapter',
    '9s retry window',
    'SigmaSwitch handoff',
    'imageUrl preview',
    'transcriptUrl audio review',
    'Named terms',
    'Term coverage',
  ], 'dense symbolic KGC fallback')

  assertOmits(md, [
    'OpenClaw marketplace distribution',
    'Swipe checkout',
    'external discovery channels',
    'the stated revenue actions',
    'the monetized conversion trigger',
  ], 'dense symbolic KGC fallback')

  validateGeneratedKgc(md, 'dense symbolic KGC fallback')
}

export function testKgcFallbackKeepsAnalysisAsTermNotArtifactFamily() {
  const requestText = [
    '1-3 month horizon, portfolio: BTC 30% + gold 20% - factor analysis:',
    'ETF flow momentum vs spot premium/discount, options skew divergence between the two assets,',
    'signal/noise ratio on macro catalyst FOMC CPI print sensitivity;',
    'uncover BTC-gold skew convergence as institutional adoption matures.',
  ].join(' ')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 5, 5, 1, 18, 43),
    workspacePath: '/chat-log/20260605T011843Z/kgc_20260605T011843Z.md',
    requestText,
    assistantText: readBaseTemplateSample(),
  })

  assertIncludes(md, [
    'BTC 30% + gold 20%',
    'factor analysis',
    'ETF flow momentum',
    'spot premium/discount',
    'options skew divergence between the two assets',
    'signal/noise ratio on macro catalyst',
    'FOMC',
    'CPI',
    'BTC-gold skew convergence',
  ], 'dense financial term coverage')

  assertOmits(md, [
    'doc_type: "analysis"',
    'AI Pipeline — analysis',
    'deliver analysis',
  ], 'dense financial term coverage')

  validateGeneratedKgc(md, 'dense financial term coverage')
}
