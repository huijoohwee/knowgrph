import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'

export type FlowEditorSmartNodeModel = string

export const FLOW_WIDGET_BUNDLE_KIND = 'kg:flow:widgetBundle' as const
export const FLOW_WIDGET_BUNDLE_VERSION = 1 as const

export const FLOW_WIDGET_REGISTRY_METADATA_KEY = 'flow:widgetRegistry' as const

export const FLOW_WIDGET_DRAG_KIND = 'kg:flow:widgetDrag' as const
export const FLOW_WIDGET_DRAG_VERSION = 1 as const
export const FLOW_WIDGET_DRAG_MIME = 'application/x-kg-flow-widget' as const

export const FLOW_IMAGE_GENERATION_NODE_TYPE_ID = 'ImageGeneration' as const
export const FLOW_IMAGE_GENERATION_NODE_LABEL = 'Image Widget' as const
export const FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID = 'RichMediaPanel' as const
export const FLOW_RICH_MEDIA_PANEL_NODE_LABEL = 'Rich Media Panel' as const
export const FLOW_TEXT_GENERATION_NODE_TYPE_ID = 'TextGeneration' as const
export const FLOW_TEXT_GENERATION_NODE_LABEL = 'Text Widget' as const
export const FLOW_VIDEO_GENERATION_NODE_TYPE_ID = 'VideoGeneration' as const
export const FLOW_VIDEO_GENERATION_NODE_LABEL = 'BytePlus Video Widget' as const

export const FLOW_EDITOR_IMAGE_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  { value: CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT, label: 'Seedream 5.0 Lite (Default)' },
]

export const FLOW_EDITOR_VIDEO_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  { value: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT, label: `${CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT} (Default)` },
  { value: 'ByteDance-Seedance-1.5-pro', label: 'ByteDance-Seedance-1.5-pro' },
  { value: 'Dreamina-Seedance-2.0', label: 'Dreamina-Seedance-2.0' },
  { value: 'Dreamina-Seedance-2.0-fast', label: 'Dreamina-Seedance-2.0-fast' },
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
    const value = String(args.model || '').trim() || CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT
    const option = FLOW_EDITOR_IMAGE_MODEL_OPTIONS.find(entry => entry.value === value)
    const label = String(option?.label || value || FLOW_IMAGE_GENERATION_NODE_LABEL).replace(/\s*\(Default\)\s*$/i, '').trim()
    return `${label || FLOW_IMAGE_GENERATION_NODE_LABEL} Image Widget`
  }
  if (mode === 'video') {
    const value = String(args.model || '').trim() || CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT
    const option = FLOW_EDITOR_VIDEO_MODEL_OPTIONS.find(entry => entry.value === value)
    const label = String(option?.label || value || FLOW_VIDEO_GENERATION_NODE_LABEL).replace(/\s*\(Default\)\s*$/i, '').trim()
    if (!label || label === FLOW_VIDEO_GENERATION_NODE_LABEL) return FLOW_VIDEO_GENERATION_NODE_LABEL
    return `${label} ${FLOW_VIDEO_GENERATION_NODE_LABEL}`
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
