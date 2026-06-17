export type StoryboardHelpToast = {
  id: string
  kind: 'neutral'
  message: string
  ttlMs: number
}

export function buildStoryboardHelpToast(args: {
  message: string
}): StoryboardHelpToast {
  return {
    id: 'storyboard-widget-help',
    kind: 'neutral',
    message: String(args.message || '').trim(),
    ttlMs: 2800,
  }
}
