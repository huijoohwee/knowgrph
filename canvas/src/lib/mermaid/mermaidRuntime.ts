import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

export type MermaidRuntimeRenderResult = {
  svg: string
  bindFunctions?: (element: Element) => void
}

export type MermaidRuntimeApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<MermaidRuntimeRenderResult | string>
  registerLayoutLoaders?: (loaders: unknown) => void
}

type MermaidRuntimeBranch = 'standard' | 'elk'

const isMermaidApi = (val: unknown): val is MermaidRuntimeApi => {
  if (!val || typeof val !== 'object') return false
  const v = val as Record<string, unknown>
  return typeof v.initialize === 'function' && typeof v.render === 'function'
}

const getTestMermaidApi = (): MermaidRuntimeApi | null => {
  const anyGlobal = globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }
  const candidate = anyGlobal.__KG_TEST_MERMAID_API__
  return isMermaidApi(candidate) ? candidate : null
}

let mermaidModulePromise: Promise<MermaidRuntimeApi> | null = null
let lastStandardInitKey = ''
let lastElkInitKey = ''

export const resolveMermaidRuntimeBranch = (config: MermaidInitConfig): MermaidRuntimeBranch => {
  const layout = String((config as Record<string, unknown>)?.layout || '').trim().toLowerCase()
  if (layout === 'elk') return 'elk'
  const flowchart = (config as Record<string, unknown>)?.flowchart
  if (!flowchart || typeof flowchart !== 'object' || Array.isArray(flowchart)) return 'standard'
  const defaultRenderer = String((flowchart as Record<string, unknown>)?.defaultRenderer || '').trim().toLowerCase()
  return defaultRenderer === 'elk' ? 'elk' : 'standard'
}

export const cleanupMermaidRenderArtifacts = (renderId: string): void => {
  const id = String(renderId || '').trim()
  if (!id || typeof document === 'undefined') return
  try {
    const wrapper = document.getElementById(`d${id}`)
    if (wrapper && wrapper.parentElement === document.body) wrapper.remove()
  } catch {
    void 0
  }
  try {
    const orphan = document.getElementById(id)
    if (orphan && orphan.parentElement === document.body) orphan.remove()
  } catch {
    void 0
  }
}

export const loadMermaidRuntimeApi = async (): Promise<MermaidRuntimeApi> => {
  const stub = getTestMermaidApi()
  if (stub) return stub
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then(mod => {
      const candidate: unknown = (mod as { default?: unknown }).default ?? mod
      if (!isMermaidApi(candidate)) {
        throw new Error('Mermaid module did not match expected API')
      }
      return candidate
    }).catch(err => {
      mermaidModulePromise = null
      throw err
    })
  }
  return mermaidModulePromise
}

export const ensureStandardMermaidInitialized = async (config: MermaidInitConfig): Promise<MermaidRuntimeApi> => {
  const mermaid = await loadMermaidRuntimeApi()
  const key = JSON.stringify(config || {})
  if (key !== lastStandardInitKey) {
    try {
      mermaid.initialize({ startOnLoad: false, ...config })
    } finally {
      lastStandardInitKey = key
    }
  }
  return mermaid
}

export const ensureElkMermaidInitialized = async (config: MermaidInitConfig): Promise<MermaidRuntimeApi> => {
  const mermaid = await loadMermaidRuntimeApi()
  const { ensureMermaidElkLayoutRegistered } = await import('@/lib/mermaid/mermaidElkRuntime')
  await ensureMermaidElkLayoutRegistered(mermaid)
  const key = JSON.stringify(config || {})
  if (key !== lastElkInitKey) {
    try {
      mermaid.initialize({ startOnLoad: false, ...config })
    } finally {
      lastElkInitKey = key
    }
  }
  return mermaid
}

export const ensureMermaidInitialized = async (config: MermaidInitConfig): Promise<MermaidRuntimeApi> => {
  return resolveMermaidRuntimeBranch(config) === 'elk'
    ? ensureElkMermaidInitialized(config)
    : ensureStandardMermaidInitialized(config)
}
