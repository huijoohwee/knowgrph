import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS,
} from '@/lib/chatEndpoint'

export type FlowEditorSmartNodeModel = string

export const FLOW_WIDGET_BUNDLE_KIND = 'kg:flow:widgetBundle' as const
export const FLOW_WIDGET_BUNDLE_VERSION = 1 as const

export const FLOW_WIDGET_REGISTRY_METADATA_KEY = 'flow:widgetRegistry' as const

export const FLOW_WIDGET_DRAG_KIND = 'kg:flow:widgetDrag' as const
export const FLOW_WIDGET_DRAG_VERSION = 1 as const
export const FLOW_WIDGET_DRAG_MIME = 'application/x-kg-flow-widget' as const

export const FLOW_IMAGE_GENERATION_NODE_TYPE_ID = 'ImageGeneration' as const
export const FLOW_IMAGE_GENERATION_NODE_LABEL = 'BytePlus Image Widget' as const
export const FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID = 'RichMediaPanel' as const
export const FLOW_RICH_MEDIA_PANEL_NODE_LABEL = 'Rich Media Panel' as const
export const FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID = 'default' as const
export const FLOW_RICH_MEDIA_PANEL_FORM_ID = 'richMediaPanel' as const

export const FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID = 'VideoTranscriber' as const
export const FLOW_VIDEO_TRANSCRIBER_NODE_LABEL = 'Video Transcriber Widget' as const
export const FLOW_VIDEO_TRANSCRIBER_WIDGET_TYPE_ID = 'default' as const
export const FLOW_VIDEO_TRANSCRIBER_FORM_ID = 'videoTranscriber' as const
export const FLOW_TEXT_GENERATION_NODE_TYPE_ID = 'TextGeneration' as const
export const FLOW_TEXT_GENERATION_NODE_LABEL = 'Text Widget' as const
export const FLOW_VIDEO_GENERATION_NODE_TYPE_ID = 'VideoGeneration' as const
export const FLOW_VIDEO_GENERATION_NODE_LABEL = 'BytePlus Video Widget' as const

export const FLOW_VIDEO_SCRIPT_FORM_ID = 'videoScript' as const
export const FLOW_VIDEO_SCRIPT_WIDGET_LABEL = 'BytePlus Video Script Widget' as const
export const FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID = 'videoScript.openai' as const
export const FLOW_OPENAI_VIDEO_SCRIPT_WIDGET_LABEL = 'OpenAI Video Script Widget' as const

const FLOW_TEXT_GENERATION_SEED_PROMPT_DEFAULT = 'Generate a text response for the active request.'
const FLOW_VIDEO_SCRIPT_SEED_PROMPT_DEFAULT =
  'Generate a complete markdown document for a minimal Text → Image → Video workflow. Include YAML frontmatter with $schema="kgc-pipeline/v1", an editable inputs block (vibe, duration, theme, location, script, model IDs), plus matching flow and mermaid blocks. Do not reference file paths.'

export function getFlowTextGenerationSeedPrompt(formId?: unknown): string {
  const normalized = String(formId || '').trim()
  if (normalized === FLOW_VIDEO_SCRIPT_FORM_ID || normalized === FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID) {
    return FLOW_VIDEO_SCRIPT_SEED_PROMPT_DEFAULT
  }
  return FLOW_TEXT_GENERATION_SEED_PROMPT_DEFAULT
}

export function isFlowVideoScriptFormId(formId?: unknown): boolean {
  const normalized = String(formId || '').trim()
  return normalized === FLOW_VIDEO_SCRIPT_FORM_ID || normalized === FLOW_OPENAI_VIDEO_SCRIPT_FORM_ID
}

export const FLOW_EDITOR_IMAGE_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  ...CHAT_BYTEPLUS_IMAGE_MODEL_OPTIONS.map((value, index) => ({
    value,
    label: index === 0 ? `${value} (Default)` : value,
  })),
]

export type FlowEditorImageSize = '1K' | '2K' | '3K' | '4K'

export const FLOW_EDITOR_IMAGE_SIZE_OPTIONS: ReadonlyArray<{ value: FlowEditorImageSize; label: string }> = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
  { value: '4K', label: '4K' },
]

export type FlowEditorImageOutputFormat = 'jpeg' | 'png'

export const FLOW_EDITOR_IMAGE_OUTPUT_FORMAT_OPTIONS: ReadonlyArray<{ value: FlowEditorImageOutputFormat; label: string }> = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
]

export const FLOW_EDITOR_VIDEO_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  ...CHAT_BYTEPLUS_VIDEO_MODEL_OPTIONS.map((value, index) => ({
    value,
    label: index === 0 ? `${value} (Default)` : value,
  })),
]

export const FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  ...FLOW_EDITOR_IMAGE_MODEL_OPTIONS,
  ...FLOW_EDITOR_VIDEO_MODEL_OPTIONS,
]

export function getFlowEditorSmartNodeModelOptions(mode?: 'image' | 'video' | null): ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> {
  if (mode === 'image') return FLOW_EDITOR_IMAGE_MODEL_OPTIONS
  if (mode === 'video') return FLOW_EDITOR_VIDEO_MODEL_OPTIONS
  return FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS
}

export function getFlowEditorSmartWidgetLabel(args: {
  mode?: 'image' | 'video' | null
  model?: unknown
}): string {
  const mode = args.mode === 'image' ? 'image' : args.mode === 'video' ? 'video' : null
  if (mode === 'image') {
    return FLOW_IMAGE_GENERATION_NODE_LABEL
  }
  if (mode === 'video') {
    return FLOW_VIDEO_GENERATION_NODE_LABEL
  }
  return FLOW_TEXT_GENERATION_NODE_LABEL
}

export type FlowEditorAspectRatio = 'landscape' | 'portrait' | 'square'

export const FLOW_EDITOR_ASPECT_RATIO_OPTIONS: ReadonlyArray<{ value: FlowEditorAspectRatio; label: string }> = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
]

export type FlowEditorResolution = '720p' | '1080p'

export const FLOW_EDITOR_RESOLUTION_OPTIONS: ReadonlyArray<{ value: FlowEditorResolution; label: string }> = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
]

export const FLOW_EDITOR_DURATION_SECONDS_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 2, label: '2s' },
  { value: 4, label: '4s' },
  { value: 6, label: '6s' },
  { value: 8, label: '8s' },
]

export type FlowEditorSmartNodeProperties = {
  model?: FlowEditorSmartNodeModel
  prompt?: string
  content_json?: string
  size?: FlowEditorImageSize
  output_format?: FlowEditorImageOutputFormat
  seed?: number
  guidance_scale?: number
  aspect_ratio?: FlowEditorAspectRatio
  duration?: number
  resolution?: FlowEditorResolution
  generate_audio?: boolean
  fast?: boolean
  watermark?: boolean
  reference_image?: string
}

export const FLOW_EDITOR_LOOP_NODE_TYPE = 'Loop'
export const FLOW_EDITOR_NODE_KIND_PROPERTY_KEY = 'workflow:kind' as const
export const FLOW_EDITOR_NODE_KIND_LOOP_VALUE = 'loop' as const

export const FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS: ReadonlyArray<keyof FlowEditorSmartNodeProperties> = [
  'model',
  'prompt',
  'aspect_ratio',
  'duration',
  'resolution',
]
