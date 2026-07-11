import { emitFloatingPanelOpen, type ChatInputAppendEventDetail } from '@/features/canvas/utils'
import {
  consumeFloatingPanelChatInputHandoff,
  dispatchResolvedFloatingPanelChatSeed,
  queueResolvedFloatingPanelChatInputHandoff,
  resolveFloatingPanelChatSeed,
} from './floatingPanelChatInputHandoff'

export type FloatingPanelChatOpenSeedDelivery = 'appendEvent' | 'queuedHandoff'

export function openFloatingPanelChat(): boolean {
  return emitFloatingPanelOpen({ tab: 'chat', open: true })
}

export function openFloatingPanelChatWithSeed(args: {
  text: string
  mode?: ChatInputAppendEventDetail['mode']
  delivery?: FloatingPanelChatOpenSeedDelivery
}): boolean {
  const resolved = resolveFloatingPanelChatSeed(args)
  if (!resolved) return false
  const delivery = args.delivery === 'queuedHandoff' ? 'queuedHandoff' : 'appendEvent'

  if (delivery === 'queuedHandoff') {
    queueResolvedFloatingPanelChatInputHandoff(resolved)
  }

  const accepted = openFloatingPanelChat()
  if (delivery === 'queuedHandoff' && !accepted) {
    if (delivery === 'queuedHandoff') {
      void consumeFloatingPanelChatInputHandoff()
    }
    return false
  }

  if (delivery === 'appendEvent') {
    dispatchResolvedFloatingPanelChatSeed(resolved)
  }
  return delivery === 'appendEvent' ? true : accepted
}
