import { findNextSourceFileIndex, normalizeParentPath } from '@/features/source-files/sourceFileNaming'

export const testNormalizeParentPath = () => {
  if (normalizeParentPath(null) !== '') throw new Error('normalizeParentPath(null) should be empty')
  if (normalizeParentPath(' /a/b/ ') !== 'a/b') throw new Error('normalizeParentPath should trim and strip slashes')
  if (normalizeParentPath('a\\b') !== 'a/b') throw new Error('normalizeParentPath should normalize backslashes')
}

export const testFindNextSourceFileIndexRoot = () => {
  const names = ['source-1.md', 'source-2.md', 'notes.md', 'SOURCE-10.MD']
  const next = findNextSourceFileIndex(names, '')
  if (next !== 11) throw new Error(`findNextSourceFileIndex(root) expected 11, got ${next}`)
}

export const testFindNextSourceFileIndexNested = () => {
  const names = ['folder/source-1.md', 'folder/source-3.md', 'folder/sub/source-9.md', 'source-8.md']
  const next = findNextSourceFileIndex(names, 'folder')
  if (next !== 4) throw new Error(`findNextSourceFileIndex(folder) expected 4, got ${next}`)
}

