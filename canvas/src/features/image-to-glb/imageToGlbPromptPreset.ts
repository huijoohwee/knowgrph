import {
  IMAGE_TO_GLB_BINDING_TOKEN,
  IMAGE_TO_GLB_COMMAND_TOKEN,
  IMAGE_TO_GLB_SEMANTIC_TOKEN,
} from './imageToGlbContract'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'

export const IMAGE_TO_GLB_PROMPT_PRESET_ID = 'image-to-glb' as const

export const IMAGE_TO_GLB_PROMPT_PRESET_TOKENS = [
  IMAGE_TO_GLB_COMMAND_TOKEN,
  IMAGE_TO_GLB_BINDING_TOKEN,
  IMAGE_TO_GLB_SEMANTIC_TOKEN,
] as const

const readInvocationTokens = (value: unknown): readonly string[] => (
  splitInvocationTokenSegments(String(value || ''))
    .filter(segment => segment.kind === 'token')
    .map(segment => segment.value.toLowerCase())
)

export const buildImageToGlbPromptPreset = (request = ''): string => (
  [IMAGE_TO_GLB_PROMPT_PRESET_TOKENS.join(' '), String(request || '').trim()]
    .filter(Boolean)
    .join('\n\n')
)

export const isImageToGlbPromptPreset = (value: unknown): boolean => {
  const tokens = new Set(readInvocationTokens(value))
  return IMAGE_TO_GLB_PROMPT_PRESET_TOKENS.every(token => tokens.has(token))
}
