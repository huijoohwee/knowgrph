import {
  DEFAULT_INTEGRATION_CONFIGS,
  parseIntegrationConfigsJson,
  stringifyIntegrationConfigs,
} from '@/features/integrations/config'

export function testIntegrationConfigsNormalizeKnownKeysAndPreserveUnknowns() {
  const parsed = parseIntegrationConfigsJson(JSON.stringify({
    aiChat: {
      enabled: false,
      provider: 'external-provider',
      openTab: 'other-tab',
    },
    simulationCommands: {
      enabled: false,
      commandPrefix: '  /run  ',
      defaultPlatform: 'twitter',
      defaultSimulationId: '  sim_live  ',
    },
    customProvider: {
      enabled: true,
      endpoint: '/custom',
      nested: { mode: 'kept' },
    },
  }))

  if (parsed.aiChat.enabled !== false || parsed.aiChat.provider !== 'native' || parsed.aiChat.openTab !== 'chat') {
    throw new Error(`expected aiChat known keys to normalize to the shared native chat surface, got ${JSON.stringify(parsed.aiChat)}`)
  }
  if (
    parsed.simulationCommands.enabled !== false ||
    parsed.simulationCommands.commandPrefix !== '/run' ||
    parsed.simulationCommands.defaultPlatform !== 'twitter' ||
    parsed.simulationCommands.defaultSimulationId !== 'sim_live'
  ) {
    throw new Error(`expected simulationCommands known keys to normalize scalar values, got ${JSON.stringify(parsed.simulationCommands)}`)
  }
  const customProvider = parsed.customProvider as { enabled?: unknown; endpoint?: unknown; nested?: { mode?: unknown } } | undefined
  if (
    customProvider?.enabled !== true ||
    customProvider.endpoint !== '/custom' ||
    customProvider.nested?.mode !== 'kept'
  ) {
    throw new Error(`expected unknown integration config keys to be preserved, got ${JSON.stringify(parsed)}`)
  }
}

export function testIntegrationConfigsFallbackAndStringifyStayTyped() {
  const malformed = parseIntegrationConfigsJson('{not valid json')
  if (
    malformed.aiChat.enabled !== DEFAULT_INTEGRATION_CONFIGS.aiChat.enabled ||
    malformed.simulationCommands.commandPrefix !== DEFAULT_INTEGRATION_CONFIGS.simulationCommands.commandPrefix
  ) {
    throw new Error(`expected malformed integration config JSON to fall back to defaults, got ${JSON.stringify(malformed)}`)
  }

  const roundTrip = parseIntegrationConfigsJson(stringifyIntegrationConfigs({
    ...DEFAULT_INTEGRATION_CONFIGS,
    customProvider: {
      preserved: true,
    },
  }))
  const customProvider = roundTrip.customProvider as { preserved?: unknown } | undefined
  if (customProvider?.preserved !== true) {
    throw new Error(`expected stringifyIntegrationConfigs to preserve unknown integration config keys, got ${JSON.stringify(roundTrip)}`)
  }
}
