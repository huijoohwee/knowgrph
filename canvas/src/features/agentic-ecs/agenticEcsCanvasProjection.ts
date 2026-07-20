import { projectWorldToCanvas } from '../../../../ecs/renderingLayer.js'
import { applyChatKgcDocumentTextToCanvas } from '@/features/chat/chatKgcCanvasApply'

type AgenticEcsCanvasProjectionOptions = {
  name?: string
  projection?: {
    components?: Array<{
      name: string
      fields?: string[] | Record<string, unknown>
    }>
  }
}

export async function projectAgenticEcsWorldToCanvas(
  world: unknown,
  options: AgenticEcsCanvasProjectionOptions = {},
) {
  return await projectWorldToCanvas(world, {
    ...options,
    applyDocument: applyChatKgcDocumentTextToCanvas,
  })
}
