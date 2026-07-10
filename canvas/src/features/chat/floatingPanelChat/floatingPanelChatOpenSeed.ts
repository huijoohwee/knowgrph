import { emitChatInputAppend, emitFloatingPanelOpen, type ChatInputAppendEventDetail } from '@/features/canvas/utils'
import {
  consumeFloatingPanelChatInputHandoff,
  normalizeFloatingPanelChatSeedText,
  queueFloatingPanelChatInputHandoff,
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
  const text = normalizeFloatingPanelChatSeedText(args.text)
  if (!text) return false
  const mode = args.mode === 'replace' ? 'replace' : 'append'
  const delivery = args.delivery === 'queuedHandoff' ? 'queuedHandoff' : 'appendEvent'

  if (delivery === 'queuedHandoff') {
    queueFloatingPanelChatInputHandoff({ text, mode })
  }

  const accepted = openFloatingPanelChat()
  if (delivery === 'queuedHandoff' && !accepted) {
    if (delivery === 'queuedHandoff') {
      void consumeFloatingPanelChatInputHandoff()
    }
    return false
  }

  if (delivery === 'appendEvent') {
    emitChatInputAppend({ text, mode })
  }
  return delivery === 'appendEvent' ? true : accepted
}
