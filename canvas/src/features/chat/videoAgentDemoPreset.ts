import { load as parseYaml } from 'js-yaml'
import {
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
  getWorkspaceFs,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { readWorkspaceInitializationDocsMirrorEntries, readWorkspaceInitializationSeedText } from '@/features/workspace-fs/workspaceSeedProvider'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { parseGenerationInvocation } from './generationInvocation'

type PlainRecord = Record<string, unknown>

export type VideoAgentDemoPresetResult =
  | { ok: true; prompt: string; presetPath: string; sourcePath: string }
  | { ok: false; error: string }

export const isVideoAgentDemoPresetError = (
  result: VideoAgentDemoPresetResult,
): result is Extract<VideoAgentDemoPresetResult, { ok: false }> => 'error' in result

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

const normalizeWorkspaceReferencePath = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw.startsWith('workspace:/')) return ''
  return raw.slice('workspace:'.length)
}

const readExecutablePrompt = (markdownText: string): string => {
  const match = markdownText.match(/```text\s*\n([\s\S]*?)\n```/i)
  return String(match?.[1] || '').trim()
}

const materializeWorkspaceFile = async (fs: WorkspaceFs, path: string, text: string): Promise<void> => {
  const parts = path.split('/').filter(Boolean)
  let parentPath = '/'
  for (const folderName of parts.slice(0, -1)) {
    const folderPath = `${parentPath === '/' ? '' : parentPath}/${folderName}`
    try {
      await fs.createFolder({ parentPath, name: folderName })
    } catch {
      void 0
    }
    parentPath = folderPath
  }
  const name = parts[parts.length - 1] || ''
  if (!name) return
  try {
    await fs.createFile({ parentPath, name, text })
  } catch {
    await fs.writeFileText(path, text)
  }
}

const readMirrorText = async (relPath: string): Promise<string> => {
  const normalized = relPath.replace(/^\/+/, '')
  const basename = normalized.split('/').filter(Boolean).pop() || ''
  const direct = await readWorkspaceInitializationSeedText({
    basename,
    relPathCandidates: [normalized, normalized.replace(/^docs\//, '')],
  })
  if (direct) return direct
  const entries = await readWorkspaceInitializationDocsMirrorEntries({ preferCompleteDataset: true })
  return String(entries.find(entry => entry.relPath === normalized)?.text || '')
}

export const resolveVideoAgentDemoPresetWorkspacePath = async (args: {
  fs: WorkspaceFs
  preferDocsMirror: boolean
}): Promise<string> => {
  if (!args.preferDocsMirror) return TEST_VALIDATION_WORKSPACE_SEED_PATH
  const docsMirrorPath = normalizeWorkspacePath(`/docs/${DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_BASENAME}`)
  const docsMirrorText = await args.fs.readFileText(docsMirrorPath).catch(() => '')
  return docsMirrorText ? docsMirrorPath : TEST_VALIDATION_WORKSPACE_SEED_PATH
}

export const loadVideoAgentDemoPreset = async (fsOverride?: WorkspaceFs): Promise<VideoAgentDemoPresetResult> => {
  const fs = fsOverride || await getWorkspaceFs()
  const presetPath = await resolveVideoAgentDemoPresetWorkspacePath({
    fs,
    preferDocsMirror: !fsOverride,
  })
  const markdownText = (await fs.readFileText(presetPath)) || await readMirrorText(`docs/${presetPath.replace(/^\/+/, '')}`)
  if (!markdownText) return { ok: false, error: `Preset unavailable: ${presetPath}` }
  if (!await fs.readFileText(presetPath)) await materializeWorkspaceFile(fs, presetPath, markdownText)
  const frontmatter = parseFrontmatter(markdownText)
  const inputs = isRecord(frontmatter?.inputs) ? frontmatter.inputs : null
  const sourcePath = normalizeWorkspaceReferencePath(inputs?.video_generation_demo_script)
  const prompt = readExecutablePrompt(markdownText)
  if (!inputs || !sourcePath || !prompt || !parseGenerationInvocation(prompt)) {
    return { ok: false, error: 'Preset is missing a valid source-backed /video-agent invocation.' }
  }
  const sourceText = (await fs.readFileText(sourcePath)) || await readMirrorText(sourcePath)
  if (!sourceText) {
    return { ok: false, error: `Import the preset source first: ${sourcePath}` }
  }
  if (!await fs.readFileText(sourcePath)) await materializeWorkspaceFile(fs, sourcePath, sourceText)
  return { ok: true, prompt, presetPath, sourcePath }
}
