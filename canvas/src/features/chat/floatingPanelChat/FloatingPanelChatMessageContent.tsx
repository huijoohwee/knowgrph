import React from 'react'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { CardPreviewInlineMediaPill } from '@/lib/cards/CardPreviewInlineMediaPill'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import { getUiSectionStatusChipClassName } from '@/lib/ui/sectionChipChrome'
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

type FloatingPanelChatInlinePart = FloatingPanelChatInlineMediaPart | FloatingPanelChatWorkspaceLinkPart

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

const renderInlinePart = (
  part: FloatingPanelChatInlinePart,
  key: string,
  onOpenWorkspacePath?: (path: string) => void,
): React.ReactNode => {
  if (part.kind === 'media') return renderFloatingPanelChatMediaChip(part.token, key)
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
  ].sort((a, b) => a.index - b.index || a.end - b.end)
  if (!parts.length) return content

  const nodes: React.ReactNode[] = []
  let cursor = 0
  parts.forEach((part, index) => {
    if (part.index < cursor) return
    if (part.index > cursor) nodes.push(content.slice(cursor, part.index))
    nodes.push(renderInlinePart(part, `chat-inline-${index}-${part.index}`, onOpenWorkspacePath))
    cursor = part.end
  })
  if (cursor < content.length) nodes.push(content.slice(cursor))
  return nodes.length ? nodes : content
}
