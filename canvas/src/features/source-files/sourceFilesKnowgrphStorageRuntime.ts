import { readKnowgrphStorageBaseUrl } from '@/features/source-files/sourceFilesKnowgrphStorageSettings'

type SourceFilesStorageSyncModule = typeof import('@/features/source-files/sourceFilesStorageSync')
type SourceFilesInboundStorageApplyModule = typeof import('@/features/source-files/sourceFilesInboundStorageApply')
type KnowgrphStorageClientSyncModule = typeof import('@/lib/storage/knowgrphStorageClientSync')
type KnowgrphStorageConflictUxModule = typeof import('@/lib/storage/knowgrphStorageConflictUx')

export type KnowgrphStorageRuntimeDependencies = {
  baseUrl: string | null
  syncSourceFilesToKnowgrphStorage: SourceFilesStorageSyncModule['syncSourceFilesToKnowgrphStorage']
  applyPulledKnowgrphStorageChangesToSourceFiles: SourceFilesInboundStorageApplyModule['applyPulledKnowgrphStorageChangesToSourceFiles']
  cancelKnowgrphStorageSync: KnowgrphStorageClientSyncModule['cancelKnowgrphStorageSync']
  scheduleKnowgrphStorageSync: KnowgrphStorageClientSyncModule['scheduleKnowgrphStorageSync']
  startKnowgrphStorageSyncLoop: KnowgrphStorageClientSyncModule['startKnowgrphStorageSyncLoop']
  notifyKnowgrphStorageConflictUx: KnowgrphStorageConflictUxModule['notifyKnowgrphStorageConflictUx']
}

let cachedKnowgrphStorageRuntimeDependenciesPromise: Promise<KnowgrphStorageRuntimeDependencies> | null = null

const resolveKnowgrphStorageRuntimeBaseUrl = (): string | null => {
  const raw = readKnowgrphStorageBaseUrl()
  return raw || null
}

export const loadKnowgrphStorageRuntimeDependencies = async (): Promise<KnowgrphStorageRuntimeDependencies> => {
  if (!cachedKnowgrphStorageRuntimeDependenciesPromise) {
    cachedKnowgrphStorageRuntimeDependenciesPromise = Promise.all([
      import('@/features/source-files/sourceFilesStorageSync'),
      import('@/features/source-files/sourceFilesInboundStorageApply'),
      import('@/lib/storage/knowgrphStorageClientSync'),
      import('@/lib/storage/knowgrphStorageConflictUx'),
    ]).then(([storageSyncModule, inboundApplyModule, clientSyncModule, conflictUxModule]) => ({
      baseUrl: resolveKnowgrphStorageRuntimeBaseUrl(),
      syncSourceFilesToKnowgrphStorage: storageSyncModule.syncSourceFilesToKnowgrphStorage,
      applyPulledKnowgrphStorageChangesToSourceFiles: inboundApplyModule.applyPulledKnowgrphStorageChangesToSourceFiles,
      cancelKnowgrphStorageSync: clientSyncModule.cancelKnowgrphStorageSync,
      scheduleKnowgrphStorageSync: clientSyncModule.scheduleKnowgrphStorageSync,
      startKnowgrphStorageSyncLoop: clientSyncModule.startKnowgrphStorageSyncLoop,
      notifyKnowgrphStorageConflictUx: conflictUxModule.notifyKnowgrphStorageConflictUx,
    }))
  }
  return cachedKnowgrphStorageRuntimeDependenciesPromise
}
