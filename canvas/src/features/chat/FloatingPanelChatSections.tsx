import React from 'react'
import { Bot, ChevronDown, KeyRound } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import type { GraphNode } from '@/lib/graph/types'
import { getUiSectionStatusChipClassName } from '@/lib/ui/sectionChipChrome'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_CHAT_MESSAGE_BUBBLE_CLASSNAME,
  UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME,
  UI_RESPONSIVE_CONTROL_COMPACT_VALUE_ROW_CLASSNAME,
  UI_RESPONSIVE_CONTROL_ICON_CELL_CLASSNAME,
  UI_RESPONSIVE_CONTROL_INLINE_FILL_CLASSNAME,
  UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }
export type StreamingAssistantState = {
  id: string
  text: string
  reasoningPreview?: string | null
  reasoningStepCount?: number
  usageSummary?: string | null
  finishReason?: string | null
  modelId?: string | null
}

const WORKSPACE_LINK_RE = /\[([^\]]+)\]\(((?:workspace:)?\/[^\s)]+\.md)\)/g

const normalizeChatWorkspaceLinkPath = (raw: string): string => {
  const text = String(raw || '').trim()
  const withoutScheme = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  return normalizeWorkspacePath(withoutScheme)
}

const FloatingPanelChatStreamingStatus = React.memo(function FloatingPanelChatStreamingStatus({
  reasoningPreview,
  usageSummary,
  finishReason,
  writingWorkspaceFileLabel,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
}: {
  reasoningPreview?: string | null
  usageSummary?: string | null
  finishReason?: string | null
  writingWorkspaceFileLabel?: string | null
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
}) {
  const reasoning = String(reasoningPreview || '').trim()
  const usage = String(usageSummary || '').trim()
  const finish = String(finishReason || '').trim()
  const writing = String(writingWorkspaceFileLabel || '').trim()
  if (!reasoning && !usage && !finish && !writing) return null

  return (
    <section
      aria-live="polite"
      role="status"
      data-kg-chat-stream-status="top"
      className={[
        'sticky top-0 z-10 space-y-1 rounded border px-2 py-1.5 shadow-sm',
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.panel.bg,
      ].join(' ')}
    >
      {reasoning ? (
        <section
          data-kg-chat-stream-reasoning="true"
          className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.secondary].join(' ')}
        >
          {reasoning}
        </section>
      ) : null}
      {usage ? (
        <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {usage}
        </section>
      ) : null}
      {finish ? (
        <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          Finish: {finish}
        </section>
      ) : null}
      {writing ? (
        <section className={getUiSectionStatusChipClassName('info', [uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass].join(' '))}>
          {writing}
        </section>
      ) : null}
    </section>
  )
})

const renderMessageWithWorkspaceLinks = (
  raw: string,
  onOpenWorkspacePath?: (path: string) => void,
): React.ReactNode => {
  const content = String(raw || '')
  if (!content || typeof onOpenWorkspacePath !== 'function') return content
  const nodes: React.ReactNode[] = []
  let last = 0
  let index = 0
  WORKSPACE_LINK_RE.lastIndex = 0
  for (;;) {
    const match = WORKSPACE_LINK_RE.exec(content)
    if (!match) break
    const start = match.index
    const end = start + match[0].length
    if (start > last) nodes.push(content.slice(last, start))
    const label = String(match[1] || '').trim() || 'Open'
    const path = normalizeChatWorkspaceLinkPath(String(match[2] || ''))
    nodes.push(
      <button
        key={`workspace-link-${index}-${path}`}
        type="button"
        data-kg-chat-source-file-link="true"
        data-workspace-path={path}
        aria-label={`Open ${path} in Source Files`}
        title={`Open ${path} in Source Files`}
        className={getUiSectionStatusChipClassName('info', 'cursor-pointer')}
        onClick={() => onOpenWorkspacePath(path)}
      >
        {label}
      </button>,
    )
    last = end
    index += 1
  }
  if (last < content.length) nodes.push(content.slice(last))
  return nodes.length > 0 ? nodes : content
}

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  overrideText,
  onOpenWorkspacePath,
}: {
  message: ChatMessage
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
  overrideText?: string | null
  onOpenWorkspacePath?: (path: string) => void
}) {
  const content = typeof overrideText === 'string' ? overrideText : message.content
  const isUser = message.role === 'user'
  return (
    <section className="flex">
      <section
        className={[
          UI_RESPONSIVE_CHAT_MESSAGE_BUBBLE_CLASSNAME,
          uiPanelTextFontClass,
          uiPanelKeyValueTextSizeClass,
          isUser
            ? `ml-auto ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText} ${UI_THEME_TOKENS.button.activeBorder}`
            : `mr-auto ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.panel.border}`,
        ].join(' ')}
      >
        {message.role === 'assistant'
          ? renderMessageWithWorkspaceLinks(content, onOpenWorkspacePath)
          : content}
      </section>
    </section>
  )
})

type MessagesSectionProps = {
  messages: ChatMessage[]
  isLoading: boolean
  historyKey: string
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMicroLabelTextSizeClass: string
  streamingReasoningPreview?: string | null
  streamingUsageSummary?: string | null
  streamingFinishReason?: string | null
  writingWorkspaceFileLabel?: string | null
  onOpenWorkspacePath?: (path: string) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}

export function FloatingPanelChatMessagesSection({
  messages,
  isLoading,
  historyKey,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  uiPanelMicroLabelTextSizeClass,
  streamingReasoningPreview,
  streamingUsageSummary,
  streamingFinishReason,
  writingWorkspaceFileLabel,
  onOpenWorkspacePath,
  setMessages,
}: MessagesSectionProps) {
  const liveStreamingReasoningPreview = isLoading ? streamingReasoningPreview : null
  const liveStreamingUsageSummary = isLoading ? streamingUsageSummary : null
  const liveStreamingFinishReason = isLoading ? streamingFinishReason : null
  const liveWritingWorkspaceFileLabel = isLoading ? writingWorkspaceFileLabel : null

  return (
    <>
      <FloatingPanelChatStreamingStatus
        reasoningPreview={liveStreamingReasoningPreview}
        usageSummary={liveStreamingUsageSummary}
        finishReason={liveStreamingFinishReason}
        writingWorkspaceFileLabel={liveWritingWorkspaceFileLabel}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
      />

      <section className="flex items-center justify-between">
        <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {UI_COPY.chatHistoryCountStatus(messages.length)}
        </section>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
          onClick={() => {
            setMessages([])
            const storage = getLocalStorage()
            if (!storage) return
            try {
              storage.removeItem(historyKey)
            } catch {
              void 0
            }
          }}
          disabled={messages.length === 0 || isLoading}
        >
          {UI_LABELS.clear}
        </button>
      </section>

      {messages.length === 0 && (
        <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.chatEmptyStateHelp}
        </section>
      )}

      {messages.map(m => {
        const hidePendingAssistant = m.role === 'assistant' && !String(m.content || '').trim()
        if (hidePendingAssistant) return null
        return (
          <ChatMessageRow
            key={m.id}
            message={m}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            onOpenWorkspacePath={onOpenWorkspacePath}
          />
        )
      })}
    </>
  )
}

type FooterProps = {
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  errorText: string | null
  connectivity: 'unknown' | 'ok' | 'error'
  connectivityDetail: string | null
  relayStatus?: {
    tone: 'info' | 'ok' | 'error'
    detail: string
  } | null
  relaySummary?: string | null
  relayAction?: {
    label: string
    onClick: () => void
  } | null
  apiKeyPrompt?: {
    providerLabel: string
    value: string
    onChange: (value: string) => void
  } | null
  currentNode: GraphNode | null
  modelId: string
  modelOptions: string[]
  onModelChanged: (modelId: string) => void
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
  isSubmitDisabled: boolean
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onStop: () => void
  showNewChatButton?: boolean
  isNewChatDisabled?: boolean
  onNewChat?: () => void
}

export function FloatingPanelChatFooter({
  input,
  setInput,
  isLoading,
  errorText,
  connectivity,
  connectivityDetail,
  relayStatus,
  relaySummary,
  relayAction,
  apiKeyPrompt,
  currentNode,
  modelId,
  modelOptions,
  onModelChanged,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  isSubmitDisabled,
  onSubmit,
  onStop,
  showNewChatButton,
  isNewChatDisabled,
  onNewChat,
}: FooterProps) {
  const chatModelSelectId = React.useId()
  const chatApiKeyInputId = React.useId()
  const [isApiKeyExpanded, setIsApiKeyExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!apiKeyPrompt && isApiKeyExpanded) setIsApiKeyExpanded(false)
  }, [apiKeyPrompt, isApiKeyExpanded])

  return (
    <section className={`border-t ${UI_THEME_TOKENS.panel.border} p-3 space-y-2`}>
      {errorText && (
        <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-red-700 dark:text-red-400'].join(' ')}>
          {errorText}
        </section>
      )}

      {connectivity !== 'unknown' && (
        <section
          className={[
            uiPanelTextFontClass,
            uiPanelMicroLabelTextSizeClass,
            connectivity === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400',
          ].join(' ')}
        >
          {connectivity === 'ok' ? UI_COPY.chatEndpointOkStatus : connectivityDetail || UI_COPY.chatEndpointUnreachableStatus}
        </section>
      )}
      {relayStatus?.detail ? (
        <section
          data-kg-chat-relay-status="true"
          className={[
            uiPanelTextFontClass,
            uiPanelMicroLabelTextSizeClass,
            relayStatus.tone === 'ok'
              ? 'text-green-700 dark:text-green-400'
              : relayStatus.tone === 'error'
                ? 'text-yellow-700 dark:text-yellow-400'
                : UI_THEME_TOKENS.text.secondary,
          ].join(' ')}
        >
          {relayStatus.detail}
        </section>
      ) : null}
      {relaySummary || relayAction ? (
        <section className="flex items-center justify-between gap-2">
          <section
            data-kg-chat-relay-summary="true"
            className={[
              uiPanelTextFontClass,
              uiPanelMicroLabelTextSizeClass,
              UI_THEME_TOKENS.text.tertiary,
            ].join(' ')}
          >
            {relaySummary}
          </section>
          {relayAction ? (
            <button
              type="button"
              data-kg-chat-relay-action="true"
              className={`App-toolbar__btn ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={relayAction.onClick}
            >
              {relayAction.label}
            </button>
          ) : null}
        </section>
      ) : null}
      {modelOptions.length > 0 && (
        <section className={UI_RESPONSIVE_CONTROL_COMPACT_VALUE_ROW_CLASSNAME} data-kg-chat-model-control="true">
          {apiKeyPrompt ? (
            <button
              type="button"
              aria-label={isApiKeyExpanded ? 'Collapse API key input' : 'Expand API key input'}
              aria-expanded={isApiKeyExpanded}
              aria-controls={chatApiKeyInputId}
              title={`${apiKeyPrompt.providerLabel} BYOK API key`}
              data-kg-chat-model-icon="true"
              data-kg-chat-api-key-toggle="true"
              data-kg-chat-model-api-key-toggle="true"
              className={[
                'App-toolbar__btn',
                UI_RESPONSIVE_CONTROL_ICON_CELL_CLASSNAME,
                uiPanelMicroLabelTextSizeClass,
                UI_THEME_TOKENS.button.text,
                UI_THEME_TOKENS.button.hoverBg,
              ].join(' ')}
              onClick={() => setIsApiKeyExpanded(prev => !prev)}
            >
              <Bot className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              <ChevronDown
                className={[
                  'size-2.5 transition-transform',
                  isApiKeyExpanded ? 'rotate-180' : '',
                ].join(' ')}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span
              aria-hidden="true"
              data-kg-chat-model-icon="true"
              className={[
                'App-toolbar__btn pointer-events-none',
                UI_RESPONSIVE_CONTROL_ICON_CELL_CLASSNAME,
                uiPanelMicroLabelTextSizeClass,
                UI_THEME_TOKENS.button.text,
              ].join(' ')}
            >
              <Bot className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          )}
          <select
            id={chatModelSelectId}
            aria-label={UI_COPY.chatModelSelectLabel}
            data-kg-chat-model-select="true"
            value={modelId}
            onChange={event => {
              const next = String(event.target.value || '').trim()
              if (!next) return
              onModelChanged(next)
            }}
            disabled={isLoading || modelOptions.length <= 1}
            className={`${UI_RESPONSIVE_CONTROL_INLINE_FILL_CLASSNAME} ${UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME} rounded border ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} disabled:opacity-60`}
          >
            {modelOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </section>
      )}
      {apiKeyPrompt && isApiKeyExpanded ? (
        <section className={UI_RESPONSIVE_CONTROL_COMPACT_VALUE_ROW_CLASSNAME} data-kg-chat-api-key-prompt="true">
          <span
            aria-hidden="true"
            data-kg-chat-api-key-icon="true"
            className={[
              'App-toolbar__btn pointer-events-none',
              UI_RESPONSIVE_CONTROL_ICON_CELL_CLASSNAME,
              uiPanelMicroLabelTextSizeClass,
              UI_THEME_TOKENS.button.text,
            ].join(' ')}
          >
            <KeyRound className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <input
            id={chatApiKeyInputId}
            aria-label={`${apiKeyPrompt.providerLabel} BYOK API key`}
            data-kg-chat-api-key-input="true"
            type="password"
            value={apiKeyPrompt.value}
            autoComplete="off"
            spellCheck={false}
            onChange={event => apiKeyPrompt.onChange(event.target.value)}
            disabled={isLoading}
            placeholder="Enter API key"
            className={`${UI_RESPONSIVE_CONTROL_INLINE_FILL_CLASSNAME} ${UI_RESPONSIVE_COMPACT_PANEL_FIELD_INPUT_CLASSNAME} rounded border ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} disabled:opacity-60`}
          />
        </section>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-2">
        <section className={`border rounded overflow-hidden ${UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}>
          <PlainTextInputEditor
            value={input}
            onChange={setInput}
            multiline
            className="w-full h-full border-0 rounded-none bg-transparent"
            inputClassName={uiPanelTextFontClass}
          />
        </section>

        <section className={`flex items-center ${currentNode ? 'justify-between' : 'justify-end'}`}>
          {currentNode ? (
            <section className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
              {UI_COPY.chatUsingSelectedNodeContextStatus(currentNode.label, currentNode.type)}
            </section>
          ) : null}
          <section className="flex items-center gap-2">
            {showNewChatButton && (
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
                onClick={onNewChat}
                disabled={isNewChatDisabled}
              >
                {UI_COPY.chatNewChatButtonLabel}
              </button>
            )}
            {isLoading && (
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
                onClick={onStop}
              >
                {UI_COPY.chatStopButtonLabel}
              </button>
            )}
            <button
              type="submit"
              className={`App-toolbar__btn ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText} disabled:opacity-50`}
              disabled={isSubmitDisabled}
            >
              {isLoading ? UI_COPY.chatSendingButtonLabel : UI_COPY.chatSendButtonLabel}
            </button>
          </section>
        </section>
      </form>
    </section>
  )
}
