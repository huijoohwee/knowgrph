import { clearStoryboardCardCleanSlateProperties } from '@/components/StoryboardCanvas/storyboardModel'
import { runStoryboardCardResetAction } from '@/components/StoryboardCanvas/storyboardCardResetAction'

export function testStoryboardResetActionClassifiesEmptyAndClearedStates() {
  const clearCalls: string[] = []
  const readClearCallCount = () => clearCalls.length
  const emptyResult = runStoryboardCardResetAction({
    card: { summary: '', output: '   ', action: '', dialogue: '', prompt: '', media: null, references: [] },
    resetCard: () => { clearCalls.push('clear') },
  })
  if (emptyResult.status !== 'empty' || emptyResult.changed || readClearCallCount() !== 0) {
    throw new Error('expected reset to leave an already empty storyboard card unchanged')
  }

  const clearedResult = runStoryboardCardResetAction({
    card: {
      summary: '/image.to-threejs @buddydrone.jpg',
      output: 'Rendered storyboard output',
      action: 'Run conversion',
      dialogue: '',
      prompt: 'Convert this image',
      media: { kind: 'image', url: 'https://example.test/buddydrone.jpg', sourceUrl: 'https://example.test/buddydrone.jpg', thumbnailUrl: null },
      references: [],
    },
    resetCard: () => { clearCalls.push('clear') },
  })
  if (clearedResult.status !== 'cleared' || !clearedResult.changed || readClearCallCount() !== 1) {
    throw new Error('expected reset to clear authored storyboard text and media exactly once')
  }

  const cleaned = clearStoryboardCardCleanSlateProperties({
    summary: '/image.to-threejs @buddydrone.jpg',
    output: 'Rendered storyboard output',
    prompt: 'Convert this image',
    mediaUrl: 'https://example.test/buddydrone.jpg',
    sourceUrl: 'https://example.test/buddydrone.jpg',
    referenceImages: ['https://example.test/buddydrone.jpg'],
    chatModel: 'seed-1-8-251228',
    properties: { output: 'nested output', imageUrl: 'https://example.test/preview.jpg' },
  })
  for (const key of ['summary', 'output', 'prompt', 'mediaUrl', 'sourceUrl', 'referenceImages']) {
    if (Object.prototype.hasOwnProperty.call(cleaned, key)) throw new Error(`expected reset to remove ${key}`)
  }
  if (Object.prototype.hasOwnProperty.call((cleaned.properties || {}) as Record<string, unknown>, 'output')) {
    throw new Error('expected reset to clear nested output projections')
  }
  if (cleaned.chatModel !== 'seed-1-8-251228') {
    throw new Error('expected reset to preserve widget runtime configuration')
  }
}
