import { emitFloatingPanelOpen, type ChatInputAppendEventDetail } from '@/features/canvas/utils'
import {
  consumeFloatingPanelChatInputHandoff,
  dispatchResolvedFloatingPanelChatSeed,
  queueResolvedFloatingPanelChatInputHandoff,
  resolveFloatingPanelChatSeed,
} from './floatingPanelChatInputHandoff'
import { isFloatingPanelBridgeReady, whenFloatingPanelBridgeReady } from '@/features/toolbar/floatingPanelBridge'

export type FloatingPanelChatOpenSeedDelivery = 'appendEvent' | 'queuedHandoff'

export function openFloatingPanelChat(): boolean {
  return emitFloatingPanelOpen({ tab: 'chat', open: true })
}

export function openFloatingPanelChatWithSeed(args: {
  text: string
  mode?: ChatInputAppendEventDetail['mode']
  delivery?: FloatingPanelChatOpenSeedDelivery
  submit?: boolean
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

export function openFloatingPanelChatWithSeedWhenReady(args: Parameters<typeof openFloatingPanelChatWithSeed>[0]): boolean {
  const resolved = resolveFloatingPanelChatSeed(args)
  if (!resolved) return false
  if (isFloatingPanelBridgeReady()) return openFloatingPanelChatWithSeed(args)
  whenFloatingPanelBridgeReady(() => {
    openFloatingPanelChatWithSeed(args)
  })
  return true
}
