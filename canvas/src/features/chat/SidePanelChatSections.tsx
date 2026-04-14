import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import type { GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

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

      {messages.map(m => (
        <div key={m.id} className="flex">
          <div
            className={[
              'max-w-[85%] rounded px-3 py-2 mb-1 whitespace-pre-wrap break-words',
              uiPanelTextFontClass,
              uiPanelKeyValueTextSizeClass,
              m.role === 'user'
                ? `ml-auto ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                : `mr-auto ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`,
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
  providerSummary: string
  providerHint: string
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
  providerSummary,
  providerHint,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  isSubmitDisabled,
  onSubmit,
  onStop,
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

      <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
        {providerSummary}
      </div>
      <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.secondary].join(' ')}>
        {providerHint}
      </div>

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

        <div className="flex items-center justify-between">
          <div className={[uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, UI_THEME_TOKENS.text.tertiary].join(' ')}>
            {currentNode
              ? UI_COPY.chatUsingSelectedNodeContextStatus(currentNode.label, currentNode.type)
              : UI_COPY.chatNoSelectionContextStatus}
          </div>
          <div className="flex items-center gap-2">
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
