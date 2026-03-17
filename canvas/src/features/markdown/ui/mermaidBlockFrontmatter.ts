import { load } from 'js-yaml'
import { parseMermaidConfigFromFrontmatter, type MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const mergeConfig = (base: MermaidInitConfig | null, override: MermaidInitConfig | null): MermaidInitConfig | null => {
  if (!base && !override) return null
  if (!base) return override
  if (!override) return base
  const baseVars = isRecord((base as Record<string, unknown>).themeVariables) ? ((base as Record<string, unknown>).themeVariables as Record<string, unknown>) : null
  const overrideVars = isRecord((override as Record<string, unknown>).themeVariables)
    ? ((override as Record<string, unknown>).themeVariables as Record<string, unknown>)
    : null
  const merged: Record<string, unknown> = { ...base, ...override }
  if (baseVars || overrideVars) {
    merged.themeVariables = { ...(baseVars || {}), ...(overrideVars || {}) }
  }
  return merged
}

const parseMermaidInitConfigFromYamlObject = (raw: unknown): MermaidInitConfig | null => {
  if (!isRecord(raw)) return null

  const frontmatterDerived = parseMermaidConfigFromFrontmatter(raw as any)
  if (frontmatterDerived) return frontmatterDerived

  const hasKnownKeys =
    typeof raw.theme === 'string' ||
    isRecord(raw.themeVariables) ||
    typeof raw.securityLevel === 'string' ||
    typeof raw.startOnLoad === 'boolean'
  if (!hasKnownKeys) return null

  return raw as MermaidInitConfig
}

export function splitMermaidBlockFrontmatter(code: string): {
  diagramCode: string
  mergedInitConfig: MermaidInitConfig | null
} {
  const raw = String(code || '')
  if (!raw.startsWith('---')) {
    return { diagramCode: raw, mergedInitConfig: null }
  }

  const lines = raw.split('\n')
  if (lines.length < 3) return { diagramCode: raw, mergedInitConfig: null }
  if (lines[0].trim() !== '---') return { diagramCode: raw, mergedInitConfig: null }

  let endIdx = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIdx = i
      break
    }
  }
  if (endIdx <= 0) return { diagramCode: raw, mergedInitConfig: null }

  const yamlText = lines.slice(1, endIdx).join('\n').trim()
  const diagramCode = lines.slice(endIdx + 1).join('\n').replace(/^\n+/, '')

  let yamlObj: unknown = null
  try {
    yamlObj = yamlText ? load(yamlText) : null
  } catch {
    yamlObj = null
  }

  const blockInit = parseMermaidInitConfigFromYamlObject(yamlObj)
  return { diagramCode, mergedInitConfig: mergeConfig(null, blockInit) }
}

export function mergeMermaidInitConfig(base: MermaidInitConfig | null, block: MermaidInitConfig | null): MermaidInitConfig | null {
  return mergeConfig(base, block)
}

