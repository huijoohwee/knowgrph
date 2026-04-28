import type { SourceFile } from '@/hooks/store/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { workspaceBasename } from '@/features/workspace-fs/path'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'

export const WORKSPACE_README_SOURCE_PATH = `workspace:${WORKSPACE_README_SEED_PATH}`
export const WORKSPACE_README_SOURCE_ID = `ws:${hashStringToHex(WORKSPACE_README_SOURCE_PATH)}`
export const TEST_VALIDATION_SOURCE_PATH = `workspace:${TEST_VALIDATION_WORKSPACE_SEED_PATH}`
export const TEST_VALIDATION_SOURCE_ID = `ws:${hashStringToHex(TEST_VALIDATION_SOURCE_PATH)}`

const DEFAULT_WORKSPACE_SEED_SOURCE_PATHS = new Set<string>([
  `workspace:${LEGACY_WORKSPACE_README_PATH}`,
  `workspace:${LEGACY_WORKSPACE_TRIP_DEMO_PATH}`,
  WORKSPACE_README_SOURCE_PATH,
  TEST_VALIDATION_SOURCE_PATH,
])

export function isDefaultWorkspaceSeedSourcePath(path: unknown): boolean {
  return DEFAULT_WORKSPACE_SEED_SOURCE_PATHS.has(String(path || '').trim())
}

export function isCanonicalWorkspaceSeedSourcePath(path: unknown): boolean {
  const normalized = String(path || '').trim()
  return normalized === WORKSPACE_README_SOURCE_PATH || normalized === TEST_VALIDATION_SOURCE_PATH
}

export function defaultEnabledForWorkspaceSourcePath(path: unknown, forceEnabled = false): boolean {
  const normalized = String(path || '').trim()
  if (normalized === WORKSPACE_README_SOURCE_PATH) return true
  if (normalized === TEST_VALIDATION_SOURCE_PATH) return !!forceEnabled
  return !!forceEnabled
}

function buildSeedSourceFile(args: {
  id: string
  path: string
  enabled: boolean
  name: string
}): SourceFile {
  return {
    id: args.id,
    name: args.name,
    text: '',
    enabled: args.enabled,
    status: 'idle',
    source: { kind: 'local', path: args.path },
  }
}

export const WORKSPACE_README_SOURCE_FILE: SourceFile = buildSeedSourceFile({
  id: WORKSPACE_README_SOURCE_ID,
  path: WORKSPACE_README_SOURCE_PATH,
  enabled: true,
  name: workspaceBasename(WORKSPACE_README_SEED_PATH) || 'README.md',
})

export const TEST_VALIDATION_SOURCE_FILE: SourceFile = buildSeedSourceFile({
  id: TEST_VALIDATION_SOURCE_ID,
  path: TEST_VALIDATION_SOURCE_PATH,
  enabled: CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  name: workspaceBasename(TEST_VALIDATION_WORKSPACE_SEED_PATH) || 'knowgrph-rich-media-generation-demo.md',
})

function mergeCanonicalSourceFile(base: SourceFile, existing: SourceFile | null): SourceFile {
  if (!existing) return base
  return {
    ...existing,
    id: base.id,
    name: base.name,
    enabled: base.enabled || !!existing.enabled,
    source: base.source,
  }
}

export function reconcileDefaultWorkspaceSeedSourceFiles(files: SourceFile[]): SourceFile[] {
  const list = Array.isArray(files) ? files : []
  const defaultFamily = list.filter(file => isDefaultWorkspaceSeedSourcePath(file?.source?.path))
  if (defaultFamily.length === 0) return list
  const hasCustomWorkspaceLocal = list.some(file => {
    const sourcePath = String(file?.source?.path || '')
    return sourcePath.startsWith('workspace:') && !isDefaultWorkspaceSeedSourcePath(sourcePath)
  })
  if (hasCustomWorkspaceLocal) return list
  const readmeExisting =
    list.find(file => String(file?.source?.path || '') === WORKSPACE_README_SOURCE_PATH) || null
  const validationExisting =
    list.find(file => String(file?.source?.path || '') === TEST_VALIDATION_SOURCE_PATH) || null
  const preserved = list.filter(file => !isDefaultWorkspaceSeedSourcePath(file?.source?.path))
  return [
    ...preserved,
    mergeCanonicalSourceFile(WORKSPACE_README_SOURCE_FILE, readmeExisting),
    mergeCanonicalSourceFile(TEST_VALIDATION_SOURCE_FILE, validationExisting),
  ]
}
