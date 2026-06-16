import type { JSONValue } from '@/lib/graph/types'
import {
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { analyzeKgcRequest, sanitizeRequestIntent, sanitizeScalar } from './chatKgcRequestProfile'
import { buildNamedTermSummary, fallbackArtifact } from './chatHistoryWorkspace.kgc.fallbackSections'
import type { ChatResponseStructuredSurface } from './chatResponseStructuredContent'
import { STRUCTURED_SURFACE_INLINE_COMPUTE_SOURCE } from './chatResponseStructuredCompute'

export const summariseAssistantSignal = (assistantText: string): string => {
  const text = String(assistantText || '')
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text.startsWith('---')) return ''
  return sanitizeScalar(text, 220)
}

export const isTraceOnlyAssistantText = (assistantText: string): boolean => {
  const text = String(assistantText || '')
  return /Provider Stream Trace/i.test(text) && /did not return final assistant text/i.test(text)
}

export const hasSubstantiveAssistantMarkdown = (assistantText: string): boolean => {
  const assistantMarkdown = String(assistantText || '').replace(/\r\n/g, '\n').trim()
  return Boolean(
    assistantMarkdown
    && !assistantMarkdown.startsWith('---')
    && !isTraceOnlyAssistantText(assistantMarkdown)
    && assistantMarkdown !== 'No response content.'
  )
}

export const hasCompleteAssistantMarkdownAnswer = (assistantText: string): boolean => {
  if (!hasSubstantiveAssistantMarkdown(assistantText)) return false
  const assistantMarkdown = String(assistantText || '').replace(/\r\n/g, '\n').trim()
  const wordCount = assistantMarkdown.split(/\s+/).filter(Boolean).length
  return wordCount >= 80 || /^#{1,3}\s+\S+/m.test(assistantMarkdown) || /\n\s*\n/.test(assistantMarkdown)
}

const escapeHtml = (value: unknown): string => String(value || '').replace(/[&<>"']/g, ch => {
  if (ch === '&') return '&amp;'
  if (ch === '<') return '&lt;'
  if (ch === '>') return '&gt;'
  if (ch === '"') return '&quot;'
  return '&#39;'
})

export const resolveFallbackCanvas2dRenderer = (profile: ReturnType<typeof analyzeKgcRequest>): string =>
  profile.signals.strybldr || profile.signals.storytree ? 'storyboard' : 'flowEditor'

export const shouldMaterializeHeadlessResponseSurface = (profile: ReturnType<typeof analyzeKgcRequest>): boolean =>
  profile.signals.headlessStructured ||
  profile.signals.strybldr ||
  profile.signals.storytree ||
  profile.signals.gitGraph ||
  profile.signals.gantt ||
  profile.signals.richMediaPanels ||
  profile.signals.mcp

export const buildResponseStatus = (assistantText: string): string => {
  if (isTraceOnlyAssistantText(assistantText)) return 'trace_only'
  if (summariseAssistantSignal(assistantText)) return 'assistant_signal'
  return 'request_profile'
}

export const buildResponseMarkdownLines = (args: {
  profile: ReturnType<typeof analyzeKgcRequest>
  assistantText: string
}): string[] => {
  const assistantMarkdown = String(args.assistantText || '').replace(/\r\n/g, '\n').trim()
  if (
    hasSubstantiveAssistantMarkdown(assistantMarkdown)
  ) {
    return assistantMarkdown.split('\n').map(line => String(line || '').replace(/^(#{1,2})(\s+)/, '###$2'))
  }
  const traceOnly = isTraceOnlyAssistantText(args.assistantText)
  const assistantSignal = traceOnly ? '' : summariseAssistantSignal(args.assistantText)
  const namedTerms = buildNamedTermSummary(args.profile)
  const artifact = fallbackArtifact(args.profile.artifact)
  const intent = sanitizeRequestIntent(args.profile.intent, 320) || 'Prompt unavailable.'
  const resultLine = traceOnly
    ? 'The provider returned trace/tool signals but no final assistant text. This document does not invent the missing answer; no answer is backfilled. Rerun the request or inspect the trace artifact.'
    : assistantSignal
      ? `Partial assistant signal: ${assistantSignal}. No answer is backfilled beyond the provider text.`
      : 'No final assistant answer was available. No answer is backfilled.'
  return [
    '### Result',
    '',
    resultLine,
    '',
    '### Request',
    '',
    `- Intent: ${intent}`,
    ...(namedTerms ? [`- Named terms: ${namedTerms}`] : []),
    `- Artifact: ${artifact}`,
  ]
}

export const buildResponseMarkdown = (args: {
  profile: ReturnType<typeof analyzeKgcRequest>
  assistantText: string
}): string => buildResponseMarkdownLines(args).join('\n')

const buildResponseSrcDoc = (markdown: string): string => (
  `<section data-kg-headless-response="1"><h1>Headless response</h1><pre>${escapeHtml(markdown)}</pre></section>`
)

export const buildHeadlessResponseSurface = (args: {
  profile: ReturnType<typeof analyzeKgcRequest>
  assistantText: string
}): ChatResponseStructuredSurface | null => {
  if (!shouldMaterializeHeadlessResponseSurface(args.profile)) return null
  const markdown = buildResponseMarkdown(args)
  const renderer = resolveFallbackCanvas2dRenderer(args.profile)
  const outputSrcDoc = buildResponseSrcDoc(markdown)
  const commonPanelProperties = {
    'chat:structuredContent': true,
    'flow:widgetFormId': FLOW_RICH_MEDIA_PANEL_FORM_ID,
    'flow:widgetTypeId': FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
    richMediaActiveTab: 'html',
    media_interactive: true,
  } satisfies Record<string, JSONValue>
  return {
    frontmatter: {
      kgCanvas2dRenderer: renderer,
      ...(args.profile.signals.strybldr || args.profile.signals.storytree ? { kgStrybldrStoryboard: true } : {}),
    },
    nodes: [
      {
        id: 'mcp-response-request-brief',
        label: 'Request Brief',
        nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        kind: 'text',
        sourceHandle: 'output',
        targetHandle: 'output',
        properties: {
          ...commonPanelProperties,
          'chat:structuredRole': 'card',
          richMediaActiveTab: 'text',
          media_interactive: false,
          output: markdown,
        },
      },
      {
        id: 'mcp-response-headless-compute',
        label: 'Headless Compute',
        nodeTypeId: FLOW_TEXT_GENERATION_NODE_TYPE_ID,
        kind: 'text',
        sourceHandle: 'outputSrcDoc',
        targetHandle: 'prompt_in',
        properties: {
          'chat:structuredContent': true,
          'chat:structuredRole': 'widget',
          'flow:widgetFormId': 'textGeneration',
          'flow:widgetTypeId': 'default',
          'flow:compute': STRUCTURED_SURFACE_INLINE_COMPUTE_SOURCE,
          prompt: 'Headless structured response compute runner',
        },
      },
      {
        id: 'mcp-response-rich-media-panel',
        label: 'Response Rich Media Panel',
        nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
        kind: 'html',
        sourceHandle: 'outputSrcDoc',
        targetHandle: 'outputSrcDoc',
        properties: {
          ...commonPanelProperties,
          'chat:structuredRole': 'panel',
          outputSrcDoc,
        },
      },
    ],
    edges: [
      {
        id: 'e-mcp-response-brief-to-compute',
        source: 'mcp-response-request-brief',
        target: 'mcp-response-headless-compute',
        sourceHandle: 'output',
        targetHandle: 'prompt_in',
        label: 'output->prompt_in',
      },
      {
        id: 'e-mcp-response-compute-to-panel',
        source: 'mcp-response-headless-compute',
        target: 'mcp-response-rich-media-panel',
        sourceHandle: 'outputSrcDoc',
        targetHandle: 'outputSrcDoc',
        label: 'outputSrcDoc->outputSrcDoc',
      },
    ],
  }
}
