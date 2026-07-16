import type { StoryboardCardReference } from '@/components/StoryboardCanvas/storyboardModel'
import type { StoryboardDisplayMedia } from '@/components/StoryboardCanvas/storyboardMediaSelectionPanel'

export const isStoryboardDisplayReference = (
  reference: StoryboardCardReference,
): reference is StoryboardCardReference & { kind: StoryboardDisplayMedia['kind'] } => (
  reference.kind === 'image'
  || reference.kind === 'svg'
  || reference.kind === 'video'
  || reference.kind === 'audio'
  || reference.kind === 'iframe'
)

export const isStoryboardImageReference = (
  reference: StoryboardCardReference,
): reference is StoryboardCardReference & { kind: 'image' | 'svg' } => (
  reference.kind === 'image' || reference.kind === 'svg'
)
