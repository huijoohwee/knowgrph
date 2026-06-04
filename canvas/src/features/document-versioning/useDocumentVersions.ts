import React from 'react'
import {
  readDocumentVersionCountsByPath,
  readDocumentVersions,
  subscribeDocumentVersionsChanged,
  type DocumentVersionEntry,
} from './documentVersioning'

export type DocumentVersionSnapshot = {
  revision: number
  entries: DocumentVersionEntry[]
  countsByPath: Record<string, number>
}

const readSnapshot = (): DocumentVersionSnapshot => {
  const entries = readDocumentVersions()
  return {
    revision: Date.now(),
    entries,
    countsByPath: readDocumentVersionCountsByPath(),
  }
}

export function useDocumentVersionRecords(): DocumentVersionSnapshot {
  const [snapshot, setSnapshot] = React.useState<DocumentVersionSnapshot>(() => readSnapshot())
  React.useEffect(() => {
    return subscribeDocumentVersionsChanged(() => setSnapshot(readSnapshot()))
  }, [])
  return snapshot
}
