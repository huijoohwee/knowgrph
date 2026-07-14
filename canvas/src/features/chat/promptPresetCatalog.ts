import { load as parseYaml } from 'js-yaml'
import { readWorkspaceInitializationDocsMirrorEntries } from '@/features/workspace-fs/workspaceSeedProvider'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { parseChatSkillSlashInvocation } from './chatSkillRegistry'
import { parseGenerationInvocation } from './generationInvocation'

type PlainRecord = Record<string, unknown>

export const PROMPT_PRESET_CATALOG_WORKSPACE_PATH = '/agentic-canvas-os/docs/PROMPT-PRESETS.md' as const
export const PROMPT_PRESET_CATALOG_SCHEMA = 'agentic-os-prompt-preset-catalog/v1' as const

export type PromptPresetActivation = 'source-backed-canvas' | 'chat-agent'

export type PromptPreset = {
  id: string
  label: string
  slashCommand: `/${string}`
  description: string
  activation: PromptPresetActivation
  prompt: string
}

export type PromptPresetCatalogResult =
  | { ok: true; presets: PromptPreset[]; sourcePath: typeof PROMPT_PRESET_CATALOG_WORKSPACE_PATH }
  | { ok: false; error: string }

export type PromptPresetResult =
  | { ok: true; preset: PromptPreset; sourcePath: typeof PROMPT_PRESET_CATALOG_WORKSPACE_PATH }
  | { ok: false; error: string }

export const isPromptPresetCatalogError = (
  result: PromptPresetCatalogResult | PromptPresetResult,
): result is Extract<typeof result, { ok: false }> => !result.ok

const isRecord = (value: unknown): value is PlainRecord => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const parseFrontmatter = (markdownText: string): PlainRecord | null => {
  if (!markdownText.startsWith('---\n')) return null
  const endIndex = markdownText.indexOf('\n---\n', 4)
  if (endIndex < 0) return null
  const parsed = parseYaml(markdownText.slice(4, endIndex))
  return isRecord(parsed) ? parsed : null
}

const normalizeSlashCommand = (value: unknown): `/${string}` | '' => {
  const command = String(value || '').trim()
  return command.startsWith('/') ? command as `/${string}` : ''
}

const parsePreset = (value: unknown): PromptPreset | null => {
  if (!isRecord(value)) return null
  const id = String(value.id || '').trim()
  const label = String(value.label || '').trim()
  const slashCommand = normalizeSlashCommand(value.slash_command)
  const description = String(value.description || '').trim()
  const activation = String(value.activation || '').trim()
  const prompt = String(value.prompt || '').trim()
  if (
    !id
    || !label
    || !slashCommand
    || !description
    || !prompt
    || (activation !== 'source-backed-canvas' && activation !== 'chat-agent')
  ) return null
  if (slashCommand === '/video-agent') {
    const invocation = parseGenerationInvocation(prompt)
    if (!invocation || !prompt.includes('@video-generation-demo-script') || activation !== 'source-backed-canvas') return null
  } else {
    const invocation = parseChatSkillSlashInvocation(prompt)
    if (!invocation || invocation.skill.slashCommand !== slashCommand || activation !== 'chat-agent') return null
  }
  return { id, label, slashCommand, description, activation, prompt }
}

const readCatalogText = async (fs: WorkspaceFs): Promise<string> => {
  const workspaceText = await fs.readFileText(PROMPT_PRESET_CATALOG_WORKSPACE_PATH).catch(() => '')
  if (workspaceText) return workspaceText
  const entries = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
  const relPath = PROMPT_PRESET_CATALOG_WORKSPACE_PATH.replace(/^\//, '')
  return String(entries.find(entry => entry.relPath === relPath)?.text || '')
}

export const loadPromptPresetCatalog = async (fsOverride?: WorkspaceFs): Promise<PromptPresetCatalogResult> => {
  const fs = fsOverride || await getWorkspaceFs()
  const markdownText = await readCatalogText(fs)
  if (!markdownText) return { ok: false, error: `Prompt preset catalog unavailable: ${PROMPT_PRESET_CATALOG_WORKSPACE_PATH}` }
  const frontmatter = parseFrontmatter(markdownText)
  if (frontmatter?.schema !== PROMPT_PRESET_CATALOG_SCHEMA || !Array.isArray(frontmatter.prompt_presets)) {
    return { ok: false, error: 'Prompt preset catalog frontmatter is invalid.' }
  }
  const presets = frontmatter.prompt_presets.map(parsePreset)
  if (presets.some(preset => !preset)) return { ok: false, error: 'Prompt preset catalog contains an invalid preset.' }
  const typedPresets = presets.filter((preset): preset is PromptPreset => Boolean(preset))
  const ids = new Set(typedPresets.map(preset => preset.id))
  const slashCommands = new Set(typedPresets.map(preset => preset.slashCommand))
  if (typedPresets.length === 0 || ids.size !== typedPresets.length || slashCommands.size !== typedPresets.length) {
    return { ok: false, error: 'Prompt preset catalog must contain unique ids and slash commands.' }
  }
  for (const preset of typedPresets) {
    if (preset.slashCommand !== `/${preset.id}`) {
      return { ok: false, error: `Prompt preset id and slash command do not match: ${preset.id}.` }
    }
  }
  return { ok: true, presets: typedPresets, sourcePath: PROMPT_PRESET_CATALOG_WORKSPACE_PATH }
}

export const loadPromptPreset = async (id: string, fsOverride?: WorkspaceFs): Promise<PromptPresetResult> => {
  const catalog = await loadPromptPresetCatalog(fsOverride)
  if (isPromptPresetCatalogError(catalog)) return catalog
  const preset = catalog.presets.find(candidate => candidate.id === String(id || '').trim())
  return preset
    ? { ok: true, preset, sourcePath: catalog.sourcePath }
    : { ok: false, error: `Unknown prompt preset: ${String(id || '').trim() || '(empty)'}` }
}
