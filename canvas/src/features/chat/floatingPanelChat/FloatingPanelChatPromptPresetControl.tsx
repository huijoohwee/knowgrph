import React from 'react'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  isPromptPresetCatalogError,
  loadPromptPreset,
  loadPromptPresetCatalog,
  type PromptPreset,
  type PromptPresetCatalogResult,
} from '@/features/chat/promptPresetCatalog'
import { isVideoAgentDemoPresetError, loadVideoAgentDemoPreset } from '@/features/chat/videoAgentDemoPreset'

type PromptPresetControlRuntime = {
  loadCatalog: () => Promise<PromptPresetCatalogResult>
  loadPrompt: (id: string) => Promise<string>
}

const defaultPromptPresetControlRuntime: PromptPresetControlRuntime = {
  loadCatalog: () => loadPromptPresetCatalog(),
  loadPrompt: async id => {
    if (id === 'video-agent') {
      const result = await loadVideoAgentDemoPreset()
      return isVideoAgentDemoPresetError(result) ? result.error : result.prompt
    }
    const result = await loadPromptPreset(id)
    return isPromptPresetCatalogError(result) ? result.error : result.preset.prompt
  },
}

export function FloatingPanelChatPromptPresetControl({
  setInput,
  disabled,
  textSizeClassName,
  runtime = defaultPromptPresetControlRuntime,
}: {
  setInput: React.Dispatch<React.SetStateAction<string>>
  disabled: boolean
  textSizeClassName: string
  runtime?: PromptPresetControlRuntime
}) {
  const [presets, setPresets] = React.useState<PromptPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = React.useState('video-agent')
  const [catalogError, setCatalogError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void runtime.loadCatalog().then(result => {
      if (!active) return
      if (isPromptPresetCatalogError(result)) {
        setCatalogError(result.error)
        setPresets([])
        return
      }
      setCatalogError('')
      setPresets(result.presets)
      setSelectedPresetId(current => result.presets.some(preset => preset.id === current) ? current : result.presets[0]?.id || '')
    })
    return () => { active = false }
  }, [runtime])

  const loadPreset = React.useCallback(() => {
    if (disabled || isLoading) return
    if (catalogError || !selectedPresetId) {
      setInput(catalogError || UI_COPY.chatPromptPresetUnavailableError)
      return
    }
    setIsLoading(true)
    void runtime.loadPrompt(selectedPresetId).then(setInput).finally(() => setIsLoading(false))
  }, [catalogError, disabled, isLoading, runtime, selectedPresetId, setInput])

  const selectedPreset = presets.find(preset => preset.id === selectedPresetId)
  return (
    <section className="flex items-center gap-1" data-kg-chat-prompt-preset-control="true">
      <label className="sr-only" htmlFor="kg-chat-prompt-preset-select">{UI_COPY.chatPromptPresetSelectLabel}</label>
      <select
        id="kg-chat-prompt-preset-select"
        value={selectedPresetId}
        aria-label={UI_COPY.chatPromptPresetSelectLabel}
        className={`App-toolbar__btn max-w-36 ${textSizeClassName} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
        disabled={disabled || isLoading || presets.length === 0}
        title={selectedPreset?.description || catalogError || UI_COPY.chatPromptPresetSelectTitle}
        onChange={event => setSelectedPresetId(event.target.value)}
      >
        {presets.length > 0
          ? presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)
          : <option value="">{UI_COPY.chatPromptPresetUnavailableLabel}</option>}
      </select>
      <button
        type="button"
        data-kg-chat-load-preset="true"
        className={`App-toolbar__btn ${textSizeClassName} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
        onClick={loadPreset}
        disabled={disabled || isLoading}
        title={UI_COPY.chatLoadPresetButtonTitle}
      >
        {isLoading ? UI_COPY.chatLoadingPresetButtonLabel : UI_COPY.chatLoadPresetButtonLabel}
      </button>
    </section>
  )
}
