export type WebpageProxyRuntimeScriptPolicy = '' | 'allow' | 'strip'

export type WebpageProxyRuntimePlan = {
  effectiveScriptPolicy: WebpageProxyRuntimeScriptPolicy
  enableNetworkInterception: boolean
  enableDynamicResourceRewrite: boolean
  injectStripCsp: boolean
}

const normalizeWebpageProxyScriptPolicy = (value: unknown): WebpageProxyRuntimeScriptPolicy => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'allow' || normalized === 'strip') return normalized
  return ''
}

export const buildWebpageProxyRuntimePlan = (value: unknown): WebpageProxyRuntimePlan => {
  const effectiveScriptPolicy = normalizeWebpageProxyScriptPolicy(value)
  const assetRewriteEnabled = effectiveScriptPolicy === 'allow'
  return {
    effectiveScriptPolicy,
    enableNetworkInterception: false,
    enableDynamicResourceRewrite: assetRewriteEnabled,
    injectStripCsp: effectiveScriptPolicy === 'strip',
  }
}
