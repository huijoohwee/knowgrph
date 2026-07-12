import React from 'react'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { isVideoAgentDemoPresetError, loadVideoAgentDemoPreset } from '@/features/chat/videoAgentDemoPreset'

export function FloatingPanelChatVideoPresetButton({
  setInput,
  disabled,
  textSizeClassName,
}: {
  setInput: React.Dispatch<React.SetStateAction<string>>
  disabled: boolean
  textSizeClassName: string
}) {
  const [isLoading, setIsLoading] = React.useState(false)
  const loadPreset = React.useCallback(() => {
    if (disabled || isLoading) return
    setIsLoading(true)
    void loadVideoAgentDemoPreset()
      .then(result => setInput(isVideoAgentDemoPresetError(result) ? result.error : result.prompt))
      .finally(() => setIsLoading(false))
  }, [disabled, isLoading, setInput])
  return (
    <button
      type="button"
      data-kg-chat-load-video-preset="true"
      className={`App-toolbar__btn ${textSizeClassName} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
      onClick={loadPreset}
      disabled={disabled || isLoading}
      title={UI_COPY.chatLoadVideoPresetButtonTitle}
    >
      {isLoading ? UI_COPY.chatLoadingPresetButtonLabel : UI_COPY.chatLoadPresetButtonLabel}
    </button>
  )
}
