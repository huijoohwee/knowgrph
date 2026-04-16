import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CHAT_KGC_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_PARAMETER_KEYS } from '@/features/chat/chatResponseContract'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'
import { buildKgcStructuredTurn, buildKgcWorkspaceDocument, isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

const readComputingFlowSample = (): string => {
  const p = resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
  return readFileSync(p, 'utf8')
}

export function testChatResponseContractPromptIncludesMarkdownGuidelineAndSurfaceKeys() {
  const prompt = CHAT_RESPONSE_CONTRACT_PROMPT

  const requiredSnippets = [
    'markdown syntax guidelines',
    'Flow Editor (2D), Multi-dimensional Table, and Kanban',
    '`@node:*`, `@edge:*`, and `{{variable}}`',
    'ONE fenced `yaml` block with root key `response:`',
    'Never leave empty cells.',
    '`TBD` (unknown) or `—` (not applicable)',
  ]
  requiredSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to include: ${snippet}`)
    }
  })

  CHAT_RESPONSE_PARAMETER_KEYS.forEach(key => {
    if (!prompt.includes(`\`${key}\``)) {
      throw new Error(`Expected chat response contract prompt to include response key: ${key}`)
    }
  })
}

export function testChatResponseContractPromptStaysCompatibleWithComputingFlowSample() {
  const sample = readComputingFlowSample()
  const prompt = CHAT_RESPONSE_CONTRACT_PROMPT

  const sampleSnippets = ['flow:', '@node:', '@edge:', '{{subject}}', 'TBD']
  sampleSnippets.forEach(snippet => {
    if (!sample.includes(snippet)) {
      throw new Error(`Expected computing-flow sample fixture to include snippet: ${snippet}`)
    }
  })

  const promptSnippets = ['flow blocks', '@node:*', '@edge:*', '`{{variable}}`', '`TBD`', '`—`']
  promptSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected chat response contract prompt to cover sample-compatible token: ${snippet}`)
    }
  })
}

export function testChatKgcResponseContractPromptEnforcesComputingFlowShape() {
  const prompt = CHAT_KGC_RESPONSE_CONTRACT_PROMPT
  const requiredSnippets = [
    'exactly ONE fenced block with language tag `kgc`',
    'standalone parseable markdown document',
    'structured `kgc` block is the only persisted contract',
    'The `kgc` block MUST start with `---`',
    '`# ── DOCUMENT IDENTITY ──` then a `doc:` mapping',
    '`# ── VARIABLES (type `@` to open CRUD toolbar) ──`',
    '`request_md: |`, `solution_md: |`',
    '`# ── NODES ──`',
    '`# ── EDGES ──`',
    '`# ── FLOW EDITOR (interactive + computable) ──`',
    'include at least 2 flow nodes and 1 flow edge',
    '`TBD` or `—`',
    'Variable references must follow guideline syntax',
    'Annotation sigils, when used, must follow guideline-safe forms',
    'full useful answer, not a one-line summary or placeholder',
    'Never include fenced code blocks inside the `kgc` document',
  ]
  requiredSnippets.forEach(snippet => {
    if (!prompt.includes(snippet)) {
      throw new Error(`Expected KGC response contract prompt to include: ${snippet}`)
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

  if (!doc.includes('solution_md: |')) {
    throw new Error('Expected synthesized KGC turn to include a solution_md YAML block scalar')
  }
  if (!doc.includes('UNIQUE_TAIL_9f4c2a')) {
    throw new Error('Expected synthesized KGC turn to preserve full assistant payload in solution_md')
  }
  if (doc.includes('{{solution_md}}')) {
    throw new Error('Expected synthesized KGC turn to place the actual assistant content in the markdown body, not a {{solution_md}} shell')
  }

  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-turn.md', doc)
  if (!parsed) throw new Error('Expected synthesized KGC turn to parse as a frontmatter flow graph')
  const nodes = parsed.graphData.nodes || []
  const edges = parsed.graphData.edges || []
  if (nodes.length < 2) throw new Error(`Expected >=2 parsed nodes, got ${nodes.length}`)
  if (edges.length < 1) throw new Error(`Expected >=1 parsed edges, got ${edges.length}`)
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
  if (!isKgcStructuredMarkdown(normalized)) {
    throw new Error('Expected invalid assistant markdown to fall back to a valid structured KGC turn')
  }
  if (!normalized.includes('solution_md: |')) {
    throw new Error('Expected normalized fallback turn to preserve the full assistant body in solution_md')
  }
  if (normalized.includes('```kgc') || normalized.includes('\\`\\`\\`kgc')) {
    throw new Error('Expected normalized fallback turn to strip fenced kgc markers from canonical content')
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
