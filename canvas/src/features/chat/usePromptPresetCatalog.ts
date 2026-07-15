import React from 'react'
import {
  isPromptPresetCatalogError,
  loadPromptPresetCatalog,
  type PromptPreset,
} from './promptPresetCatalog'

export function usePromptPresetCatalog(): readonly PromptPreset[] {
  const [presets, setPresets] = React.useState<PromptPreset[]>([])

  React.useEffect(() => {
    let cancelled = false
    loadPromptPresetCatalog().then(result => {
      if (!cancelled) setPresets(isPromptPresetCatalogError(result) ? [] : result.presets)
    }).catch(() => {
      if (!cancelled) setPresets([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  return presets
}
