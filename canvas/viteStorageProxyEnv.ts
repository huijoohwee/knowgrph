const normalizeString = (value: unknown): string => String(value || '').trim()

export const resolveKnowgrphStorageDevProxyTarget = (args: {
  processEnv: Record<string, string | undefined>
  fileEnv: Record<string, string | undefined>
}): string => normalizeString(
  args.processEnv.KNOWGRPH_STORAGE_DEV_PROXY_TARGET
    || args.fileEnv.KNOWGRPH_STORAGE_DEV_PROXY_TARGET
    || 'https://airvio.co',
).replace(/\/+$/, '') || 'https://airvio.co'
