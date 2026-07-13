import { resolveStoryboardWidgetTextThinkingOptions } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowTextThinking'

export function testVideoScriptWorkflowDefaultsToEnabledThinkingMode() {
  const resolved = resolveStoryboardWidgetTextThinkingOptions({
    formId: 'videoScript',
    localProperties: {},
    resolvedMaxCompletionTokens: 1000,
    resolvedThinkingJson: '{"type":"enabled"}',
    resolvedThinkingType: 'enabled',
  })
  if (resolved.chatThinkingType !== 'enabled' || resolved.chatThinkingJson !== '') {
    throw new Error(`expected videoScript to use the typed enabled thinking mode, got ${JSON.stringify(resolved)}`)
  }
  if (resolved.chatMaxCompletionTokens !== 4096) {
    throw new Error(`expected videoScript to reserve enough final-output tokens, got ${JSON.stringify(resolved)}`)
  }
}

export function testVideoScriptWorkflowPreservesTypedThinkingOverride() {
  const resolved = resolveStoryboardWidgetTextThinkingOptions({
    formId: 'videoScript',
    localProperties: {
      chatMaxCompletionTokens: 2048,
      chatThinkingJson: '{"type":"auto"}',
      chatThinkingType: 'auto',
    },
    resolvedMaxCompletionTokens: 2048,
    resolvedThinkingJson: '{"type":"auto"}',
    resolvedThinkingType: 'auto',
  })
  if (resolved.chatThinkingType !== 'auto' || resolved.chatThinkingJson !== '') {
    throw new Error(`expected videoScript to preserve its typed thinking override without a conflicting JSON payload, got ${JSON.stringify(resolved)}`)
  }
  if (resolved.chatMaxCompletionTokens !== 2048) {
    throw new Error(`expected explicit videoScript token budget to remain authoritative, got ${JSON.stringify(resolved)}`)
  }
}

export function testOrdinaryTextWorkflowPreservesGlobalThinkingMode() {
  const resolved = resolveStoryboardWidgetTextThinkingOptions({
    formId: 'textGeneration',
    localProperties: {},
    resolvedMaxCompletionTokens: 1000,
    resolvedThinkingJson: '{"type":"enabled"}',
    resolvedThinkingType: 'enabled',
  })
  if (resolved.chatThinkingType !== 'enabled' || resolved.chatThinkingJson !== '{"type":"enabled"}') {
    throw new Error(`expected non-video text workflows to preserve shared settings, got ${JSON.stringify(resolved)}`)
  }
  if (resolved.chatMaxCompletionTokens !== 1000) {
    throw new Error(`expected ordinary text workflow to preserve the shared token budget, got ${JSON.stringify(resolved)}`)
  }
}
