import React from 'react'

const CHAT_THREAD_TAIL_THRESHOLD_PX = 160

export type FloatingPanelChatThreadFollowState = {
  isLoading: boolean
  shouldFollow: boolean
}

export const reduceFloatingPanelChatThreadFollowState = (
  state: FloatingPanelChatThreadFollowState,
  event: { type: 'render'; isLoading: boolean } | { type: 'scroll'; isNearTail: boolean },
): FloatingPanelChatThreadFollowState => {
  if (event.type === 'scroll') return { ...state, shouldFollow: event.isNearTail }
  return {
    isLoading: event.isLoading,
    shouldFollow: event.isLoading && !state.isLoading ? true : state.shouldFollow,
  }
}

export const isFloatingPanelChatThreadNearTail = (element: Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop'>): boolean => (
  element.scrollHeight - (element.scrollTop + element.clientHeight) <= CHAT_THREAD_TAIL_THRESHOLD_PX
)

export const useFloatingPanelChatThreadFollow = (args: {
  isLoading: boolean
  messageCount: number
  streamRevision: string
}) => {
  const scrollRef = React.useRef<HTMLElement | null>(null)
  const scrollRafRef = React.useRef<number | null>(null)
  const followStateRef = React.useRef<FloatingPanelChatThreadFollowState>({
    isLoading: args.isLoading,
    shouldFollow: true,
  })

  const onScroll = React.useCallback<React.UIEventHandler<HTMLElement>>(event => {
    followStateRef.current = reduceFloatingPanelChatThreadFollowState(followStateRef.current, {
      type: 'scroll',
      isNearTail: isFloatingPanelChatThreadNearTail(event.currentTarget),
    })
  }, [])

  React.useLayoutEffect(() => {
    followStateRef.current = reduceFloatingPanelChatThreadFollowState(followStateRef.current, {
      type: 'render',
      isLoading: args.isLoading,
    })
    if (!followStateRef.current.shouldFollow) return

    const element = scrollRef.current
    if (!element || typeof requestAnimationFrame !== 'function') return
    if (typeof scrollRafRef.current === 'number' && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(scrollRafRef.current)
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      element.scrollTop = element.scrollHeight
    })
  }, [args.isLoading, args.messageCount, args.streamRevision])

  React.useEffect(() => () => {
    if (typeof scrollRafRef.current !== 'number' || typeof cancelAnimationFrame !== 'function') return
    cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = null
  }, [])

  return { onScroll, scrollRef }
}
