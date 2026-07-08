import {
  findAgenticOsInvocationByToken,
  type AgenticOsResolvedInvocation,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { isChatInvocationToken } from './chatInvocationRegistry'
import { parseChatSkillSlashInvocation, resolveChatSkillBySlashCommand } from './chatSkillRegistry'

export type ChatRuntimeInvocationRoute = {
  kind: 'agentic-os' | 'chat' | 'skill'
  token: string
  label: string
  summary: string
  sourcePath?: string
}

export type ChatRuntimeInvocationQuery = {
  raw: string
  query: string
  leadingRoute: ChatRuntimeInvocationRoute | null
}

const LEADING_INVOCATION_RX = /^([/#@][A-Za-z0-9_.-]+)(?:\s+([\s\S]*))?$/

const routeFromAgenticInvocation = (invocation: AgenticOsResolvedInvocation): ChatRuntimeInvocationRoute => ({
  kind: 'agentic-os',
  token: invocation.token,
  label: invocation.label,
  summary: invocation.summary,
  sourcePath: invocation.sourcePath,
})

const resolveLeadingRoute = (token: string, raw: string): ChatRuntimeInvocationRoute | null => {
  const skillInvocation = parseChatSkillSlashInvocation(raw)
  if (skillInvocation?.skill.slashCommand.toLowerCase() === token.toLowerCase()) {
    return {
      kind: 'skill',
      token: skillInvocation.skill.slashCommand,
      label: skillInvocation.skill.label,
      summary: skillInvocation.skill.summary,
    }
  }
  const skill = token.startsWith('/') ? resolveChatSkillBySlashCommand(token) : null
  if (skill) {
    return {
      kind: 'skill',
      token: skill.slashCommand,
      label: skill.label,
      summary: skill.summary,
    }
  }
  const agentic = findAgenticOsInvocationByToken(token)
  if (agentic) return routeFromAgenticInvocation(agentic)
  if (token.startsWith('#') && isChatInvocationToken(token)) {
    return {
      kind: 'chat',
      token,
      label: token.slice(1),
      summary: 'Chat invocation directive.',
    }
  }
  return null
}

export const resolveChatRuntimeInvocationQuery = (raw: unknown): ChatRuntimeInvocationQuery => {
  const text = String(raw || '').trim()
  if (!text) return { raw: '', query: '', leadingRoute: null }
  const match = text.match(LEADING_INVOCATION_RX)
  if (!match?.[1]) return { raw: text, query: text, leadingRoute: null }
  const leadingRoute = resolveLeadingRoute(match[1], text)
  if (!leadingRoute) return { raw: text, query: text, leadingRoute: null }
  return {
    raw: text,
    query: String(match[2] || '').trim(),
    leadingRoute,
  }
}

export const resolveChatRuntimeInvocationEffectiveQuery = (raw: unknown): string => {
  const runtimeQuery = resolveChatRuntimeInvocationQuery(raw)
  return runtimeQuery.leadingRoute && runtimeQuery.query
    ? resolveRuntimeInvocationResponsiveQuery(runtimeQuery)
    : runtimeQuery.raw
}

export const sanitizeRuntimeInvocationQueryText = (raw: unknown, maxChars = 320): string => (
  String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' [attached image] ')
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')
    .replace(/\bhttps?:\/\/\S+/gi, ' [url] ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
)

const normalizeInlineWhitespace = (raw: unknown): string =>
  String(raw || '').replace(/\s+/g, ' ').trim()

const appendTerminalPunctuation = (raw: unknown, punctuation: '.' | '?' = '.'): string => {
  const text = normalizeInlineWhitespace(raw)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}${punctuation}`
}

export const isRuntimeInvocationMediaOnlyQuery = (raw: unknown): boolean => {
  const sanitized = sanitizeRuntimeInvocationQueryText(raw, 320)
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return /^\[attached (?:image|video|audio|media)\](?: \[attached (?:image|video|audio|media)\])*$/.test(sanitized)
}

export const isChatRuntimeInvocationMediaOnlyRequest = (raw: unknown): boolean => {
  const runtimeQuery = resolveChatRuntimeInvocationQuery(raw)
  return Boolean(runtimeQuery.leadingRoute && runtimeQuery.query && isRuntimeInvocationMediaOnlyQuery(runtimeQuery.query))
}

const buildRuntimeInvocationMediaQuestion = (
  raw: unknown,
  options: { preserveMediaTokens?: boolean } = {},
): string => {
  const subject = options.preserveMediaTokens
    ? normalizeInlineWhitespace(raw)
    : sanitizeRuntimeInvocationQueryText(raw, 160)
  return `what's ${subject || '[attached media]'}`
}

const resolveRuntimeInvocationResponsiveQuery = (runtimeQuery: ChatRuntimeInvocationQuery): string => {
  if (!runtimeQuery.leadingRoute) return runtimeQuery.raw
  if (!runtimeQuery.query) return ''
  return isRuntimeInvocationMediaOnlyQuery(runtimeQuery.query)
    ? buildRuntimeInvocationMediaQuestion(runtimeQuery.query)
    : runtimeQuery.query
}

export const resolveChatRuntimeInvocationResponsiveQueryText = (raw: unknown): string => {
  return resolveRuntimeInvocationResponsiveQuery(resolveChatRuntimeInvocationQuery(raw))
}

const buildRuntimeInvocationMediaOnlyProviderText = (runtimeQuery: ChatRuntimeInvocationQuery): string => {
  const route = runtimeQuery.leadingRoute
  if (!route) return runtimeQuery.raw
  return [
    appendTerminalPunctuation(buildRuntimeInvocationMediaQuestion(runtimeQuery.query, { preserveMediaTokens: true }), '?'),
    appendTerminalPunctuation(`Use the answer as source context for ${route.label}`),
    appendTerminalPunctuation(route.summary),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const resolveChatRuntimeInvocationProviderMessageText = (raw: unknown): string => {
  const runtimeQuery = resolveChatRuntimeInvocationQuery(raw)
  if (!runtimeQuery.leadingRoute || !runtimeQuery.query) return runtimeQuery.raw
  return isRuntimeInvocationMediaOnlyQuery(runtimeQuery.query)
    ? buildRuntimeInvocationMediaOnlyProviderText(runtimeQuery)
    : runtimeQuery.query
}
