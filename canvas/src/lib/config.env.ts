export function readEnvString(key: string, defaultValue: string): string {
  if (typeof import.meta === 'undefined') return defaultValue;
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const env = meta.env;
  const raw = env && env[key];
  if (typeof raw !== 'string') return defaultValue;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : defaultValue;
}

