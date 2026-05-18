import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

const WORKSPACE_SWITCH_PRESET_SCAN_CHARS = 4096

function mayContainWorkspaceSwitchPreset(text: string): boolean {
  const raw = String(text || '')
  if (!raw.trim()) return false
  const head = raw.slice(0, WORKSPACE_SWITCH_PRESET_SCAN_CHARS)
  return (
    head.includes('canvasSurfaceMode') ||
    head.includes('canvas2dRenderer') ||
    head.includes('frontmatterModeEnabled')
  )
}

export function hasCanvasWorkspacePresetForSwitch(text: string): boolean {
  const raw = String(text || '')
  if (!mayContainWorkspaceSwitchPreset(raw)) return false
  return !!parseCanvasWorkspaceFrontmatterPreset(raw)
}

export function shouldPrimeStrictFlowEditorModeForWorkspaceText(text: string): boolean {
  const raw = String(text || '')
  if (!mayContainWorkspaceSwitchPreset(raw)) return false
  const preset = parseCanvasWorkspaceFrontmatterPreset(raw)
  return !!(
    preset?.canvasSurfaceMode === '2d' &&
    preset?.canvas2dRenderer === 'flowEditor' &&
    preset?.documentSemanticMode === 'document' &&
    preset?.frontmatterModeEnabled === true
  )
}
