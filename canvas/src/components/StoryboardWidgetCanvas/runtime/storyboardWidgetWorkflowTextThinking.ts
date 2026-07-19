import { isFlowVideoScriptFormId } from '@/lib/config'
import { parseChatSkillSlashInvocation } from '@/features/chat/chatSkillRegistry'

type StoryboardWidgetTextThinkingOptions = {
  chatMaxCompletionTokens: unknown
  chatReasoningEffort: unknown
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
  resolvedReasoningEffort: unknown
  resolvedThinkingJson: unknown
  resolvedThinkingType: unknown
}): StoryboardWidgetTextThinkingOptions {
  if (!isFlowVideoScriptFormId(args.formId)) {
    if (parseChatSkillSlashInvocation(args.prompt)) {
      return {
        chatMaxCompletionTokens: args.resolvedMaxCompletionTokens,
        chatReasoningEffort: 'minimal',
        chatThinkingJson: '',
        chatThinkingType: 'disabled',
      }
    }
    return {
      chatMaxCompletionTokens: args.resolvedMaxCompletionTokens,
      chatReasoningEffort: args.resolvedReasoningEffort,
      chatThinkingJson: args.resolvedThinkingJson,
      chatThinkingType: args.resolvedThinkingType,
    }
  }
  return {
    chatMaxCompletionTokens: owns(args.localProperties, 'chatMaxCompletionTokens')
      ? args.resolvedMaxCompletionTokens
      : Math.max(Number(args.resolvedMaxCompletionTokens) || 0, VIDEO_SCRIPT_MINIMUM_COMPLETION_TOKENS),
    chatReasoningEffort: args.resolvedReasoningEffort,
    chatThinkingJson: '',
    chatThinkingType: owns(args.localProperties, 'chatThinkingType')
      ? args.resolvedThinkingType
      : 'enabled',
  }
}
