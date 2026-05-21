import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT,
  CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
  CHAT_RESPONSE_BASE_PARAMETER_KEYS_GENERIC,
} from '@/features/chat/chatResponseBaseContract'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'
import { isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'
import { normalizeKgcFrontmatterIdentityToFileName } from '@/features/chat/chatHistoryWorkspace.kgc.normalize'
import {
  toCanonicalKgcWorkspacePath,
  toKgcOutputWorkspacePath,
  toKgcTraceWorkspacePath,
} from '@/features/chat/chatHistoryWorkspace.paths'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

const readComputingFlowSample = (): string => {
  const p = resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
  return readFileSync(p, 'utf8')
}

const readBaseTemplateSample = (): string => {
  const candidates = [
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-chat-response-base-template.md'),
    resolve(process.cwd(), '..', '..', 'huijoohwee.github.io', 'template', 'kgc-ai-pipeline-chat-response-base-template.md'),
  ]
  const p = candidates.find(candidate => existsSync(candidate)) || candidates[0]!
  return readFileSync(p, 'utf8')
}

export function testChatResponseContractPromptIncludesMarkdownGuidelineAndSurfaceKeys() {
  const prompt = CHAT_BASE_RESPONSE_CONTRACT_PROMPT

  const requiredSnippets = [
    'markdown syntax guidelines',
    'Flow Editor (2D), Multi-dimensional Table, and Kanban',
    '@edge:src:handle→tgt:handle',
    'ONE fenced yaml block with',
    'root key response:',
    'Tier B keys: product, domain, subject, objective, artifact, owner, version, status.',
    'Table cells: never empty',
    'TBD (unknown) or — (not applicable)',
  ]
  requiredSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to include: ${snippet}`)
    }
  })

  CHAT_RESPONSE_BASE_PARAMETER_KEYS_GENERIC.forEach(key => {
    if (!prompt.includes(`\`${key}\``)) {
      throw new Error(`Expected chat response contract prompt to include response key: ${key}`)
    }
  })
}

export function testChatResponseContractPromptStaysCompatibleWithComputingFlowSample() {
  const sample = readComputingFlowSample()
  const prompt = CHAT_BASE_RESPONSE_CONTRACT_PROMPT

  const sampleSnippets = ['flow:', '@node:', '@edge:', '{{subject}}', 'TBD']
  sampleSnippets.forEach(snippet => {
    if (!sample.includes(snippet)) {
      throw new Error(`Expected computing-flow sample fixture to include snippet: ${snippet}`)
    }
  })

  const promptSnippets = ['flow blocks', '@node:id', '@edge:src:handle→tgt:handle', 'Tier B sentinel keys', 'TBD (unknown)', 'not applicable']
  promptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to cover sample-compatible token: ${snippet}`)
    }
  })
}

export function testChatKgcResponseContractPromptAlignsWithBaseTemplateFixture() {
  const prompt = CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT
  const template = readBaseTemplateSample()

  const requiredPromptSnippets = [
    'Use canonical structure, not canonical wording',
    'schema guidance only',
    'Stream the final document progressively',
    'the answer itself must be the KGC document',
    'exactly one standalone KGC document',
    'Do not emit stock labels such as "Request Intent"',
    'graphId, doc_type, date, ai_model, and lang MUST be concrete resolved strings.',
    'title SHOULD resolve when product context is known',
    'Mention stack, payments, geospatial, workflow, or distribution details only when present',
    'pipeline[*].node / flow.nodes[*].id / mermaid: node IDs not in exact sync',
    'flow.subgraphs[*]',
    'parser projects flow.subgraphs into kg:subgraphs metadata',
    'n-trigger, n-pack, n-process, n-validate, n-deliver',
    'V-07',
    '## Customization Guide',
  ]
  requiredPromptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected KGC response contract prompt to include: ${snippet}`)
    }
  })

  const requiredTemplateSnippets = [
    '$schema: "kgc-pipeline/v1"',
    'runtime:',
    'pipeline:',
    'mermaid: |',
    'flow:',
    '## Customization Guide',
    '@edge:n-validate:correction→n-process:correction',
    '{{runtime.maxRetry}}',
  ]
  requiredTemplateSnippets.forEach(snippet => {
    if (!template.includes(snippet)) {
      throw new Error(`Expected base template fixture to include snippet: ${snippet}`)
    }
  })
}

export function testBaseTemplateFixturePassesKgcStructuredAndValidation() {
  const md = readBaseTemplateSample()
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected base template fixture to satisfy KGC structured markdown detection')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new Error(`Expected base template fixture to validate, got ${first?.ruleId}: ${first?.message}`)
  }
  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-ai-pipeline-chat-response-base-template.md', md)
  if (!parsed) throw new Error('Expected base template fixture to parse as a frontmatter flow graph')
}

export function testKgcDeterministicFallbackIsStructuredAndValid() {
  const requestIntent = 'Solo founder bootstrap GTM with Swipe payment checkout integration'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 12, 34, 56),
    requestText: requestIntent,
    assistantText: 'Focus on external adoption, conversion path, and a reusable planning package.',
  })
  if (!md.includes('subject: "solo founder"')) {
    throw new Error('Expected deterministic fallback to infer a neutral subject when it is explicit in the request')
  }
  if (!md.includes('owner: "solo founder"')) {
    throw new Error('Expected deterministic fallback to project explicit owner from the named actor')
  }
  if (!md.includes('bootstrap execution') || !md.includes('Swipe payment') || !md.includes('checkout')) {
    throw new Error('Expected deterministic fallback to derive a normalized query-shaped objective')
  }
  if (!md.includes('Swipe') || !md.includes('solo founder')) {
    throw new Error('Expected deterministic fallback body to stay request-shaped for actor and payment context')
  }
  if (!md.includes('This document packages `{{artifact}}` for `{{subject}}` around the active request.')) {
    throw new Error('Expected deterministic fallback lead to stay artifact-first instead of pipeline-first')
  }
  if (md.includes('This document turns one request into one reusable pipeline artifact.') || md.includes('The canonical five-node pipeline is applied to the current request:')) {
    throw new Error('Expected deterministic fallback to remove pipeline-self-explanatory lead prose')
  }
  const requiredSections = [
    '## Computing Flow Definition',
    '## Flow Graph',
    '## Pipeline',
    '## PRD — Product Requirements',
    '## TAD — Technical Architecture',
    '## Open Questions',
    '## Customization Guide',
    '### Variable Link Map',
    '### Request Snapshot',
  ]
  requiredSections.forEach(section => {
    if (!md.includes(section)) {
      throw new Error(`Expected deterministic fallback to include required section: ${section}`)
    }
  })
  if (md.includes('This section summarizes product requirements implied by the user request.')) {
    throw new Error('Expected deterministic fallback to remove generic PRD summary boilerplate')
  }
  if (md.includes('This section summarizes architecture boundaries and integration points implied by the user request.')) {
    throw new Error('Expected deterministic fallback to remove generic TAD summary boilerplate')
  }
  if (md.includes('Monetization Focus:') || md.includes('Stack: ')) {
    throw new Error('Expected deterministic fallback to avoid legacy canned request-specific labels')
  }
  if (!md.includes('`bg#FAEEDA:status {{status}}` · owner `solo founder`')) {
    throw new Error('Expected deterministic fallback body meta to reflect resolved owner while preserving unresolved status')
  }
  const requiredFrontmatterSnippets = [
    'feedback_arcs:',
    'forward_edges:',
    'subgraphs:',
    'sg-p1',
    'direction:  {key: direction,  type: string,  value: LR}',
    'compute:       {key: compute,       type: function, value: |',
    'click n-trigger  "#pipeline" "S01 · trigger / input"',
    'sandbox:  {key: sandbox,  type: string,  value: "quickjs-emscripten"}',
  ]
  requiredFrontmatterSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected deterministic fallback frontmatter to include: ${snippet}`)
    }
  })
  if (!isKgcStructuredMarkdown(md)) {
    throw new Error('Expected deterministic fallback to satisfy KGC structured markdown detection')
  }
  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  if (!validation.ok) {
    const first = validation.errors[0]
    throw new Error(`Expected deterministic fallback to validate, got ${first?.ruleId}: ${first?.message}`)
  }
  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-fallback.md', md)
  if (!parsed) throw new Error('Expected deterministic fallback to parse as a frontmatter flow graph')
}

export function testKgcIdentityNormalizationEnforcesBaseTemplateScalars() {
  const template = readBaseTemplateSample().replace(/\r\n/g, '\n')
  const mutated = template
    .replace(/title:\s+"{{product}} · AI Pipeline — Chat Response"/, 'title: "Knowledge Graph Canvas · AI Pipeline — Chat Response"')
    .replace(/graphId:\s+"md:{{domain}}-pipeline"/, 'graphId: "md:kgc-20260419180222-pipeline"')
    .replace(/date:\s+"{{date}}"/, 'date: "2026-04-19"')
    .replace('# {{product}} · AI Pipeline', '# Knowledge Graph Canvas · AI Pipeline')
    .replace('owner `{{owner}}` · {{date}}', 'owner `{{owner}}` · 2026-04-19')

  const normalized = normalizeKgcFrontmatterIdentityToFileName({
    markdown: mutated,
    workspacePath: '/sandbox/chat-log/kgc_20260419180222.md',
    timestampMs: Date.UTC(2026, 3, 19, 18, 2, 22),
  })

  if (!normalized.includes('Knowledge Graph Canvas · AI Pipeline — Chat Response')) {
    throw new Error('Expected normalized KGC title to preserve authored content')
  }
  if (!normalized.includes('md:kgc-20260419180222-pipeline')) {
    throw new Error('Expected normalized KGC graphId to derive from the storage filename')
  }
  if (!normalized.includes('2026-04-19')) {
    throw new Error('Expected normalized KGC date to derive from the storage timestamp')
  }
  if (!normalized.includes('claude-sonnet-4-20250514')) {
    throw new Error('Expected normalized KGC ai_model to preserve the authored model identifier')
  }
  if (!normalized.includes('en-US')) {
    throw new Error('Expected normalized KGC lang to preserve the authored language')
  }
  if (!normalized.includes('kgc_20260419180222.md')) {
    throw new Error('Expected normalized KGC self_ref to match workspace filename')
  }
  if (!normalized.includes('# Knowledge Graph Canvas · AI Pipeline')) {
    throw new Error('Expected normalized body H1 to preserve authored body content')
  }
  if (!normalized.includes('owner `{{owner}}` · 2026-04-19')) {
    throw new Error('Expected normalized body meta line to preserve authored body content')
  }
}

export function testKgcWorkspacePathCanonicalizationMapsTraceAndOutputToCanonical() {
  const tracePath = '/sandbox/chat-log/kgc-trace_20260419180222.md'
  const outputPath = '/sandbox/chat-log/kgc-output_20260419180222.svg'

  if (toCanonicalKgcWorkspacePath(tracePath) !== '/sandbox/chat-log/kgc_20260419180222.md') {
    throw new Error('Expected trace path to canonicalize to the runnable KGC markdown path')
  }
  if (toCanonicalKgcWorkspacePath(outputPath) !== '/sandbox/chat-log/kgc_20260419180222.md') {
    throw new Error('Expected output companion path to canonicalize back to the runnable KGC markdown path')
  }
  if (toKgcTraceWorkspacePath('/sandbox/chat-log/kgc_20260419180222.md') !== tracePath) {
    throw new Error('Expected canonical KGC path to derive a matching trace companion path')
  }
  if (toKgcOutputWorkspacePath(tracePath, 'png') !== '/sandbox/chat-log/kgc-output_20260419180222.png') {
    throw new Error('Expected trace path to derive a matching output companion path')
  }
  if (toKgcOutputWorkspacePath(tracePath, 'html', { variant: 'viewer' }) !== '/sandbox/chat-log/kgc-output_20260419180222-viewer.html') {
    throw new Error('Expected trace path to derive a stable variant output companion path')
  }

  const normalized = normalizeKgcFrontmatterIdentityToFileName({
    markdown: readBaseTemplateSample(),
    workspacePath: tracePath,
    timestampMs: Date.UTC(2026, 3, 19, 18, 2, 22),
  })
  if (!normalized.includes('kgc_20260419180222.md')) {
    throw new Error('Expected identity normalization to use the canonical KGC filename even when the workspace path points at a trace file')
  }
}

export function testKgcFallbackWithNonEmptyQueryIsNotByteEqualToCanonicalTemplate() {
  const canonicalTemplate = readBaseTemplateSample().replace(/\r\n/g, '\n').trimEnd()
  const generated = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 20, 14, 10),
    workspacePath: '/sandbox/chat-log/kgc_20260419201410.md',
    requestText: 'Solo founder bootstrap growth with Swipe checkout and RxDB MapLibre stack',
    assistantText: 'invalid fallback trigger',
  }).replace(/\r\n/g, '\n').trimEnd()

  if (generated === canonicalTemplate) {
    throw new Error('Expected fallback output with non-empty query to differ from canonical template bytes')
  }
}

export function testStructuredKgcIsEnforcedQueryResponsiveBeforePersistence() {
  const canonicalTemplate = readBaseTemplateSample().replace(/\r\n/g, '\n')
  const requestText = 'Solo founder bootstrap growth with Swipe checkout, RxDB, MapLibre, MCP marketplace'
  const generated = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 19, 21, 1, 10),
    workspacePath: '/sandbox/chat-log/kgc_20260419210110.md',
    requestText,
    assistantText: canonicalTemplate,
  })
  if (!generated.includes('subject: "solo founder"')) {
    throw new Error('Expected structured KGC to resolve an explicit subject from the request')
  }
  if (!generated.includes('domain: "MCP distribution') || !generated.includes('user-action monetization')) {
    throw new Error('Expected structured KGC to resolve a concise domain from the request')
  }
  if (generated.includes('Request Intent:') || generated.includes('Monetization Focus:') || generated.includes('Stack: ')) {
    throw new Error('Expected structured KGC persistence normalization to avoid legacy canned body injections')
  }
  if (generated === canonicalTemplate) {
    throw new Error('Expected structured KGC to differ from the untouched template when request context can resolve Tier B fields')
  }
}

export function testKgcDeterministicFallbackShapesLatestRecommendationQuery() {
  const requestText = 'RECOMMEND: Solo founder; zero budget, bootstrap, organic growth; **Knowledge Graph Canvas** product as MCP for external users, OpenClaw, skills marketplace; Pitch Deck+PRD+TAD, TCO; Use Case -> Problem -> Solution; User Flow+Work Flow+Data Flow; B2C monetization ideas; monetize user actions (subscriptions, pay-per-use, and commerce-like conversion); FOSS RxDB, MapLibre; expose integration with **Swipe payment** flow (payments/checkout)'
  const assistantText = [
    '---',
    'title: "knowledge-graph-canvas · AI Pipeline — PRD + TAD"',
    'graphId: "kgc-knowledge-graph-canvas-prd-tad"',
    '$schema: "kgc-pipeline/v1"',
    'pipeline:',
    'flow:',
  ].join('\n')
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 10, 54, 32),
    workspacePath: '/sandbox/chat-log/kgc_20260420105432.md',
    requestText,
    assistantText,
  })
  const requiredSnippets = [
    'product: "Knowledge Graph Canvas"',
    'artifact: "Pitch Deck + PRD + TAD + TCO"',
    'owner: "solo founder"',
    'status: "recommended"',
    'doc_type: "Pitch Deck + PRD + TAD + TCO"',
    'title: "Knowledge Graph Canvas · AI Pipeline — Pitch Deck + PRD + TAD + TCO"',
    '## Pitch Deck + PRD + TAD + TCO',
    'label: "trigger / input"',
    'label: "context pack"',
    'label: "generate / process"',
    'label: "review / validate"',
    'label: "deliver / persist"',
    'actor: ["{{subject}}", "system"]',
    'actor: ["{{subject}}", "AI"]',
    'user_action: "{{subject}} selects scope; states the active request objective and constraints"',
    'Request injected as user turn; {{subject}} reviews streamed output for fit and clarity',
    'feedback_arcs:',
    'forward_edges:',
    'direction:  {key: direction,  type: string,  value: LR}',
    'computed:   {key: computed,   type: boolean, value: true}',
    'click n-trigger  "#pipeline" "S01 · trigger / input"',
    'click n-deliver  "#pipeline" "S05 · deliver / persist"',
    'seq:    R01',
    'seq:    R06',
    'retry ≤ {{runtime.maxRetry}}× via @edge:n-validate:correction→n-process:correction',
    '### Variable Link Map',
    '### Request Snapshot',
    '`{{product}}`',
    '`{{artifact}}`',
    '`{{subject}}`',
    '### Use Case',
    '### Problem',
    '### Solution',
    '### User Flow',
    '### Work Flow',
    '### Data Flow',
    '### Monetization Surface',
    '### Integration Boundaries',
    'OpenClaw',
    'Swipe',
    'RxDB',
    'MapLibre',
    'subscriptions',
    'pay-per-use',
    'conversion',
    'external users',
    'Swipe can cover checkout, payment confirmation, and post-payment handoff',
    'OpenClaw can cover marketplace listing and demand capture',
    'An external user discovers the `{{product}}` offer',
    'unlocks the paid entitlement or action',
    '### Request Snapshot',
    'Canonical output path',
    'kgc-output_20260420105432.md',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected latest recommendation fallback to include: ${snippet}`)
    }
  })
  if (!md.includes('domain: "MCP distribution + skills marketplace delivery + user-action monetization')) {
    throw new Error('Expected latest recommendation fallback to resolve a bounded but query-shaped domain')
  }
  if (
    !md.includes('objective: "support zero-budget execution; prioritize bootstrap execution; favor organic growth; package Knowledge Graph Canvas as an MCP offer; serve external users; support OpenClaw marketplace packaging; deliver Pitch Deck + PRD + TAD + TCO; evaluate B2C monetization; compare subscription, pay-per-use, and conversion monetization; expose Swipe payment and checkout integration') &&
    !md.includes('integrate Swipe checkout and payment flow')
  ) {
    throw new Error('Expected latest recommendation fallback to resolve a synthesized objective without clipped raw query fragments')
  }
  if (!md.includes('Which user action should trigger Swipe checkout, and what entitlement or fulfillment should follow payment completion?')) {
    throw new Error('Expected latest recommendation fallback to replace generic open questions with request-shaped ones')
  }
  if (!md.includes('S01 captures the active request brief for `{{product}}`')) {
    throw new Error('Expected latest recommendation fallback workflow wording to stay request-first rather than recommendation-first')
  }
  if (!md.includes('The execution contract below supports the current request:')) {
    throw new Error('Expected latest recommendation fallback computing-flow intro to stay request-facing')
  }
  if (md.includes('Recovered partial response signal:') || md.includes('Working response signal:')) {
    throw new Error('Expected malformed structured assistant fragments to be excluded from fallback prose')
  }
  if (md.includes('## {{doc_type}}') || md.includes('Edit Tier B variables (product, domain, subject, objective, artifact, owner, version, status)') || md.includes('This fallback preserves')) {
    throw new Error('Expected latest recommendation fallback to avoid placeholder body projections and generic template carryover')
  }
}

export function testKgcDeterministicFallbackShapesCreativeScriptQueryWithoutTrademarkCarryover() {
  const requestText = 'generate video script inspired by prometheus + jurassic park (FORBID mention/infringe trademark) `video-script-promessic.md`'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 19, 20, 54),
    workspacePath: '/sandbox/chat-log/kgc_20260420192054.md',
    requestText,
    assistantText: 'Need a cinematic script draft with awe and danger.',
  })

  const requiredSnippets = [
    'artifact: "video script"',
    'objective: "develop video script; keep the output original and production-ready; avoid direct trademark or franchise references; translate inspiration into high-level tone, pacing, and atmosphere only"',
    '### Request Snapshot',
    '### Request Fit',
    '### Direction',
    '### Guardrails',
    'video-script-promessic.md',
    'high-level inspiration only',
    'avoid direct trademark or franchise references',
    'request_scope',
    'objective_focus',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected creative script fallback to include: ${snippet}`)
    }
  })

  const forbiddenSnippets = [
    'Recommendation Snapshot',
    'OpenClaw marketplace distribution',
    'B2C monetization',
    'prometheus',
    'jurassic park',
  ]
  forbiddenSnippets.forEach(snippet => {
    if (md.toLowerCase().includes(snippet.toLowerCase())) {
      throw new Error(`Expected creative script fallback to avoid: ${snippet}`)
    }
  })
}

export function testKgcDeterministicFallbackStaysNeutralForGenericRequest() {
  const requestText = 'Draft a concise implementation memo for improving offline sync conflict visibility in a local-first workspace'
  const md = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 20, 21, 46, 8),
    workspacePath: '/sandbox/chat-log/kgc_20260420214608.md',
    requestText,
    assistantText: 'Need a short memo with implementation direction and constraints.',
  })

  const requiredSnippets = [
    '### Request Snapshot',
    '### Request Fit',
    '### Direction',
    '### Guardrails',
    '`{{artifact}}`',
    '`{{subject}}`',
    'This document packages `{{artifact}}` for `{{subject}}` around the active request.',
  ]
  requiredSnippets.forEach(snippet => {
    if (!md.includes(snippet)) {
      throw new Error(`Expected generic fallback to include: ${snippet}`)
    }
  })

  const forbiddenSnippets = [
    '### Use Case',
    '### Monetization Surface',
    '### Integration Boundaries',
    'recommendation package',
    'OpenClaw',
    'Swipe',
    'video-script-promessic.md',
    'This document turns one request into one reusable pipeline artifact.',
  ]
  forbiddenSnippets.forEach(snippet => {
    if (md.includes(snippet)) {
      throw new Error(`Expected generic fallback to avoid: ${snippet}`)
    }
  })
}
