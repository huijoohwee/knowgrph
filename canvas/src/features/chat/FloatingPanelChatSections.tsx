import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import type { GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

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

const WORKSPACE_LINK_RE = /\[([^\]]+)\]\((\/[^\s)]+\.md)\)/g

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
    const path = String(match[2] || '').trim()
    nodes.push(
      <button
        key={`workspace-link-${index}-${path}`}
        type="button"
        className={[
          'inline-flex items-center rounded px-1.5 py-0.5 border',
          UI_THEME_TOKENS.status.info,
        ].join(' ')}
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
    <div className="flex">
      <div
        className={[
          'max-w-[85%] rounded px-3 py-2 mb-1 whitespace-pre-wrap break-words leading-relaxed border',
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
      </div>
    </div>
  )
})

type MessagesSectionProps = {
  messages: ChatMessage[]
  isLoading: boolean
  historyKey: string
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMicroLabelTextSizeClass: string
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
  onOpenWorkspacePath,
  setMessages,
}: MessagesSectionProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {UI_COPY.chatHistoryCountStatus(messages.length)}
        </div>
        <button
          type="button"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
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
      </div>

      {messages.length === 0 && (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {UI_COPY.chatEmptyStateHelp}
        </div>
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
  currentNode: GraphNode | null
  modelId: string
  modelOptions: string[]
  onModelChanged: (modelId: string) => void
  streamingReasoningPreview?: string | null
  streamingUsageSummary?: string | null
  streamingFinishReason?: string | null
  writingWorkspaceFileLabel?: string | null
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
  currentNode,
  modelId,
  modelOptions,
  onModelChanged,
  streamingReasoningPreview,
  streamingUsageSummary,
  streamingFinishReason,
  writingWorkspaceFileLabel,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  isSubmitDisabled,
  onSubmit,
  onStop,
  showNewChatButton,
  isNewChatDisabled,
  onNewChat,
}: FooterProps) {
  return (
    <div className={`border-t ${UI_THEME_TOKENS.panel.border} p-3 space-y-2`}>
      {errorText && (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-red-700 dark:text-red-400'].join(' ')}>
          {errorText}
        </div>
      )}

      {connectivity !== 'unknown' && (
        <div
          className={[
            uiPanelTextFontClass,
            uiPanelMicroLabelTextSizeClass,
            connectivity === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400',
          ].join(' ')}
        >
          {connectivity === 'ok' ? UI_COPY.chatEndpointOkStatus : connectivityDetail || UI_COPY.chatEndpointUnreachableStatus}
        </div>
      )}
      {modelOptions.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
            {UI_COPY.chatModelSelectLabel}
          </div>
          <select
            value={modelId}
            onChange={e => {
              const next = e.target.value
              if (!next) return
              onModelChanged(next)
            }}
            disabled={isLoading || modelOptions.length <= 1}
            className={`h-7 px-2 text-xs border ${UI_THEME_TOKENS.input.border} rounded ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} disabled:opacity-60`}
          >
            {modelOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}
      {streamingReasoningPreview ? (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
          {streamingReasoningPreview}
        </div>
      ) : null}
      {streamingUsageSummary ? (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          {streamingUsageSummary}
        </div>
      ) : null}
      {streamingFinishReason ? (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
          Finish: {streamingFinishReason}
        </div>
      ) : null}
      {writingWorkspaceFileLabel && (
        <div className={[uiPanelTextFontClass, 'text-[10px]', 'inline-flex items-center rounded px-1.5 py-0.5 border', UI_THEME_TOKENS.status.info].join(' ')}>
          {writingWorkspaceFileLabel}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <div className={`w-full border rounded overflow-hidden h-[88px] ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}>
          <PlainTextInputEditor
            value={input}
            onChange={setInput}
            multiline
            className="w-full h-full border-0 rounded-none bg-transparent"
            inputClassName={uiPanelTextFontClass}
          />
        </div>

        <div className={`flex items-center ${currentNode ? 'justify-between' : 'justify-end'}`}>
          {currentNode ? (
            <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
              {UI_COPY.chatUsingSelectedNodeContextStatus(currentNode.label, currentNode.type)}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {showNewChatButton && (
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
                onClick={onNewChat}
                disabled={isNewChatDisabled}
              >
                {UI_COPY.chatNewChatButtonLabel}
              </button>
            )}
            {isLoading && (
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
                onClick={onStop}
              >
                {UI_COPY.chatStopButtonLabel}
              </button>
            )}
            <button
              type="submit"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText} disabled:opacity-50`}
              disabled={isSubmitDisabled}
            >
              {isLoading ? UI_COPY.chatSendingButtonLabel : UI_COPY.chatSendButtonLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
