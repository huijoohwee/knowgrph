import { clearRichMediaOutputProperties } from '@/features/chat/richMediaRun'

export function buildStoryboardWidgetTextRunSourceState(args: {
  properties: Record<string, unknown>
  loading: boolean
  runAt: string
}): Record<string, unknown> {
  return {
    ...clearRichMediaOutputProperties(args.properties),
    outputLoading: args.loading ? true : undefined,
    outputLoadingKind: args.loading ? 'text' : undefined,
    lastRunAt: args.runAt,
  }
}
