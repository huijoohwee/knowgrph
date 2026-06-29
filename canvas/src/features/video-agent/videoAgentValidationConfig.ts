import { readEnvString } from '@/lib/config.env'

export const VIDEO_AGENT_VALIDATION_CONFIG_STORAGE_KEY = 'knowgrph:video-agent:validation-config:v1'
export const VIDEO_AGENT_VALIDATION_DOC_PATH_ENV_KEY = 'VITE_KNOWGRPH_VIDEO_AGENT_VALIDATION_DOC_PATH'
export const VIDEO_AGENT_VALIDATION_URLS_ENV_KEY = 'VITE_KNOWGRPH_VIDEO_AGENT_VALIDATION_URLS'

export type VideoAgentValidationConfig = {
  validationDocPath: string
  importUrls: string[]
}

export const splitVideoAgentValidationUrls = (value: string): string[] =>
  Array.from(new Set(
    String(value || '')
      .split(/[,\n]+/)
      .map(part => part.trim())
      .filter(Boolean),
  ))

export const serializeVideoAgentValidationUrls = (urls: readonly string[]): string =>
  splitVideoAgentValidationUrls(urls.join('\n')).join('\n')

export function normalizeVideoAgentValidationConfig(value: Partial<VideoAgentValidationConfig> | null | undefined): VideoAgentValidationConfig {
  return {
    validationDocPath: String(value?.validationDocPath || '').trim(),
    importUrls: splitVideoAgentValidationUrls(Array.isArray(value?.importUrls) ? value.importUrls.join('\n') : ''),
  }
}

export function readVideoAgentValidationConfigFromEnv(): VideoAgentValidationConfig {
  return normalizeVideoAgentValidationConfig({
    validationDocPath: readEnvString(VIDEO_AGENT_VALIDATION_DOC_PATH_ENV_KEY, ''),
    importUrls: splitVideoAgentValidationUrls(readEnvString(VIDEO_AGENT_VALIDATION_URLS_ENV_KEY, '')),
  })
}

export function readVideoAgentValidationConfigFromStorage(storage?: Storage | null): VideoAgentValidationConfig | null {
  if (!storage) return null
  try {
    const raw = String(storage.getItem(VIDEO_AGENT_VALIDATION_CONFIG_STORAGE_KEY) || '').trim()
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VideoAgentValidationConfig>
    return normalizeVideoAgentValidationConfig(parsed)
  } catch {
    return null
  }
}

export function writeVideoAgentValidationConfigToStorage(
  config: Partial<VideoAgentValidationConfig>,
  storage?: Storage | null,
): VideoAgentValidationConfig {
  const normalized = normalizeVideoAgentValidationConfig(config)
  if (storage) {
    try {
      storage.setItem(VIDEO_AGENT_VALIDATION_CONFIG_STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      void 0
    }
  }
  return normalized
}

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readVideoAgentValidationConfig(storage: Storage | null = getBrowserStorage()): VideoAgentValidationConfig {
  const envConfig = readVideoAgentValidationConfigFromEnv()
  const storedConfig = readVideoAgentValidationConfigFromStorage(storage)
  if (!storedConfig) return envConfig
  return {
    validationDocPath: storedConfig.validationDocPath || envConfig.validationDocPath,
    importUrls: storedConfig.importUrls.length > 0 ? storedConfig.importUrls : envConfig.importUrls,
  }
}

export function writeVideoAgentValidationConfig(config: Partial<VideoAgentValidationConfig>): VideoAgentValidationConfig {
  return writeVideoAgentValidationConfigToStorage(config, getBrowserStorage())
}
