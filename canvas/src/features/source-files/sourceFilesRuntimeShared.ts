import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  resolveWorkspaceSourceIndexSnapshot,
  type WorkspaceSourceIndex,
} from '@/features/workspace-fs/sourceIndex'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { scheduleApplyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import {
  CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE,
  DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_REL_PATH,
  isInitializationWorkspacePath,
  resolveWorkspaceStartupActivePath,
} from '@/features/workspace-fs/workspaceFs'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

export function resolveMaterializedWorkspaceActivePath(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath | null {
  const raw = args?.activePathOverride ?? args?.explorerActivePath ?? null
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  const withoutWorkspacePrefix = trimmed.startsWith('workspace:') ? trimmed.slice('workspace:'.length) : trimmed
  const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)
  return normalized === '/' ? null : normalized
}

export function buildMaterializedWorkspaceActivePathKey(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): string {
  return String(resolveMaterializedWorkspaceActivePath(args) || '')
}

export function buildMaterializedWorkspaceForceIncludePaths(args?: {
  activePathOverride?: WorkspacePath | null
  explorerActivePath?: WorkspacePath | null
}): WorkspacePath[] {
  const activePath = resolveMaterializedWorkspaceActivePath(args)
  return activePath ? [activePath] : []
}

export async function resolveWorkspaceMaterializationEntries(args: {
  fs: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
}): Promise<WorkspaceEntry[]> {
  return Array.isArray(args.workspaceEntries) ? args.workspaceEntries : await args.fs.listEntries()
}

export function readReusableWorkspaceEntriesSnapshot(
  workspaceEntries: WorkspaceEntry[] | null | undefined,
): WorkspaceEntry[] | undefined {
  return Array.isArray(workspaceEntries) && workspaceEntries.length > 0 ? workspaceEntries : undefined
}

export function buildInitialWorkspaceStartupSnapshot(args: {
  currentActivePath: WorkspacePath | null
  desiredActivePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
  lastSetActivePath?: unknown
  preferCustomValidationSeed?: boolean
}): {
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
} {
  if (args.lastSetActivePath && !args.preferCustomValidationSeed) {
    if (!args.desiredActivePath || args.desiredActivePath === args.currentActivePath) {
      return {
        activePath: args.currentActivePath,
        workspaceEntries: [],
      }
    }
  }
  return {
    activePath: args.desiredActivePath,
    workspaceEntries: args.workspaceEntries,
  }
}

export async function materializeActiveWorkspaceEntryIntoSourceFiles(args?: {
  activePathOverride?: WorkspacePath | null
  fs?: Awaited<ReturnType<typeof getWorkspaceFs>>
  workspaceEntries?: WorkspaceEntry[]
  sourcesByPath?: WorkspaceSourceIndex
  applyToGraph?: boolean
}): Promise<void> {
  const activePath = resolveMaterializedWorkspaceActivePath({
    activePathOverride: args?.activePathOverride ?? null,
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  if (!activePath) return
  const fs = args?.fs || (await getWorkspaceFs())
  await fs.ensureSeed()
  const workspaceEntries = await resolveWorkspaceMaterializationEntries({
    fs,
    workspaceEntries: args?.workspaceEntries,
  })
  const activeWorkspaceEntry = workspaceEntries.find(
    entry => entry.kind === 'file' && normalizeWorkspacePath(entry.path) === activePath,
  )
  const activeWorkspaceText = (() => {
    if (!activeWorkspaceEntry || activeWorkspaceEntry.kind !== 'file') return ''
    return typeof activeWorkspaceEntry.text === 'string' ? activeWorkspaceEntry.text : ''
  })()
  const activePathHasCanvasWorkspacePreset = !!parseCanvasWorkspaceFrontmatterPreset(activeWorkspaceText)
  const shouldApplyToGraph = args?.applyToGraph === true || isInitializationWorkspacePath(activePath) || activePathHasCanvasWorkspacePreset
  const sourcesByPath = resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath)
  const store = useGraphStore.getState()
  const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  const merged = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries,
    sourcesByPath,
    forceIncludePaths: buildMaterializedWorkspaceForceIncludePaths({
      activePathOverride: activePath,
    }),
  })
  if (merged !== existing) {
    store.setSourceFiles(merged)
  }
  const preserveFrontmatterDrivenLanding = shouldApplyToGraph && (isInitializationWorkspacePath(activePath) || activePathHasCanvasWorkspacePreset)
  const materialized = await applyWorkspaceImportToCanvas({
    fs,
    createdPaths: [activePath],
    opts: {
      workspaceEntries,
      sourcesByPath,
      applyToGraph: shouldApplyToGraph,
      skipComposedGraphApply: preserveFrontmatterDrivenLanding,
    },
  })
  if (
    !preserveFrontmatterDrivenLanding &&
    shouldApplyToGraph &&
    (materialized.parsedCount > 0 || materialized.enabledCount > 0)
  ) {
    scheduleApplyComposedGraphFromSourceFiles()
  }
}

export async function resolveInitialWorkspaceStartupState(): Promise<{
  activePath: WorkspacePath | null
  workspaceEntries: WorkspaceEntry[]
}> {
  const explorer = useMarkdownExplorerStore.getState()
  const preferCustomValidationSeed =
    CUSTOM_TEST_VALIDATION_WORKSPACE_SEED_ACTIVE &&
    TEST_VALIDATION_WORKSPACE_SEED_REL_PATH !== DEFAULT_TEST_VALIDATION_WORKSPACE_SEED_REL_PATH
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const workspaceEntries = await fs.listEntries()
  const workspaceFilePaths = workspaceEntries
    .filter(entry => entry.kind === 'file')
    .map(entry => entry.path)
  const desiredActivePath = resolveWorkspaceStartupActivePath({
    workspaceFilePaths,
    activePath: resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath }),
    preferValidationSeedForDefaultFamily: false,
    forceValidationSeedIfPresent: preferCustomValidationSeed,
  })
  const currentActivePath = resolveMaterializedWorkspaceActivePath({ explorerActivePath: explorer.activePath })
  const snapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath,
    desiredActivePath,
    workspaceEntries,
    lastSetActivePath: explorer.lastSetActivePath,
    preferCustomValidationSeed,
  })
  if (desiredActivePath && desiredActivePath !== currentActivePath) {
    explorer.setActivePath(desiredActivePath)
  }
  return snapshot
}
