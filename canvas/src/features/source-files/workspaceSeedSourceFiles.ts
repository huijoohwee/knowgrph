import type { SourceFile } from '@/hooks/store/types'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { workspaceBasename } from '@/features/workspace-fs/path'
import { buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'

export const WORKSPACE_README_SOURCE_PATH = `workspace:${WORKSPACE_README_SEED_PATH}`
export const WORKSPACE_README_SOURCE_ID = `ws:${hashStringToHex(WORKSPACE_README_SOURCE_PATH)}`
export const TEST_VALIDATION_SOURCE_PATH = `workspace:${TEST_VALIDATION_WORKSPACE_SEED_PATH}`
export const TEST_VALIDATION_SOURCE_ID = `ws:${hashStringToHex(TEST_VALIDATION_SOURCE_PATH)}`
export const BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH = '/sandbox/test-data/test-generate-video/knowgrph-demo-video.md'
export const BUNDLED_TEST_VALIDATION_SOURCE_PATH = `workspace:${BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH}`
export const GEOSPATIAL_WORKSPACE_SOURCE_PATH = `workspace:${GEOSPATIAL_WORKSPACE_SEED_PATH}`
export const GEOSPATIAL_WORKSPACE_SOURCE_ID = `ws:${hashStringToHex(GEOSPATIAL_WORKSPACE_SOURCE_PATH)}`
export const BUNDLED_GEOSPATIAL_WORKSPACE_SEED_PATH = '/sandbox/demo/knowgrph-maps-grabmap-multim-demo.md'
export const BUNDLED_GEOSPATIAL_WORKSPACE_SOURCE_PATH = `workspace:${BUNDLED_GEOSPATIAL_WORKSPACE_SEED_PATH}`

const DEFAULT_WORKSPACE_SEED_SOURCE_PATHS = new Set<string>([
  `workspace:${LEGACY_WORKSPACE_README_PATH}`,
  `workspace:${LEGACY_WORKSPACE_TRIP_DEMO_PATH}`,
  BUNDLED_TEST_VALIDATION_SOURCE_PATH,
  BUNDLED_GEOSPATIAL_WORKSPACE_SOURCE_PATH,
  WORKSPACE_README_SOURCE_PATH,
  TEST_VALIDATION_SOURCE_PATH,
  GEOSPATIAL_WORKSPACE_SOURCE_PATH,
])

const WORKSPACE_SEED_SOURCE_PATH_BY_WORKSPACE_PATH = new Map<string, string>([
  [String(LEGACY_WORKSPACE_README_PATH), WORKSPACE_README_SOURCE_PATH],
  [String(WORKSPACE_README_SEED_PATH), WORKSPACE_README_SOURCE_PATH],
  [String(LEGACY_WORKSPACE_TRIP_DEMO_PATH), TEST_VALIDATION_SOURCE_PATH],
  [String(BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH), TEST_VALIDATION_SOURCE_PATH],
  [String(TEST_VALIDATION_WORKSPACE_SEED_PATH), TEST_VALIDATION_SOURCE_PATH],
  [String(BUNDLED_GEOSPATIAL_WORKSPACE_SEED_PATH), GEOSPATIAL_WORKSPACE_SOURCE_PATH],
  [String(GEOSPATIAL_WORKSPACE_SEED_PATH), GEOSPATIAL_WORKSPACE_SOURCE_PATH],
])

export function isDefaultWorkspaceSeedSourcePath(path: unknown): boolean {
  return DEFAULT_WORKSPACE_SEED_SOURCE_PATHS.has(String(path || '').trim())
}

export function isCanonicalWorkspaceSeedSourcePath(path: unknown): boolean {
  const normalized = String(path || '').trim()
  return (
    normalized === WORKSPACE_README_SOURCE_PATH
    || normalized === TEST_VALIDATION_SOURCE_PATH
    || normalized === GEOSPATIAL_WORKSPACE_SOURCE_PATH
  )
}

export function resolveWorkspaceSeedSourcePath(path: unknown): string | null {
  const normalized = String(path || '').trim()
  return WORKSPACE_SEED_SOURCE_PATH_BY_WORKSPACE_PATH.get(normalized) || null
}

export function defaultEnabledForWorkspaceSourcePath(path: unknown, forceEnabled = false): boolean {
  const normalized = String(path || '').trim()
  if (normalized === WORKSPACE_README_SOURCE_PATH) return true
  if (normalized === TEST_VALIDATION_SOURCE_PATH) return !!forceEnabled
  if (normalized === GEOSPATIAL_WORKSPACE_SOURCE_PATH) return !!forceEnabled
  return !!forceEnabled
}

function buildSeedSourceFile(args: {
  id: string
  path: string
  enabled: boolean
  name: string
}): SourceFile {
  return buildSourceFileRecord({
    id: args.id,
    name: args.name,
    text: '',
    enabled: args.enabled,
    source: { kind: 'local', path: args.path },
  })
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
  name: workspaceBasename(TEST_VALIDATION_WORKSPACE_SEED_PATH) || 'knowgrph-demo-video.md',
})

export const GEOSPATIAL_WORKSPACE_SOURCE_FILE: SourceFile = buildSeedSourceFile({
  id: GEOSPATIAL_WORKSPACE_SOURCE_ID,
  path: GEOSPATIAL_WORKSPACE_SOURCE_PATH,
  enabled: false,
  name: workspaceBasename(GEOSPATIAL_WORKSPACE_SEED_PATH) || 'knowgrph-maps-grabmap-multim-demo.md',
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
  const geospatialExisting =
    list.find(file => String(file?.source?.path || '') === GEOSPATIAL_WORKSPACE_SOURCE_PATH) || null
  const preserved = list.filter(file => !isDefaultWorkspaceSeedSourcePath(file?.source?.path))
  return [
    ...preserved,
    mergeCanonicalSourceFile(WORKSPACE_README_SOURCE_FILE, readmeExisting),
    mergeCanonicalSourceFile(TEST_VALIDATION_SOURCE_FILE, validationExisting),
    mergeCanonicalSourceFile(GEOSPATIAL_WORKSPACE_SOURCE_FILE, geospatialExisting),
  ]
}
