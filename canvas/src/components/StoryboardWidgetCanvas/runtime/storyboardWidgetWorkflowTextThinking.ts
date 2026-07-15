import { isFlowVideoScriptFormId } from '@/lib/config'
import { parseChatSkillSlashInvocation } from '@/features/chat/chatSkillRegistry'

type StoryboardWidgetTextThinkingOptions = {
  chatMaxCompletionTokens: unknown
  chatThinkingJson: unknown
  chatThinkingType: unknown
}

const VIDEO_SCRIPT_MINIMUM_COMPLETION_TOKENS = 4096

const owns = (record: Record<string, unknown>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(record, key)
)

export function resolveStoryboardWidgetTextThinkingOptions(args: {
  formId: unknown
  localProperties: Record<string, unknown>
  prompt?: unknown
  resolvedMaxCompletionTokens: unknown
  resolvedThinkingJson: unknown
  resolvedThinkingType: unknown
}): StoryboardWidgetTextThinkingOptions {
  if (!isFlowVideoScriptFormId(args.formId)) {
    if (parseChatSkillSlashInvocation(args.prompt)) {
      return {
        chatMaxCompletionTokens: args.resolvedMaxCompletionTokens,
        chatThinkingJson: '',
        chatThinkingType: 'disabled',
      }
    }
    return {
      chatMaxCompletionTokens: args.resolvedMaxCompletionTokens,
      chatThinkingJson: args.resolvedThinkingJson,
      chatThinkingType: args.resolvedThinkingType,
    }
  }
  return {
    chatMaxCompletionTokens: owns(args.localProperties, 'chatMaxCompletionTokens')
      ? args.resolvedMaxCompletionTokens
      : Math.max(Number(args.resolvedMaxCompletionTokens) || 0, VIDEO_SCRIPT_MINIMUM_COMPLETION_TOKENS),
    chatThinkingJson: '',
    chatThinkingType: owns(args.localProperties, 'chatThinkingType')
      ? args.resolvedThinkingType
      : 'enabled',
  }
}
