import { readEnvString } from './config.env';

export const CLICK_URL =
  (typeof process !== 'undefined' && process.env && process.env.VITE_TRAE_BADGE_URL) ||
  'https://www.trae.ai/solo?showJoin=1';

export const PUBLIC_FALLBACK_JSON = (() => {
  const defaultPath = '';
  if (typeof import.meta === 'undefined') return defaultPath;
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const env = meta.env;
  const val = env && env.VITE_PUBLIC_FALLBACK_JSON;
  if (typeof val === 'string' && val.length > 0) return val;
  return defaultPath;
})();

export const SHARE_BACKEND_URL = (() => {
  if (typeof import.meta === 'undefined') return '';
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const env = meta.env;
  const val = env && env.VITE_SHARE_BACKEND_URL;
  return typeof val === 'string' ? val : '';
})();

export const IFRAME_ALLOWED_HOSTS = readEnvString('VITE_IFRAME_ALLOWED_HOSTS', '');

export const WORKSPACE_IMPORT_URL_TEST = readEnvString('VITE_WORKSPACE_IMPORT_URL_TEST', '')

export const WORKSPACE_IMPORT_IMAGE_URL_TEST = readEnvString('VITE_WORKSPACE_IMPORT_IMAGE_URL_TEST', '')

export const WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS = 50_000

export const WORKSPACE_IMPORT_AUTO_APPLY_ENABLED = true

export const WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILES = 10

export const WORKSPACE_IMPORT_AUTO_PARSE_MAX_TOTAL_CHARS = 500_000

export const WORKSPACE_IMPORT_AUTO_PARSE_MAX_FILE_CHARS = 250_000

export const WORKSPACE_IMPORT_DEFER_LOCAL_FILE_BYTES = 750_000

export * from './config.ls';
export * from './config.copy';
export * from './config.render';
export * from './config.flow-editor';
export * from './config.viewport-controls';
