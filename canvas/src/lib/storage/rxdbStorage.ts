import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'

type CanvasRxStorage = ReturnType<typeof getRxStorageDexie> | ReturnType<typeof getRxStorageLocalstorage> | ReturnType<typeof getRxStorageMemory>
let storageSingleton: CanvasRxStorage | null = null

export const getCanvasRxStorage = (): CanvasRxStorage => {
  if (storageSingleton) return storageSingleton
  const hasIndexedDb = (() => {
    const g = globalThis as unknown as { indexedDB?: IDBFactory | undefined }
    return !!g.indexedDB
  })()
  const hasLocalStorage = (() => {
    const g = globalThis as unknown as { localStorage?: Storage | undefined }
    return !!g.localStorage
  })()
  // Prefer IndexedDB for larger quota and better resilience on big workspace imports.
  storageSingleton = hasIndexedDb ? getRxStorageDexie() : hasLocalStorage ? getRxStorageLocalstorage() : getRxStorageMemory()
  return storageSingleton
}
