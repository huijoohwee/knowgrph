import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT,
  CHAT_BASE_RESPONSE_CONTRACT_PROMPT,
  CHAT_RESPONSE_BASE_PARAMETER_KEYS_GENERIC,
} from '@/features/chat/chatResponseBaseContract'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'
import { buildKgcStructuredTurn, buildKgcWorkspaceDocument, isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

const readComputingFlowSample = (): string => {
  const p = resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
  return readFileSync(p, 'utf8')
}

const readBaseTemplateSample = (): string => {
  const p = resolve(
    process.cwd(),
    '..',
    '..',
    'huijoohwee.github.io',
    'docs',
    'kgc-ai-pipeline-chat-response-base-template.md',
  )
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
    'Never leave empty cells.',
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

  const promptSnippets = ['flow blocks', '@node:*', '@edge:src:handle→tgt:handle', 'Tier B sentinels excepted', 'TBD (unknown)', 'not applicable']
  promptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to cover sample-compatible token: ${snippet}`)
    }
  })
}

export function testChatKgcResponseContractPromptEnforcesComputingFlowShape() {
  const prompt = CHAT_BASE_KGC_RESPONSE_CONTRACT_PROMPT
  const template = readBaseTemplateSample()
  const requiredSnippets = [
    'kgc-ai-pipeline-chat-response-base-template.md',
    'pipeline[*].node MUST match flow.nodes[*].id',
    'IDs EXACTLY — this triple-linkage is the machine-readable contract.',
    'Node IDs other than the five canonical in the base template:',
    'n-trigger, n-pack, n-process, n-validate, n-deliver',
    'BASE TEMPLATE EXCEPTION: Tier B domain identity keys',
    'V-07  Confidence enum: values must be exactly low, medium, or high.',
    'position: on any flow: node (auto-layout owns placement)',
    'Missing ## Customization Guide section in any base template output',
  ]
  requiredSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected KGC response contract prompt to include: ${snippet}`)
    }
  })

  const templateSnippets = [
    'runtime:',
    'pipeline:',
    'mermaid: |',
    'flow:',
    '## Customization Guide',
    '@edge:n-validate:correction→n-process:correction',
  ]
  templateSnippets.forEach(snippet => {
    if (!template.includes(snippet)) {
      throw new Error(`Expected base template fixture to include snippet: ${snippet}`)
    }
  })
}

export function testBuildKgcStructuredTurnProducesSampleCompatibleSections() {
  const longAssistant = [
    'This is a long assistant payload that should not be truncated in the KGC turn.',
    'It may include markdown like **bold**, and even triple backticks ``` without breaking YAML.',
    'UNIQUE_TAIL_9f4c2a',
  ].join('\n')
  const doc = buildKgcStructuredTurn({
    timestampMs: Date.UTC(2026, 3, 15, 12, 34, 56),
    requestText: 'Summarize the active graph workspace',
    assistantText: longAssistant,
  })
  if (!isKgcStructuredMarkdown(doc)) {
    throw new Error('Expected synthesized KGC turn markdown to satisfy the structured KGC validator')
  }
  const requiredSnippets = [
    '---',
    '# ── DOCUMENT IDENTITY',
    'doc:',
    'doc:kgc:turn:',
    '# ── VARIABLES (type `@` to open CRUD toolbar)',
    'nodes:',
    '@node:',
    'edges:',
    '@edge:',
    'flow:',
    'computed:   false',
  ]
  requiredSnippets.forEach(snippet => {
    if (!doc.includes(snippet)) {
      throw new Error(`Expected synthesized KGC turn to include: ${snippet}`)
    }
  })

  if (!doc.includes('UNIQUE_TAIL_9f4c2a')) {
    throw new Error('Expected synthesized KGC turn to preserve full assistant payload in markdown body')
  }
  if (doc.includes('{{solution_md}}')) {
    throw new Error('Expected synthesized KGC turn to place the actual assistant content in the markdown body, not a {{solution_md}} shell')
  }
  if (/^\s*solution:\s*["']?.*\{\{[^}]+\}\}.*["']?\s*$/m.test(doc)) {
    throw new Error('Expected synthesized KGC turn to keep frontmatter solution scalar concrete (no template refs)')
  }

  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-turn.md', doc)
  if (!parsed) throw new Error('Expected synthesized KGC turn to parse as a frontmatter flow graph')
  const nodes = parsed.graphData.nodes || []
  const edges = parsed.graphData.edges || []
  if (nodes.length < 2) throw new Error(`Expected >=2 parsed nodes, got ${nodes.length}`)
  if (edges.length < 1) throw new Error(`Expected >=1 parsed edges, got ${edges.length}`)
}

export function testIsKgcStructuredMarkdownRejectsTemplateRefInSolutionScalar() {
  const invalid = [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    '  id: "doc:kgc:turn:20260416120000"',
    '  title: "chatKnowgrph turn"',
    '  type: chatKnowgrph',
    '  version: "1.0.0"',
    '  created: "2026-04-16"',
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    'subject: "linkage test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "{{solution}}"',
    'request_md: |',
    '  run linkage validation',
    'solution_md: |',
    '  linkage validation output',
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    'nodes:',
    '  - @node:n-request: { label: "{{subject}}", type: input }',
    '  - @node:n-response: { label: "{{solution}}", type: output }',
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    '  - @edge:n-request:turn → n-response:turn',
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    'flow:',
    '  direction: LR',
    '  computed: false',
    '  nodes:',
    '    - id: n-request',
    '      type: input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        text: "{{subject}}"',
    '    - id: n-response',
    '      type: output',
    '      label: "{{solution}}"',
    '      position: { x: 200, y: 0 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        text: "{{solution}}"',
    '  edges:',
    '    - source: n-request.turn',
    '      target: n-response.turn',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    'Valid body content',
  ].join('\n')
  if (isKgcStructuredMarkdown(invalid)) {
    throw new Error('Expected KGC structured validator to reject template refs in required frontmatter scalars')
  }
}

export function testIsKgcStructuredMarkdownRejectsBodyRefsMissingFromFrontmatter() {
  const invalid = [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    '  id: "doc:kgc:turn:20260416120000"',
    '  title: "chatKnowgrph turn"',
    '  type: chatKnowgrph',
    '  version: "1.0.0"',
    '  created: "2026-04-16"',
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    'subject: "linkage test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "verify linkage"',
    'request_md: |',
    '  run linkage validation',
    'solution_md: |',
    '  linkage validation output',
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    'nodes:',
    '  - @node:n-request: { label: "{{subject}}", type: input }',
    '  - @node:n-response: { label: "{{solution}}", type: output }',
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    '  - @edge:n-request:turn → n-response:turn',
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    'flow:',
    '  direction: LR',
    '  computed: false',
    '  nodes:',
    '    - id: n-request',
    '      type: input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        text: "{{subject}}"',
    '    - id: n-response',
    '      type: output',
    '      label: "{{solution}}"',
    '      position: { x: 200, y: 0 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        text: "{{solution}}"',
    '  edges:',
    '    - source: n-request.turn',
    '      target: n-response.turn',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    'Use unresolved linkage key: {{missing_key}}',
  ].join('\n')
  if (isKgcStructuredMarkdown(invalid)) {
    throw new Error('Expected KGC structured validator to reject markdown body refs missing from frontmatter keys')
  }
}

export function testIsKgcStructuredMarkdownRejectsSnippetOnlyPseudoKgc() {
  const invalid = [
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "bad"',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "A", type: input }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '---',
  ].join('\n')
  if (isKgcStructuredMarkdown(invalid)) {
    throw new Error('Expected snippet-only pseudo KGC markdown to fail strict validation')
  }
}

export function testNormalizeKgcAssistantBodyForStorageFallsBackToDeterministicTurn() {
  const invalidAssistant = [
    '```kgc',
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "invalid"',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "A", type: input }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '---',
    '```',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 15, 12, 35, 56),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (!normalized.includes('# ── DOCUMENT IDENTITY')) {
    throw new Error('Expected invalid assistant markdown to fall back to canonical KGC document shape')
  }
  if (normalized.includes('```kgc') || normalized.includes('\\`\\`\\`kgc')) {
    throw new Error('Expected normalized fallback turn to strip fenced kgc markers from canonical content')
  }
  if (/\n\s*kgc\s*\n/.test(normalized) || normalized.includes('\\---')) {
    throw new Error('Expected normalized fallback turn to strip residual kgc / \\--- artifact lines from canonical content')
  }
}

export function testNormalizeKgcAssistantBodyForStorageExtractsBodyFromNestedKgcAttempt() {
  const invalidAssistant = [
    '```kgc',
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "nested body test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "body extraction"',
    'request_md: |',
    '  test request',
    'solution_md: |',
    '  short summary',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "{{subject}}", type: input }',
    '  - @node:n-b: { label: "{{solution}}", type: output }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '  nodes:',
    '    - id: n-a',
    '      type: input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        text: "{{subject}}"',
    '    - id: n-b',
    '      type: output',
    '      label: "{{solution}}"',
    '      position: { x: 10, y: 0 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        text: "{{solution}}"',
    '  edges:',
    '    - source: n-a.turn',
    '      target: n-b.turn',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    'Useful extracted body content.',
    '```',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 16, 13, 14, 52),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (!normalized.includes('Useful extracted body content.')) {
    throw new Error('Expected fallback normalization to extract useful markdown body content from nested kgc attempt')
  }
  if (normalized.includes('```kgc') || normalized.includes('\\`\\`\\`kgc')) {
    throw new Error('Expected extracted-body fallback to omit fenced kgc markers')
  }
  if (/\n\s*kgc\s*\n/.test(normalized) || normalized.includes('\\---')) {
    throw new Error('Expected extracted-body fallback to omit residual kgc / \\--- artifact lines')
  }
}

export function testNormalizeKgcAssistantBodyForStorageExtractsBodyFromEmbeddedMalformedKgcArtifact() {
  const invalidAssistant = [
    '- Short useful summary line.',
    '',
    'kgc',
    '\\---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "artifact test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "artifact body extraction"',
    'request_md: |',
    '  test request',
    'solution_md: |',
    '  _Streaming..._',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "{{subject}}", type: input }',
    '  - @node:n-b: { label: "{{solution}}", type: output }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '\\---',
    '',
    '## Bootstrap plan',
    '',
    '### MVP',
    '- Keep the useful body content.',
    '- Strip malformed kgc artifacts.',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 16, 13, 46, 1),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (!normalized.includes('## Bootstrap plan')) {
    throw new Error('Expected fallback normalization to extract embedded useful markdown body from malformed kgc artifact')
  }
  if (normalized.includes('Previous invalid KGC attempt was omitted')) {
    throw new Error('Expected embedded useful body to win over omission-note fallback')
  }
  if (/\n\s*kgc\s*\n/.test(normalized) || normalized.includes('\\---')) {
    throw new Error('Expected extracted embedded body to omit kgc / \\--- artifact lines')
  }
}

export function testNormalizeKgcAssistantBodyForStorageStripsRecoveredDocumentShell() {
  const invalidAssistant = [
    '```kgc',
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "artifact test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "artifact body extraction"',
    'request_md: |',
    '  test request',
    'solution_md: |',
    '  _Streaming..._',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "{{subject}}", type: input }',
    '  - @node:n-b: { label: "{{solution}}", type: output }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    '### MVP',
    '- Keep the useful body content.',
    '- Strip malformed kgc artifacts.',
    '```',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 16, 14, 34, 17),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (!normalized.includes('### MVP')) {
    throw new Error('Expected recovered body content to remain present after stripping the embedded document shell')
  }
  if (normalized.includes('## Solution\n# {{subject}}') || normalized.includes('## Solution\n## {{subject}}')) {
    throw new Error('Expected fallback normalization to strip duplicated recovered document title shell from body content')
  }
}

export function testNormalizeKgcAssistantBodyForStorageUsesFrontmatterSolutionMdWhenBodyMissing() {
  const invalidAssistant = [
    '```kgc',
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "frontmatter fallback test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "frontmatter scalar"',
    'request_md: |',
    '  request text',
    'solution_md: |',
    '  ### Salvaged from solution_md',
    '  - keep this useful content',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "{{subject}}", type: input }',
    '  - @node:n-b: { label: "{{solution}}", type: output }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '```',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 16, 16, 8, 35),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (!normalized.includes('### Salvaged from solution_md')) {
    throw new Error('Expected fallback normalization to salvage useful content from frontmatter solution_md when body extraction fails')
  }
  if (normalized.includes('Previous invalid KGC attempt was omitted')) {
    throw new Error('Expected frontmatter solution_md salvage to avoid omission-note fallback')
  }
}

export function testNormalizeKgcAssistantBodyForStorageStripsSolutionPlaceholderHeading() {
  const invalidAssistant = [
    '```kgc',
    '---',
    '# ── DOCUMENT IDENTITY ──',
    'doc:',
    '  id: "doc:invalid"',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ──',
    'subject: "placeholder heading test"',
    'action: "respond"',
    'goal: "persist"',
    'solution: "placeholder heading"',
    'request_md: |',
    '  request text',
    'solution_md: |',
    '  short summary',
    '# ── NODES ──',
    'nodes:',
    '  - @node:n-a: { label: "{{subject}}", type: input }',
    '  - @node:n-b: { label: "{{solution}}", type: output }',
    '# ── EDGES ──',
    'edges:',
    '  - @edge:n-a:turn → n-b:turn',
    '# ── FLOW EDITOR (interactive + computable) ──',
    'flow:',
    '  computed: false',
    '---',
    '',
    '## {{solution}}',
    '',
    '### Execution',
    '- Keep concrete heading content.',
    '```',
  ].join('\n')
  const normalized = normalizeKgcAssistantBodyForStorage({
    timestampMs: Date.UTC(2026, 3, 16, 17, 10, 12),
    requestText: 'Explain the active graph',
    assistantText: invalidAssistant,
  })
  if (normalized.includes('## {{solution}}')) {
    throw new Error('Expected fallback normalization to strip placeholder-only solution headings from recovered body')
  }
  if (!normalized.includes('### Execution')) {
    throw new Error('Expected fallback normalization to preserve useful concrete body sections')
  }
}

export function testBuildKgcWorkspaceDocumentKeepsLatestTurnParseableWithHistoryTrail() {
  const canonical = buildKgcStructuredTurn({
    timestampMs: Date.UTC(2026, 3, 16, 8, 0, 0),
    requestText: 'Map the active workspace into flow, table, and kanban surfaces',
    assistantText: 'Build a canonical KGC turn with one parseable leading document and no appended history trailer.',
  })
  const workspaceDoc = buildKgcWorkspaceDocument({
    canonicalKgc: canonical,
    historyBody: [
      '## 2026-04-16 08:00:00',
      '',
      'Trace-ID: trace-1',
      '',
      'Provider: test',
      '',
      '### user',
      '```text',
      'Map the active workspace into flow, table, and kanban surfaces',
      '```',
      '',
      '### assistant',
      '```kgc',
      canonical,
      '```',
    ].join('\n'),
  })
  if (workspaceDoc.includes('<!-- kg-chat-history -->') || workspaceDoc.includes('# Chat turns')) {
    throw new Error('Expected chatKnowgrph workspace document to omit append-only history trailer content')
  }
  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-workspace.md', workspaceDoc)
  if (!parsed) throw new Error('Expected composed KGC workspace document to stay parseable from the leading canonical KGC block')
  const nodes = parsed.graphData.nodes || []
  const edges = parsed.graphData.edges || []
  if (nodes.length < 2) throw new Error(`Expected composed workspace document to keep >=2 parsed nodes, got ${nodes.length}`)
  if (edges.length < 1) throw new Error(`Expected composed workspace document to keep >=1 parsed edge, got ${edges.length}`)
}

export function testValidateChatMarkdownRejectsThinSolutionMdForComplexRequest() {
  const markdown = [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    '  id: "doc:kgc:test:thin"',
    '  title: "chatKnowgrph turn"',
    '  type: chatKnowgrph',
    '  version: "1.0.0"',
    '  created: "2026-04-16"',
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    'subject: "Knowledge Graph Canvas pitch deck request"',
    'action: "respond to the active request"',
    'goal: "persist one ingestible chat turn"',
    'solution: "short summary"',
    'request_md: |',
    '  Recommend: Knowledge Graph Canvas product; Pitch Deck+PRD+TAD, TCO; Solo founder; zero budget; Use Case -> Problem -> Solution; User Flow+Work Flow+Data Flow; monetization; Swipe payment flow.',
    'solution_md: |',
    '  Drafted a short summary only.',
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    'nodes:',
    '  - @node:n-request: { label: "{{subject}}", type: input }',
    '  - @node:n-response: { label: "{{solution}}", type: output }',
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    '  - @edge:n-request:turn → n-response:turn',
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    'flow:',
    '  direction: LR',
    '  computed: false',
    '  nodes:',
    '    - id: n-request',
    '      type: input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        text: "{{subject}}"',
    '    - id: n-response',
    '      type: output',
    '      label: "{{solution}}"',
    '      position: { x: 200, y: 0 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        text: "{{solution}}"',
    '  edges:',
    '    - source: n-request.turn',
    '      target: n-response.turn',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    '{{solution_md}}',
  ].join('\n')
  const validation = validateChatMarkdown({
    markdown,
    resolvableVarKeys: buildResolvableVarKeySet({ frontmatter: null, markdown }),
  })
  if (validation.ok) {
    throw new Error('Expected thin solution_md payload to fail chat markdown validation for a complex request')
  }
  if (validation.failedRuleId !== 'V-03') {
    throw new Error(`Expected V-03 failure for thin linked body content, got ${validation.failedRuleId || 'none'}`)
  }
}

export function testValidateChatMarkdownRejectsNestedCodeFencesInsideKgc() {
  const markdown = [
    '---',
    '# ── DOCUMENT IDENTITY ────────────────────────────────────────────────────────',
    'doc:',
    '  id: "doc:kgc:test:nested-fence"',
    '  title: "chatKnowgrph turn"',
    '  type: chatKnowgrph',
    '  version: "1.0.0"',
    '  created: "2026-04-16"',
    '',
    '# ── VARIABLES (type `@` to open CRUD toolbar) ────────────────────────────────',
    'subject: "nested fence test"',
    'action: "respond"',
    'goal: "persist one ingestible chat turn"',
    'solution: "invalid nested fence"',
    'request_md: |',
    '  test request',
    'solution_md: |',
    '  ```kgc',
    '  ---',
    '  bad: true',
    '  ```',
    '',
    '# ── NODES ────────────────────────────────────────────────────────────────────',
    'nodes:',
    '  - @node:n-request: { label: "{{subject}}", type: input }',
    '  - @node:n-response: { label: "{{solution}}", type: output }',
    '',
    '# ── EDGES ────────────────────────────────────────────────────────────────────',
    'edges:',
    '  - @edge:n-request:turn → n-response:turn',
    '',
    '# ── FLOW EDITOR (interactive + computable) ───────────────────────────────────',
    'flow:',
    '  direction: LR',
    '  computed: false',
    '  nodes:',
    '    - id: n-request',
    '      type: input',
    '      label: "{{subject}}"',
    '      position: { x: 0, y: 0 }',
    '      handles:',
    '        source: [turn]',
    '      data:',
    '        text: "{{subject}}"',
    '    - id: n-response',
    '      type: output',
    '      label: "{{solution}}"',
    '      position: { x: 200, y: 0 }',
    '      handles:',
    '        target: [turn]',
    '      data:',
    '        text: "{{solution}}"',
    '  edges:',
    '    - source: n-request.turn',
    '      target: n-response.turn',
    '---',
    '',
    '# {{subject}}',
    '',
    '## Intent',
    '- Action: {{action}}',
    '- Goal: {{goal}}',
    '',
    '## Request',
    '{{request_md}}',
    '',
    '## Solution',
    '{{solution_md}}',
  ].join('\n')
  const validation = validateChatMarkdown({
    markdown,
    resolvableVarKeys: buildResolvableVarKeySet({ frontmatter: null, markdown }),
  })
  if (validation.ok) {
    throw new Error('Expected nested fenced block inside KGC to fail validation')
  }
  if (validation.failedRuleId !== 'V-03') {
    throw new Error(`Expected V-03 failure for nested fenced block, got ${validation.failedRuleId || 'none'}`)
  }
}
