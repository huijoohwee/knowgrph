import {
  openFloatingPanelChatWithSeed,
} from '@/features/chat/floatingPanelChat/floatingPanelChatOpenSeed'

export async function handoffLiveCanvasHeroQuery(rawQuery: string): Promise<void> {
  const query = String(rawQuery || '')
  if (!query.trim()) throw new Error('Enter an agent-ready query before opening Chat.')

  // Resolve the lazy module before opening the panel; the pending draft is then
  // consumed by the mounted Chat surface without timing or DOM polling.
  await import('@/features/chat/FloatingPanelChat')
  if (!openFloatingPanelChatWithSeed({ text: query, mode: 'replace', delivery: 'queuedHandoff' })) {
    throw new Error('Chat is not ready. Keep the query here and try again.')
  }
}
