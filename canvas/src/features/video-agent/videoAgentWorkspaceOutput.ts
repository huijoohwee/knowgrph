import { joinWorkspacePath, normalizeWorkspacePath, WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import { readWorkspaceImportShareExportRootPathSetting } from '@/lib/workspace/workspaceStoreSyncSettings'

export const VIDEO_AGENT_WORKSPACE_OUTPUT_ROOT_PATH = '/docs_' as WorkspacePath
export const VIDEO_AGENT_WORKSPACE_OUTPUT_DIR_PATH = '/docs_/video-agent' as WorkspacePath

export const buildVideoAgentWorkspaceOutputTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')

export const normalizeVideoAgentWorkspaceOutputRootPath = (path?: WorkspacePath | string | null): WorkspacePath => {
  const normalizedPath = normalizeWorkspacePath(path || '')
  return normalizedPath === WORKSPACE_ROOT_PATH ? VIDEO_AGENT_WORKSPACE_OUTPUT_DIR_PATH : normalizedPath
}

export const buildVideoAgentWorkspaceOutputPath = (
  name: string,
  outputRootPath: WorkspacePath = VIDEO_AGENT_WORKSPACE_OUTPUT_DIR_PATH,
): WorkspacePath => joinWorkspacePath(normalizeVideoAgentWorkspaceOutputRootPath(outputRootPath), name)

export const buildVideoAgentWorkspaceOutputArtifactPath = (
  path: WorkspacePath | string,
  outputRootPath: WorkspacePath,
): WorkspacePath => buildVideoAgentWorkspaceOutputPath(String(path || '').split('/').filter(Boolean).pop() || 'artifact.json', outputRootPath)

export const readVideoAgentImportOutputRootPath = (): WorkspacePath => {
  const configuredRoot = normalizeWorkspacePath(readWorkspaceImportShareExportRootPathSetting())
  return configuredRoot === WORKSPACE_ROOT_PATH ? VIDEO_AGENT_WORKSPACE_OUTPUT_ROOT_PATH : configuredRoot
}

export const resolveVideoAgentImportOutputParentPath = (parentPath?: WorkspacePath | null): WorkspacePath => {
  const normalizedParentPath = normalizeWorkspacePath(parentPath || '')
  return normalizedParentPath === WORKSPACE_ROOT_PATH ? readVideoAgentImportOutputRootPath() : normalizedParentPath
}

export const buildVideoAgentTimestampedWorkspaceOutputFolderPath = (
  parentPath?: WorkspacePath | null,
  date = new Date(),
): WorkspacePath => joinWorkspacePath(resolveVideoAgentImportOutputParentPath(parentPath), buildVideoAgentWorkspaceOutputTimestamp(date))
