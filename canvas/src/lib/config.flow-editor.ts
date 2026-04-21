export type FlowEditorSmartNodeModel = 'generate_image' | 'generate_video'

export const FLOW_WIDGET_BUNDLE_KIND = 'kg:flow:widgetBundle' as const
export const FLOW_WIDGET_BUNDLE_VERSION = 1 as const

export const FLOW_WIDGET_REGISTRY_METADATA_KEY = 'flow:widgetRegistry' as const

export const FLOW_WIDGET_DRAG_KIND = 'kg:flow:widgetDrag' as const
export const FLOW_WIDGET_DRAG_VERSION = 1 as const
export const FLOW_WIDGET_DRAG_MIME = 'application/x-kg-flow-widget' as const

export const FLOW_IMAGE_GENERATION_NODE_TYPE_ID = 'ImageGeneration' as const
export const FLOW_IMAGE_GENERATION_NODE_LABEL = 'Image Widget' as const
export const FLOW_VIDEO_GENERATION_NODE_TYPE_ID = 'VideoGeneration' as const
export const FLOW_VIDEO_GENERATION_NODE_LABEL = 'Video Widget' as const

export const FLOW_EDITOR_SMART_NODE_MODEL_OPTIONS: ReadonlyArray<{ value: FlowEditorSmartNodeModel; label: string }> = [
  { value: 'generate_image', label: 'Generate Image' },
  { value: 'generate_video', label: 'Generate Video' },
]

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
  aspect_ratio?: FlowEditorAspectRatio
  duration?: number
  resolution?: FlowEditorResolution
  generate_audio?: boolean
  fast?: boolean
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
