export type StoryboardClearOutputActionResult =
  | {
      status: 'empty'
      changed: false
    }
  | {
      status: 'cleared'
      changed: true
    }

export function runStoryboardClearOutputAction(args: {
  output: string | null | undefined
  clearOutput: () => void
}): StoryboardClearOutputActionResult {
  if (!String(args.output || '').trim()) {
    return {
      status: 'empty',
      changed: false,
    }
  }
  args.clearOutput()
  return {
    status: 'cleared',
    changed: true,
  }
}
