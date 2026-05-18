import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function inferSmartMediaMode(args: {
  nodeTypeId?: unknown
  formId?: unknown
}): 'image' | 'video' | null {
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'image'
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'video'
  const formId = String(args.formId || '').trim()
  if (formId === 'imageGeneration') return 'image'
  if (formId === 'videoGeneration') return 'video'
  return null
}

export function getDefaultSmartMediaModel(mode: 'image' | 'video'): string {
  return mode === 'image' ? CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT : CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT
}
