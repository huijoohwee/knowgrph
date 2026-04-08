export type IntegrationAiChatConfig = {
  enabled: boolean
  provider: 'deerflow'
  openTab: 'chat'
}

export type IntegrationMirofishConfig = {
  enabled: boolean
  commandPrefix: string
  defaultPlatform: 'parallel' | 'reddit' | 'twitter'
  defaultSimulationId: string
}

export type IntegrationConfigs = {
  aiChatDeerflow: IntegrationAiChatConfig
  mirofishSimulations: IntegrationMirofishConfig
  [key: string]: unknown
}

export const DEFAULT_INTEGRATION_CONFIGS: IntegrationConfigs = {
  aiChatDeerflow: {
    enabled: true,
    provider: 'deerflow',
    openTab: 'chat',
  },
  mirofishSimulations: {
    enabled: true,
    commandPrefix: '/mirofish',
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

const parsePlatform = (value: unknown, fallback: IntegrationMirofishConfig['defaultPlatform']): IntegrationMirofishConfig['defaultPlatform'] => {
  const raw = parseString(value, fallback).toLowerCase()
  if (raw === 'reddit') return 'reddit'
  if (raw === 'twitter') return 'twitter'
  return 'parallel'
}

export const normalizeIntegrationConfigs = (value: unknown): IntegrationConfigs => {
  const root = toObject(value)
  const aiChatRaw = toObject(root.aiChatDeerflow)
  const mirofishRaw = toObject(root.mirofishSimulations)
  return {
    ...root,
    aiChatDeerflow: {
      enabled: parseBool(aiChatRaw.enabled, DEFAULT_INTEGRATION_CONFIGS.aiChatDeerflow.enabled),
      provider: 'deerflow',
      openTab: 'chat',
    },
    mirofishSimulations: {
      enabled: parseBool(mirofishRaw.enabled, DEFAULT_INTEGRATION_CONFIGS.mirofishSimulations.enabled),
      commandPrefix: parseString(mirofishRaw.commandPrefix, DEFAULT_INTEGRATION_CONFIGS.mirofishSimulations.commandPrefix),
      defaultPlatform: parsePlatform(mirofishRaw.defaultPlatform, DEFAULT_INTEGRATION_CONFIGS.mirofishSimulations.defaultPlatform),
      defaultSimulationId: parseString(mirofishRaw.defaultSimulationId, DEFAULT_INTEGRATION_CONFIGS.mirofishSimulations.defaultSimulationId),
    },
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
