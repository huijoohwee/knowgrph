import {
  AGENTIC_OS_DOCS_MCP_BRIDGE_PATH,
  AGENTIC_OS_DOCS_MCP_TOOL_NAME,
  type AgenticOsDocsMcpBridgeSuccess,
} from '@/features/agent-ready/agenticOsDocsMcpBridgeContract'
import { invokeAgenticOsDocsMcpBridge } from '@/features/agent-ready/agenticOsDocsMcpClient'
import {
  buildRichMediaDeliverablesGenerationPrompt,
  collectRichMediaDeliverablesInvocationTokens,
  parseRichMediaDeliverablesResponse,
} from '@/features/rich-media/richMediaDeliverablesRun'
import { containsMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { buildRichMediaPanelOverlayState } from '@/lib/render/richMediaPanelState'
import { resolveStoryboardWidgetTextGenerationPrompts } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRunInputs'

const structuredDeliverablesResponse = JSON.stringify({
  structuredContent: {
    panels: [{
      id: 'slide-deck',
      title: 'Slide Deck',
      kind: 'text',
      richMediaDeliverableKind: 'slide-deck',
      output: '# Investment case\n\nSource-grounded thesis.\n\n---\n\n# Risks\n\nExplicit downside risks.',
    }],
    tables: [{
      id: 'financial-model',
      title: 'Financial Model',
      kind: 'table',
      richMediaDeliverableKind: 'financial-model',
      columns: ['Metric', 'Base case', 'Downside', 'Upside', 'Source / assumption'],
      rows: [['Revenue', '100', '80', '120', 'Connected source']],
    }],
  },
})

export function testRichMediaDeliverablesParsesReusableMarkdownDeckAndFinancialModel() {
  const result = parseRichMediaDeliverablesResponse(structuredDeliverablesResponse)
  if (splitSlides(result.slideDeckMarkdown).slides.filter(slide => slide.text.trim()).length !== 2) {
    throw new Error(`expected two reusable Markdown slides, got ${result.slideDeckMarkdown}`)
  }
  if (!containsMarkdownPipeTable(result.financialModelMarkdown) || /<table\b/i.test(result.financialModelMarkdown)) {
    throw new Error(`expected a Markdown-only financial model table, got ${result.financialModelMarkdown}`)
  }
  const panel = buildRichMediaPanelOverlayState({
    node: {
      id: 'deck-panel',
      type: 'RichMediaPanel',
      label: 'Slide Deck',
      properties: {
        output: result.slideDeckMarkdown,
        richMediaActiveTab: 'text',
        markdownPresentationMode: true,
      },
    },
  })
  if (!panel?.hasText || panel.markdownPresentationMode !== true) {
    throw new Error(`expected Rich Media deck to reuse presentation mode, got ${JSON.stringify(panel)}`)
  }
}

export function testRichMediaDeliverablesBuildsBoundedMcpBackedGenerationPrompt() {
  const instructions = '/investment-research-agent @source.body #runtime-ready /investment-research-agent'
  const tokens = collectRichMediaDeliverablesInvocationTokens(instructions)
  if (tokens.join(' ') !== '/investment-research-agent @source.body #runtime-ready') {
    throw new Error(`expected distinct / @ # invocation tokens, got ${tokens.join(' ')}`)
  }
  const mcpResponse: AgenticOsDocsMcpBridgeSuccess = {
    ok: true,
    tool: AGENTIC_OS_DOCS_MCP_TOOL_NAME,
    mcpInvoked: true,
    invocations: tokens.map(token => ({ token, ok: true, summary: `Resolved ${token}` })),
  }
  const prompt = buildRichMediaDeliverablesGenerationPrompt({
    sourceMarkdown: 'Connected source fact: budget is RM100,000.',
    instructions,
    mcpResponse,
  })
  for (const expected of ['Return JSON only', 'Markdown pipe table', 'RM100,000', AGENTIC_OS_DOCS_MCP_TOOL_NAME, 'mcpInvoked']) {
    if (!prompt.includes(expected)) throw new Error(`expected deliverables prompt to include ${expected}`)
  }
}

export function testRichMediaDeliverablesRunUsesConnectedSourceAndKeepsAuthoredInstructions() {
  const prompts = resolveStoryboardWidgetTextGenerationPrompts({
    authoredPrompt: '/investment-research-agent\nGenerate a slide deck and financial model.',
    connectedValue: '# Generated Result\n\nRM100,000 budget.',
  })
  if (
    !prompts.authoredPrompt.startsWith('/investment-research-agent')
    || prompts.connectedPrompt !== '# Generated Result\n\nRM100,000 budget.'
    || prompts.prompt !== prompts.connectedPrompt
  ) {
    throw new Error(`expected Widget Card Run to consume the connected Rich Media value without losing authored instructions, got ${JSON.stringify(prompts)}`)
  }
}

export function testRichMediaDeliverablesRejectsPartialStructuredOutput() {
  let rejected = false
  try {
    parseRichMediaDeliverablesResponse(JSON.stringify({
      structuredContent: {
        panels: [{ id: 'slide-deck', title: 'Slide Deck', output: '# Only one slide' }],
        tables: [{ id: 'financial-model', title: 'Financial Model', kind: 'table', columns: ['Metric'], rows: [['1']] }],
      },
    }))
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('expected partial deliverables output to fail before either Rich Media panel is published')
}

export async function testAgenticOsDocsMcpClientPostsAllowlistedInvocationTokens() {
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  const response = await invokeAgenticOsDocsMcpBridge({
    invocationTokens: ['/investment-research-agent', '@source.body', '#runtime-ready', 'invalid-tool'],
  }, (async (url, init) => {
    requestUrl = String(url)
    requestInit = init
    return new Response(JSON.stringify({
      ok: true,
      tool: AGENTIC_OS_DOCS_MCP_TOOL_NAME,
      mcpInvoked: true,
      invocations: [{ token: '/investment-research-agent', ok: true }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch)
  const body = JSON.parse(String(requestInit?.body || '{}')) as { invocationTokens?: unknown }
  if (
    requestUrl !== AGENTIC_OS_DOCS_MCP_BRIDGE_PATH
    || requestInit?.method !== 'POST'
    || JSON.stringify(body.invocationTokens) !== JSON.stringify(['/investment-research-agent', '@source.body', '#runtime-ready'])
    || response.mcpInvoked !== true
  ) {
    throw new Error(`expected bounded same-origin docs MCP invocation, got ${JSON.stringify({ requestUrl, requestInit, body, response })}`)
  }
}
