import { resolveEffectiveTextGenerationWidgetProperties } from '@/features/flow-editor-manager/registryTemplates'

export async function testTextWidgetAuthModePrefersGlobalByokOverLocalServerManaged() {
  const props = resolveEffectiveTextGenerationWidgetProperties({
    providerFamily: 'openai',
    localProperties: {
      chatAuthMode: 'serverManaged',
    },
    globalProperties: {
      chatAuthMode: 'byok',
    },
  })
  if (String(props.chatAuthMode || '') !== 'byok') {
    throw new Error(`expected merged auth mode to be byok, got ${String(props.chatAuthMode)}`)
  }
}

