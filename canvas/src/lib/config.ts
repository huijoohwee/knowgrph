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

export * from './config.ls';
export * from './config.copy';
