import { readEnvString as readSharedEnvString } from 'grph-shared/config/env'

export * from 'grph-shared/config/env'

export function readEnvStringFromRecord(
  env: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!env) return null
  const raw = env[key]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function readEnvString(key: string, defaultValue: string): string {
  const metaEnv = (() => {
    if (typeof import.meta === 'undefined') return undefined
    try {
      return {
        VITE_IFRAME_ALLOWED_HOSTS: import.meta.env.VITE_IFRAME_ALLOWED_HOSTS,
        VITE_MARKDOWN_PIPELINE_BASENAME: import.meta.env.VITE_MARKDOWN_PIPELINE_BASENAME,
        VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH: import.meta.env.VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH,
        VITE_MARKDOWN_PIPELINE_OUTPUT_DIR: import.meta.env.VITE_MARKDOWN_PIPELINE_OUTPUT_DIR,
        VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH: import.meta.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH,
        VITE_WORKSPACE_IMPORT_IMAGE_URL_TEST: import.meta.env.VITE_WORKSPACE_IMPORT_IMAGE_URL_TEST,
        VITE_WORKSPACE_IMPORT_URL_TEST: import.meta.env.VITE_WORKSPACE_IMPORT_URL_TEST,
      } satisfies Record<string, unknown>
    } catch {
      return undefined
    }
  })()
  const browserValue = readEnvStringFromRecord(metaEnv, key)
  if (browserValue) return browserValue
  return readSharedEnvString(key, defaultValue)
}
