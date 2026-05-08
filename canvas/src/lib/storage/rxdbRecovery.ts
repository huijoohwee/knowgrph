export const clearRxdbLocalstorageForDatabaseName = (databaseName: string) => {
  if (typeof window === 'undefined') return
  const ls = window.localStorage
  const normalizedDbName = String(databaseName || '').trim()
  if (!normalizedDbName) return
  const encodedDbName = encodeURIComponent(normalizedDbName)
  const marker = `-${normalizedDbName}--`
  try {
    for (let i = ls.length - 1; i >= 0; i -= 1) {
      const key = ls.key(i)
      if (!key) continue
      if (!key.startsWith('RxDB-ls-')) continue
      if (!key.includes(marker) && !key.includes(normalizedDbName) && !key.includes(encodedDbName)) continue
      ls.removeItem(key)
    }
  } catch {
    void 0
  }
}

export const deleteRxdbIndexedDbForDatabaseName = (databaseName: string): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve()
  const normalizedDbName = String(databaseName || '').trim()
  if (!normalizedDbName) return Promise.resolve()
  return new Promise(resolve => {
    try {
      const request = window.indexedDB.deleteDatabase(normalizedDbName)
      request.addEventListener('success', () => resolve())
      request.addEventListener('error', () => resolve())
      request.addEventListener('blocked', () => resolve())
    } catch {
      resolve()
    }
  })
}

export const clearRxdbForDatabaseName = async (databaseName: string): Promise<void> => {
  clearRxdbLocalstorageForDatabaseName(databaseName)
  await deleteRxdbIndexedDbForDatabaseName(databaseName)
}
