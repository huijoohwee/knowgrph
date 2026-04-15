import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CHAT_KGC_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_CONTRACT_PROMPT, CHAT_RESPONSE_PARAMETER_KEYS } from '@/features/chat/chatResponseContract'
import { buildKgcStructuredTurn, isKgcStructuredMarkdown } from '@/features/chat/chatHistoryWorkspace'
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
    'The `kgc` block MUST start with `---`',
    '`# ── DOCUMENT IDENTITY ──` then a `doc:` mapping',
    '`# ── VARIABLES (type `@` to open CRUD toolbar) ──`',
    '`# ── NODES ──`',
    '`# ── EDGES ──`',
    '`# ── FLOW EDITOR (interactive + computable) ──`',
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

  const parsed = tryParseMarkdownFrontmatterFlowGraph('kgc-turn.md', doc)
  if (!parsed) throw new Error('Expected synthesized KGC turn to parse as a frontmatter flow graph')
  const nodes = parsed.graphData.nodes || []
  const edges = parsed.graphData.edges || []
  if (nodes.length < 2) throw new Error(`Expected >=2 parsed nodes, got ${nodes.length}`)
  if (edges.length < 1) throw new Error(`Expected >=1 parsed edges, got ${edges.length}`)
}
