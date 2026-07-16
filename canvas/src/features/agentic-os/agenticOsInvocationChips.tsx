import React from 'react'
import {
  buildAgenticOsInvocationSourceTitle,
  findAgenticOsInvocationByToken,
  type AgenticOsResolvedInvocation,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { splitInlineKeywordChipTokens } from '@/features/markdown/ui/dataViewChipStyles'
import { readInvocationTokenKind, type InvocationTokenKind } from '@/lib/markdown/invocationTokens'
import { UI_INLINE_CHIP_LABEL_15CH_CLASSNAME, UI_INLINE_CHIP_SHELL_15CH_CLASSNAME, UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'

export const AGENTIC_OS_INVOCATION_CHIP_ATTR = 'data-kg-agentic-os-invocation-chip'
export const AGENTIC_OS_INVOCATION_TOKEN_ATTR = 'data-kg-agentic-os-invocation-token'
export const AGENTIC_OS_INVOCATION_SOURCE_ATTR = 'data-kg-agentic-os-invocation-source'

export const readAgenticOsInvocationTokenKind = (value: string): InvocationTokenKind | null => readInvocationTokenKind(value)

export function resolveAgenticOsInvocationToken(value: string): { invocation: AgenticOsResolvedInvocation; token: string } | null {
  const token = String(value || '').trim()
  if (!token || !readAgenticOsInvocationTokenKind(token)) return null
  const invocation = findAgenticOsInvocationByToken(token)
  if (!invocation) return null
  return { invocation, token }
}

export function buildAgenticOsInvocationChipAttrs(token: string): Record<string, string> | null {
  const resolved = resolveAgenticOsInvocationToken(token)
  if (!resolved) return null
  return {
    [AGENTIC_OS_INVOCATION_CHIP_ATTR]: '1',
    [AGENTIC_OS_INVOCATION_TOKEN_ATTR]: resolved.token,
    [AGENTIC_OS_INVOCATION_SOURCE_ATTR]: resolved.invocation.sourcePath,
  }
}

export function buildAgenticOsInvocationChipTitle(token: string): string {
  const resolved = resolveAgenticOsInvocationToken(token)
  return resolved ? buildAgenticOsInvocationSourceTitle(resolved.invocation) : ''
}

export function renderAgenticOsInvocationAnchor(args: {
  token: string
  className: string
  children: React.ReactNode
}): React.ReactNode | null {
  const resolved = resolveAgenticOsInvocationToken(args.token)
  if (!resolved) return null
  const attrs = buildAgenticOsInvocationChipAttrs(resolved.token)
  if (!attrs) return null
  return (
    <a
      href={resolved.invocation.sourcePath}
      target="_blank"
      rel="noopener noreferrer"
      className={args.className}
      title={buildAgenticOsInvocationSourceTitle(resolved.invocation)}
      data-kg-card-inline-keyword-pill="1"
      {...attrs}
    >
      {args.children}
    </a>
  )
}

export function renderAgenticOsInvocationKeywordChip(args: {
  value: string
  className: string
  sourceLink?: boolean
}): React.ReactNode | null {
  const token = String(args.value || '').trim()
  if (args.sourceLink === false) {
    const resolved = resolveAgenticOsInvocationToken(token)
    if (!resolved) return null
    const attrs = buildAgenticOsInvocationChipAttrs(resolved.token)
    if (!attrs) return null
    return (
      <span
        className={`${args.className} ${UI_INLINE_CHIP_SHELL_15CH_CLASSNAME}`}
        title={buildAgenticOsInvocationSourceTitle(resolved.invocation)}
        data-kg-card-inline-keyword-pill="1"
        {...attrs}
      >
        <span className={`${UI_TEXT_TRUNCATE_CHIP} ${UI_INLINE_CHIP_LABEL_15CH_CLASSNAME}`}>{token}</span>
      </span>
    )
  }
  return renderAgenticOsInvocationAnchor({
    token,
    className: `${args.className} ${UI_INLINE_CHIP_SHELL_15CH_CLASSNAME} cursor-pointer no-underline hover:underline`,
    children: <span className={`${UI_TEXT_TRUNCATE_CHIP} ${UI_INLINE_CHIP_LABEL_15CH_CLASSNAME}`}>{token}</span>,
  })
}

export function renderAgenticOsInlineCodeInvocationLinks(args: {
  text: string
  keyValue: string
  className: string
}): React.ReactNode | null {
  const segments = splitInlineKeywordChipTokens(args.text)
  let hasInvocation = false
  const children = segments.map((segment, index) => {
    if (segment.kind === 'text') return <React.Fragment key={`code-text-${index}`}>{segment.value}</React.Fragment>
    const token = String(segment.value || '')
    const link = renderAgenticOsInvocationAnchor({
      token,
      className: 'cursor-pointer no-underline hover:underline',
      children: token,
    })
    if (!link) return <React.Fragment key={`code-token-${index}`}>{token}</React.Fragment>
    hasInvocation = true
    return <React.Fragment key={`code-token-${index}`}>{link}</React.Fragment>
  })
  if (!hasInvocation) return null
  return (
    <code key={args.keyValue} className={args.className}>
      {children}
    </code>
  )
}
