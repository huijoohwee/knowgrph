import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'

type CanvasRxStorage = ReturnType<typeof getRxStorageLocalstorage> | ReturnType<typeof getRxStorageMemory>
let storageSingleton: CanvasRxStorage | null = null

export const getCanvasRxStorage = (): CanvasRxStorage => {
  if (storageSingleton) return storageSingleton
  const hasLocalStorage = (() => {
    const g = globalThis as unknown as { localStorage?: Storage | undefined }
    return !!g.localStorage
  })()
  storageSingleton = hasLocalStorage ? getRxStorageLocalstorage() : getRxStorageMemory()
  return storageSingleton
}
