import type { MermaidRuntimeApi } from '@/lib/mermaid/mermaidRuntime'

let elkLayoutRegistered = false
let elkLayoutsPromise: Promise<unknown> | null = null

export const ensureMermaidElkLayoutRegistered = async (mermaid: MermaidRuntimeApi): Promise<void> => {
  if (elkLayoutRegistered) return
  if (typeof mermaid.registerLayoutLoaders !== 'function') {
    elkLayoutRegistered = true
    return
  }
  try {
    if (!elkLayoutsPromise) {
      elkLayoutsPromise = import('@mermaid-js/layout-elk').then(m => (m as { default?: unknown }).default ?? m)
    }
    const loaders = await elkLayoutsPromise
    mermaid.registerLayoutLoaders(loaders)
  } catch {
    void 0
  } finally {
    elkLayoutRegistered = true
  }
}
