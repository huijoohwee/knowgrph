import { buildKgcStructuredTurn, isKgcStructuredMarkdown } from '@/features/chat/chatHistoryWorkspace'
import { buildResolvableVarKeySet, validateChatMarkdown } from '@/features/chat/chatMarkdownValidation'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testKgcTurnGenerationIsParseableAndStable() {
  const md = buildKgcStructuredTurn({
    timestampMs: Date.UTC(2026, 3, 16, 16, 49, 20),
    requestText: 'RECOMMEND: Solo founder; zero budget, bootstrap, organic growth; Knowledge Graph Canvas product; Pitch Deck+PRD+TAD, TCO; Use Case -> Problem -> Solution; User Flow+Work Flow+Data Flow; B2C monetization ideas; Swipe payment flow; MCP; OpenClaw; skills marketplace',
    assistantText: 'Validation failed after retry exhaustion. Here is the corrected guidance: pick one artifact promise, implement canvas with typed nodes and edges, compile into PRD + TAD sections, export shareable bundles, add RxDB persistence and versioning, then gate publish and integrations using Swipe checkout plus MCP and OpenClaw hooks.',
  })

  assert(isKgcStructuredMarkdown(md), 'expected generated KGC turn to be structurally parseable')

  const resolvableVarKeys = buildResolvableVarKeySet({ frontmatter: null, markdown: md })
  const validation = validateChatMarkdown({ markdown: md, resolvableVarKeys })
  assert(validation.ok, `expected generated KGC turn to pass validation, got: ${validation.errors[0]?.message || 'unknown error'}`)

  const nodeIdMatches = Array.from(md.matchAll(/@node:(n-[a-z0-9-]+)\s*:/g)).map(m => String(m[1] || ''))
  assert(nodeIdMatches.length >= 2, 'expected at least two @node ids')
  for (const id of nodeIdMatches) {
    assert(!id.endsWith('-'), `expected @node id to not end with '-', got: ${id}`)
  }

  const flowIdMatches = Array.from(md.matchAll(/^\s*-\s+id:\s+(n-[a-z0-9-]+)\s*$/gm)).map(m => String(m[1] || ''))
  assert(flowIdMatches.length >= 2, 'expected at least two flow node ids')
  for (const id of flowIdMatches) {
    assert(!id.endsWith('-'), `expected flow node id to not end with '-', got: ${id}`)
  }
}
