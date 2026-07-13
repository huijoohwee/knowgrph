import React from 'react'
import { buildAgenticOsInvocationChipAttrs } from '@/features/agentic-os/agenticOsInvocationChips'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { resolveDataViewChipClass, DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME } from '@/features/markdown/ui/dataViewChipStyles'
import { CardPreviewInlineMediaPill } from '@/lib/cards/CardPreviewInlineMediaPill'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import { splitInvocationTokenSegments, type InvocationTokenKind } from '@/lib/markdown/invocationTokens'
import { getUiSectionStatusChipClassName } from '@/lib/ui/sectionChipChrome'
import { UI_INLINE_CHIP_SHELL_15CH_CLASSNAME, UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { readComposerInvocationSourceTitle } from '@/lib/ui/textareaInvocationProjectionInvocation'
import { collectTextareaInvocationSourceBindings } from '@/lib/ui/textareaInvocationSourceBindings'
import {
  collectFloatingPanelChatMediaTokens,
  type FloatingPanelChatMediaToken,
} from './floatingPanelChatMediaTokens'

const WORKSPACE_LINK_RE = /\[([^\]]+)\]\(((?:workspace:)?\/[^\s)]+\.md)\)/g

type FloatingPanelChatInlineMediaPart = {
  kind: 'media'
  index: number
  end: number
  token: FloatingPanelChatMediaToken
}

type FloatingPanelChatWorkspaceLinkPart = {
  kind: 'workspace-link'
  index: number
  end: number
  label: string
  path: string
}

type FloatingPanelChatSourceBindingPart = {
  kind: 'source-binding'
  index: number
  end: number
  label: string
  url: string
}

type FloatingPanelChatInlinePart =
  | FloatingPanelChatInlineMediaPart
  | FloatingPanelChatWorkspaceLinkPart
  | FloatingPanelChatSourceBindingPart

const normalizeChatWorkspaceLinkPath = (raw: string): string => {
  const text = String(raw || '').trim()
  const withoutScheme = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  return normalizeWorkspacePath(withoutScheme)
}

const collectWorkspaceLinkParts = (
  content: string,
  onOpenWorkspacePath?: (path: string) => void,
): FloatingPanelChatWorkspaceLinkPart[] => {
  if (typeof onOpenWorkspacePath !== 'function') return []
  const parts: FloatingPanelChatWorkspaceLinkPart[] = []
  WORKSPACE_LINK_RE.lastIndex = 0
  for (;;) {
    const match = WORKSPACE_LINK_RE.exec(content)
    if (!match) break
    const label = String(match[1] || '').trim() || 'Open'
    if (!/^Open(?:\s|$)/i.test(label)) continue
    parts.push({
      kind: 'workspace-link',
      index: match.index,
      end: match.index + match[0].length,
      label,
      path: normalizeChatWorkspaceLinkPath(String(match[2] || '')),
    })
  }
  return parts
}

const collectMediaParts = (content: string): FloatingPanelChatInlineMediaPart[] =>
  collectFloatingPanelChatMediaTokens(content).map(token => ({
    kind: 'media',
    index: token.index,
    end: token.index + token.raw.length,
    token,
  }))

const collectSourceBindingParts = (content: string): FloatingPanelChatSourceBindingPart[] => {
  return collectTextareaInvocationSourceBindings(content).map(binding => ({
      kind: 'source-binding',
      index: binding.index,
      end: binding.end,
      label: binding.label,
      url: binding.sourceUrl,
    }))
}

const readMessageInvocationChipClassName = (token: string): string => [
  DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
  UI_INLINE_CHIP_SHELL_15CH_CLASSNAME,
  resolveDataViewChipClass(token),
  'mx-0.5 inline-flex align-baseline no-underline',
].join(' ')

const renderFloatingPanelChatInvocationChip = (
  token: string,
  tokenKind: InvocationTokenKind,
  key: string,
): React.ReactNode => {
  const agenticAttrs = buildAgenticOsInvocationChipAttrs(token) || {}
  return (
    <span
      key={key}
      data-kg-chat-message-invocation-chip={tokenKind}
      data-kg-chat-message-invocation-token={token}
      title={readComposerInvocationSourceTitle({ text: token, tokenKind })}
      className={readMessageInvocationChipClassName(token)}
      {...agenticAttrs}
    >
      <span className={UI_TEXT_TRUNCATE_CHIP}>{token}</span>
    </span>
  )
}

const renderFloatingPanelChatText = (text: string, keyPrefix: string): React.ReactNode[] =>
  splitInvocationTokenSegments(text).map((segment, index) => (
    segment.kind === 'text'
      ? <React.Fragment key={`${keyPrefix}-text-${index}`}>{segment.value}</React.Fragment>
      : renderFloatingPanelChatInvocationChip(segment.value, segment.tokenKind, `${keyPrefix}-token-${index}`)
  ))

const renderFloatingPanelChatMediaChip = (
  token: FloatingPanelChatMediaToken,
  key: string,
): React.ReactNode => {
  const label = String(token.label || '').trim() || (
    token.mediaKind === 'audio' ? 'Audio' : token.mediaKind === 'video' ? 'Video' : 'Image'
  )
  return (
    <span
      key={key}
      data-kg-chat-message-media-chip="1"
      data-kg-chat-message-media-kind={token.mediaKind}
      className="inline-flex max-w-full align-baseline"
    >
      <CardPreviewInlineMediaPill
        label={label}
        fallbackLabel={label}
        displayLabel={label}
        sourceTitle={`${label} - ${token.mediaKind}`}
        thumbnailKind={token.mediaKind}
        thumbnailUrl={token.thumbnailUrl}
      >
        <InlineMediaCommandThumbnail
          kind={token.mediaKind}
          thumbnailUrl={token.thumbnailUrl}
          thumbnailAlt={label}
          variant="inline"
        />
      </CardPreviewInlineMediaPill>
    </span>
  )
}

const renderFloatingPanelChatWorkspaceLink = (
  part: FloatingPanelChatWorkspaceLinkPart,
  key: string,
  onOpenWorkspacePath?: (path: string) => void,
): React.ReactNode => (
  <button
    key={key}
    type="button"
    data-kg-chat-source-file-link="true"
    data-workspace-path={part.path}
    aria-label={`Open ${part.path} in Source Files`}
    title={`Open ${part.path} in Source Files`}
    className={getUiSectionStatusChipClassName('info', 'cursor-pointer')}
    onClick={() => onOpenWorkspacePath?.(part.path)}
  >
    {part.label}
  </button>
)

const renderFloatingPanelChatSourceBinding = (
  part: FloatingPanelChatSourceBindingPart,
  key: string,
): React.ReactNode => {
  const label = `@${part.label}`
  return (
    <a
      key={key}
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      data-kg-chat-message-source-binding="1"
      title={`${label}\nSource: ${part.url}`}
      className={`${readMessageInvocationChipClassName(label)} cursor-pointer hover:underline`}
    >
      <span className={UI_TEXT_TRUNCATE_CHIP}>{label}</span>
    </a>
  )
}

const renderInlinePart = (
  part: FloatingPanelChatInlinePart,
  key: string,
  onOpenWorkspacePath?: (path: string) => void,
): React.ReactNode => {
  if (part.kind === 'media') return renderFloatingPanelChatMediaChip(part.token, key)
  if (part.kind === 'source-binding') return renderFloatingPanelChatSourceBinding(part, key)
  return renderFloatingPanelChatWorkspaceLink(part, key, onOpenWorkspacePath)
}

export const renderFloatingPanelChatMessageContent = (
  raw: string,
  onOpenWorkspacePath?: (path: string) => void,
): React.ReactNode => {
  const content = String(raw || '')
  const parts: FloatingPanelChatInlinePart[] = [
    ...collectMediaParts(content),
    ...collectWorkspaceLinkParts(content, onOpenWorkspacePath),
    ...collectSourceBindingParts(content),
  ].sort((a, b) => a.index - b.index || a.end - b.end)
  if (!parts.length) return renderFloatingPanelChatText(content, 'chat-message')

  const nodes: React.ReactNode[] = []
  let cursor = 0
  parts.forEach((part, index) => {
    if (part.index < cursor) return
    if (part.index > cursor) nodes.push(...renderFloatingPanelChatText(content.slice(cursor, part.index), `chat-inline-${index}-leading`))
    nodes.push(renderInlinePart(part, `chat-inline-${index}-${part.index}`, onOpenWorkspacePath))
    cursor = part.end
  })
  if (cursor < content.length) nodes.push(...renderFloatingPanelChatText(content.slice(cursor), 'chat-inline-trailing'))
  return nodes.length ? nodes : content
}
