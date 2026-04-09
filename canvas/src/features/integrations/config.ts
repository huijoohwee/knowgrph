export type IntegrationAiChatConfig = {
  enabled: boolean
  provider: 'native'
  openTab: 'chat'
}

export type IntegrationSimulationCommandsConfig = {
  enabled: boolean
  commandPrefix: string
  defaultPlatform: 'parallel' | 'reddit' | 'twitter'
  defaultSimulationId: string
}

export type IntegrationConfigs = {
  aiChat: IntegrationAiChatConfig
  simulationCommands: IntegrationSimulationCommandsConfig
  [key: string]: unknown
}

export const DEFAULT_INTEGRATION_CONFIGS: IntegrationConfigs = {
  aiChat: {
    enabled: true,
    provider: 'native',
    openTab: 'chat',
  },
  simulationCommands: {
    enabled: true,
    commandPrefix: '/simulate',
    defaultPlatform: 'parallel',
    defaultSimulationId: 'sim_demo',
  },
}

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const parseBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const parseString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const parsePlatform = (value: unknown, fallback: IntegrationSimulationCommandsConfig['defaultPlatform']): IntegrationSimulationCommandsConfig['defaultPlatform'] => {
  const raw = parseString(value, fallback).toLowerCase()
  if (raw === 'reddit') return 'reddit'
  if (raw === 'twitter') return 'twitter'
  return 'parallel'
}

export const normalizeIntegrationConfigs = (value: unknown): IntegrationConfigs => {
  const root = toObject(value)
  const legacyAiChatKey = ['aiChat', 'Deer', 'flow'].join('')
  const legacySimulationKey = ['miro', 'fish', 'Simulations'].join('')
  const aiChatRaw = toObject(root.aiChat || root[legacyAiChatKey])
  const simulationCommandsRaw = toObject(root.simulationCommands || root[legacySimulationKey])
  const aiChat: IntegrationAiChatConfig = {
    enabled: parseBool(aiChatRaw.enabled, DEFAULT_INTEGRATION_CONFIGS.aiChat.enabled),
    provider: 'native',
    openTab: 'chat',
  }
  const simulationCommands: IntegrationSimulationCommandsConfig = {
    enabled: parseBool(simulationCommandsRaw.enabled, DEFAULT_INTEGRATION_CONFIGS.simulationCommands.enabled),
    commandPrefix: parseString(simulationCommandsRaw.commandPrefix, DEFAULT_INTEGRATION_CONFIGS.simulationCommands.commandPrefix),
    defaultPlatform: parsePlatform(simulationCommandsRaw.defaultPlatform, DEFAULT_INTEGRATION_CONFIGS.simulationCommands.defaultPlatform),
    defaultSimulationId: parseString(simulationCommandsRaw.defaultSimulationId, DEFAULT_INTEGRATION_CONFIGS.simulationCommands.defaultSimulationId),
  }
  return {
    ...root,
    aiChat,
    simulationCommands,
  }
}

export const parseIntegrationConfigsJson = (raw: string | null | undefined): IntegrationConfigs => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return normalizeIntegrationConfigs(DEFAULT_INTEGRATION_CONFIGS)
  try {
    const parsed = JSON.parse(raw)
    return normalizeIntegrationConfigs(parsed)
  } catch {
    return normalizeIntegrationConfigs(DEFAULT_INTEGRATION_CONFIGS)
  }
}

export const stringifyIntegrationConfigs = (value: IntegrationConfigs): string => {
  try {
    return JSON.stringify(normalizeIntegrationConfigs(value))
  } catch {
    return JSON.stringify(DEFAULT_INTEGRATION_CONFIGS)
  }
}
