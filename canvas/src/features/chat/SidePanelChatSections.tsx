import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import type { GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

type MessagesSectionProps = {
  messages: ChatMessage[]
  isLoading: boolean
  historyKey: string
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMicroLabelTextSizeClass: string
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}

export function SidePanelChatMessagesSection({
  messages,
  isLoading,
  historyKey,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  uiPanelMicroLabelTextSizeClass,
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
          className={`text-xs ${UI_THEME_TOKENS.text.tertiary} hover:${UI_THEME_TOKENS.text.primary} disabled:opacity-50`}
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

      {messages.map(m => (
        <div key={m.id} className="flex">
          <div
            className={[
              'max-w-[85%] rounded px-3 py-2 mb-1 whitespace-pre-wrap break-words',
              uiPanelTextFontClass,
              uiPanelKeyValueTextSizeClass,
              m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : `mr-auto ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`,
            ].join(' ')}
          >
            {m.content}
          </div>
        </div>
      ))}
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
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
  isSubmitDisabled: boolean
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onStop: () => void
}

export function SidePanelChatFooter({
  input,
  setInput,
  isLoading,
  errorText,
  connectivity,
  connectivityDetail,
  currentNode,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  isSubmitDisabled,
  onSubmit,
  onStop,
}: FooterProps) {
  return (
    <div className="border-t border-gray-200 p-3 space-y-2">
      {errorText && (
        <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-red-600'].join(' ')}>
          {errorText}
        </div>
      )}

      {connectivity !== 'unknown' && (
        <div
          className={[
            uiPanelTextFontClass,
            uiPanelMicroLabelTextSizeClass,
            connectivity === 'ok' ? 'text-emerald-600' : 'text-amber-600',
          ].join(' ')}
        >
          {connectivity === 'ok' ? UI_COPY.chatEndpointOkStatus : connectivityDetail || UI_COPY.chatEndpointUnreachableStatus}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={3}
          className={['w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none', uiPanelTextFontClass].join(' ')}
          placeholder={UI_COPY.chatInputPlaceholder}
        />

        <div className="flex items-center justify-between">
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'text-gray-500'].join(' ')}>
            {currentNode
              ? UI_COPY.chatUsingSelectedNodeContextStatus(currentNode.label, currentNode.type)
              : UI_COPY.chatNoSelectionContextStatus}
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <button
                type="button"
                className="App-toolbar__btn text-xs bg-gray-200 text-gray-900 disabled:opacity-50"
                onClick={onStop}
              >
                {UI_COPY.chatStopButtonLabel}
              </button>
            )}
            <button
              type="submit"
              className="App-toolbar__btn text-xs bg-blue-600 text-white disabled:opacity-50"
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

