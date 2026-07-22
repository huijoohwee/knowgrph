import {
  beginSourceFilesDocumentIntent,
  clearSourceFilesDocumentIntent,
  completeSourceFilesDocumentIntent,
  failSourceFilesDocumentIntent,
  readSourceFilesBootstrapSnapshot,
} from '@/features/source-files/sourceFilesBootstrapReadiness'
import { reportActivePathMaterializationError } from '@/features/source-files/sourceFilesMaterializationError'
import {
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
} from '@/features/source-files/sourceFilesRuntimeShared'
import { useGraphStore } from '@/hooks/useGraphStore'

export type ActivePathSourceAuthorityRequest = Readonly<{
  sourceAuthorityIntentKey: string
  ownsSourceAuthorityIntent: boolean
}>

export type ActivePathMaterializationRequest = ActivePathSourceAuthorityRequest & {
  activePath: string
  activePathKey: string
  sourceFilesSnapshot: ReturnType<typeof useGraphStore.getState>['sourceFiles']
  workspaceEntriesSnapshot: ReturnType<typeof readReusableWorkspaceEntriesSnapshot>
}

type ActivePathMaterializationRuntime = Pick<
  NonNullable<Parameters<typeof materializeActiveWorkspaceEntryIntoSourceFiles>[0]>,
  'activeWorkspaceEntriesSnapshot' | 'fs' | 'sourcesByPath'
>

export type ActivePathSourceAuthorityCoordinator = Readonly<{
  begin: (request: ActivePathMaterializationRequest) => void
  clear: () => void
  launch: (
    request: ActivePathMaterializationRequest,
    run: (request: ActivePathMaterializationRequest) => Promise<void>,
  ) => void
}>

const ACTIVE_PATH_INTENT_PREFIX = '["workspace-active-path",'

export function resolveActivePathMaterializationSourceAuthority(
  activePath: string,
): ActivePathSourceAuthorityRequest {
  const sourceAuthority = readSourceFilesBootstrapSnapshot()
  const currentIntentKey = String(sourceAuthority.documentIntentKey || '')
  const routeIntentOwnsMaterialization = sourceAuthority.documentIntentPhase === 'resolving'
    && !!currentIntentKey
    && !currentIntentKey.startsWith(ACTIVE_PATH_INTENT_PREFIX)
  return {
    sourceAuthorityIntentKey: routeIntentOwnsMaterialization
      ? currentIntentKey
      : JSON.stringify(['workspace-active-path', activePath]),
    ownsSourceAuthorityIntent: !routeIntentOwnsMaterialization,
  }
}

export function beginActivePathMaterializationSourceAuthority(
  request: ActivePathSourceAuthorityRequest,
): void {
  if (request.ownsSourceAuthorityIntent) {
    beginSourceFilesDocumentIntent(request.sourceAuthorityIntentKey)
  }
}

export function completeActivePathMaterializationSourceAuthority(
  request: ActivePathSourceAuthorityRequest,
): void {
  if (request.ownsSourceAuthorityIntent) {
    completeSourceFilesDocumentIntent(request.sourceAuthorityIntentKey)
  }
}

export function failActivePathMaterializationSourceAuthority(
  request: ActivePathSourceAuthorityRequest,
  error: unknown,
): void {
  if (readSourceFilesBootstrapSnapshot().documentIntentKey !== request.sourceAuthorityIntentKey) return
  failSourceFilesDocumentIntent(request.sourceAuthorityIntentKey, error)
  reportActivePathMaterializationError(error)
}

export function createActivePathSourceAuthorityCoordinator(): ActivePathSourceAuthorityCoordinator {
  let ownedIntentKey = ''
  const begin = (request: ActivePathMaterializationRequest): void => {
    if (request.ownsSourceAuthorityIntent) ownedIntentKey = request.sourceAuthorityIntentKey
    beginActivePathMaterializationSourceAuthority(request)
  }
  return {
    begin,
    clear: () => {
      const intentKey = ownedIntentKey
      ownedIntentKey = ''
      if (intentKey) clearSourceFilesDocumentIntent(intentKey)
    },
    launch: (request, run) => {
      begin(request)
      void run(request).catch(error => failActivePathMaterializationSourceAuthority(request, error))
    },
  }
}

export async function materializeActivePathWithSourceAuthority(
  request: ActivePathMaterializationRequest,
  runtime: ActivePathMaterializationRuntime,
): Promise<void> {
  await materializeActiveWorkspaceEntryIntoSourceFiles({
    activePathOverride: request.activePath,
    fs: runtime.fs,
    activeWorkspaceEntriesSnapshot: runtime.activeWorkspaceEntriesSnapshot,
    sourceFilesSnapshot: request.sourceFilesSnapshot,
    workspaceEntries: request.workspaceEntriesSnapshot,
    sourcesByPath: runtime.sourcesByPath,
  })
  completeActivePathMaterializationSourceAuthority(request)
}
