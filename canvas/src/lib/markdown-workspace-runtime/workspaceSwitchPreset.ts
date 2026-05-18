import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import {
  extractYamlFrontmatterHeaderBlock,
  parseCanvasWorkspaceFrontmatterPresetBlock,
  type CanvasWorkspaceFrontmatterPreset,
} from '@/lib/markdown/frontmatter'
import { hashSignatureParts } from '@/lib/hash/signature'

const WORKSPACE_SWITCH_PRESET_SCAN_CHARS = 4096

function mayContainWorkspaceSwitchPreset(text: string): boolean {
  const raw = String(text || '')
  if (!raw.trim()) return false
  const head = raw.slice(0, WORKSPACE_SWITCH_PRESET_SCAN_CHARS)
  return (
    head.includes('kgCanvas') ||
    head.includes('kgDocument') ||
    head.includes('kgFrontmatter') ||
    head.includes('kgMultiDimTable')
  )
}

export type CanvasWorkspacePresetSwitchContext = {
  rawBlock: string
  preset: CanvasWorkspaceFrontmatterPreset
}

export function readCanvasWorkspacePresetSwitchContext(text: string): CanvasWorkspacePresetSwitchContext | null {
  const raw = String(text || '')
  if (!mayContainWorkspaceSwitchPreset(raw)) return null
  const block = extractYamlFrontmatterHeaderBlock(raw)
  if (!block) return null
  const preset = parseCanvasWorkspaceFrontmatterPresetBlock(block)
  return preset ? { rawBlock: block.rawBlock, preset } : null
}

export function readCanvasWorkspacePresetForSwitch(text: string): CanvasWorkspaceFrontmatterPreset | null {
  return readCanvasWorkspacePresetSwitchContext(text)?.preset || null
}

export function hasCanvasWorkspacePresetForSwitch(text: string): boolean {
  return !!readCanvasWorkspacePresetSwitchContext(text)
}

export function applyCanvasWorkspacePresetForSwitch(args: {
  text?: string
  preset?: CanvasWorkspaceFrontmatterPreset | null
}): boolean {
  const preset = args.preset === undefined
    ? readCanvasWorkspacePresetForSwitch(String(args.text || ''))
    : args.preset
  if (!preset) return false
  return applyCanvasFrontmatterPreset({ preset })
}

export function buildCanvasWorkspacePresetSwitchSemanticKey(args: {
  activeDocumentKey: string
  rawBlock: string
  updatedAtMs: unknown
}): string {
  return hashSignatureParts([
    'markdown-workspace-frontmatter-switch-apply',
    String(args.activeDocumentKey || '').trim(),
    String(args.rawBlock || ''),
    typeof args.updatedAtMs === 'number' ? args.updatedAtMs : 0,
  ])
}
