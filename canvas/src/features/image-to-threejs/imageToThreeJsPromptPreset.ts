import {
  IMAGE_TO_THREEJS_BINDING_TOKEN,
  IMAGE_TO_THREEJS_COMMAND_TOKEN,
  IMAGE_TO_THREEJS_SEMANTIC_TOKEN,
} from './imageToThreeJsContract'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'

export const IMAGE_TO_THREEJS_PROMPT_PRESET_ID = 'image-to-threejs' as const

export const IMAGE_TO_THREEJS_PROMPT_PRESET_TOKENS = [
  IMAGE_TO_THREEJS_COMMAND_TOKEN,
  IMAGE_TO_THREEJS_BINDING_TOKEN,
  IMAGE_TO_THREEJS_SEMANTIC_TOKEN,
] as const

const readInvocationTokens = (value: unknown): readonly string[] => (
  splitInvocationTokenSegments(String(value || ''))
    .filter(segment => segment.kind === 'token')
    .map(segment => segment.value.toLowerCase())
)

export const buildImageToThreeJsPromptPreset = (request = ''): string => (
  [IMAGE_TO_THREEJS_PROMPT_PRESET_TOKENS.join(' '), String(request || '').trim()]
    .filter(Boolean)
    .join('\n\n')
)

export const isImageToThreeJsPromptPreset = (value: unknown): boolean => {
  const tokens = new Set(readInvocationTokens(value))
  return IMAGE_TO_THREEJS_PROMPT_PRESET_TOKENS.every(token => tokens.has(token))
}
