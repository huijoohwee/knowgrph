import {
  isPromptPresetCatalogError,
  loadPromptPreset,
} from './promptPresetCatalog'
import {
  isVideoAgentDemoPresetError,
  loadVideoAgentDemoPreset,
} from './videoAgentDemoPreset'

export type PromptPresetInvocationResult =
  | { ok: true; prompt: string }
  | { ok: false; error: string }

export async function loadPromptPresetInvocation(id: string): Promise<PromptPresetInvocationResult> {
  if (id === 'video-agent') {
    const result = await loadVideoAgentDemoPreset()
    return isVideoAgentDemoPresetError(result)
      ? { ok: false, error: result.error }
      : { ok: true, prompt: result.prompt }
  }

  const result = await loadPromptPreset(id)
  return isPromptPresetCatalogError(result)
    ? { ok: false, error: result.error }
    : { ok: true, prompt: result.preset.prompt }
}
