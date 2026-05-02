import { coerceCodebaseRelPath } from '@/lib/codebase/relPath'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getDocumentPathFromMetadata } from '@/lib/graph/documentMetadata'
import { getDocumentPathFromMetadata, readGraphDataRevision } from '@/lib/graph/documentMetadata'

export const testCodebaseRelPathCoercionFromAbsoluteUnderRoot = () => {
  const prev = process.env.VITE_CODEBASE_ROOT
  process.env.VITE_CODEBASE_ROOT = '/tmp/kg-codebase-root'
  try {
    const abs = '/tmp/kg-codebase-root/sandbox/demo/markdown-slide-demo.md'
    const rel = coerceCodebaseRelPath(abs)
    if (rel !== 'sandbox/demo/markdown-slide-demo.md') {
      throw new Error(`expected rel path, got ${JSON.stringify(rel)}`)
    }
    const ws = normalizeWorkspacePath(abs)
    if (ws !== '/sandbox/demo/markdown-slide-demo.md') {
      throw new Error(`expected workspace path, got ${JSON.stringify(ws)}`)
    }
    const metaDoc = getDocumentPathFromMetadata({ codebasePath: `${abs}#L1-3` })
    if (metaDoc !== 'sandbox/demo/markdown-slide-demo.md') {
      throw new Error(`expected metadata documentPath from codebasePath, got ${JSON.stringify(metaDoc)}`)
    }
  } finally {
    if (typeof prev === 'string') process.env.VITE_CODEBASE_ROOT = prev
    else delete process.env.VITE_CODEBASE_ROOT
  }
}

export const testGraphDataRevisionMetadataReaderNormalizesFiniteNonNegativeIntegers = () => {
  if (readGraphDataRevision(null) !== 0) {
    throw new Error('expected null graph data to resolve to graphDataRevision 0')
  }
  if (readGraphDataRevision({ metadata: { graphDataRevision: 4.9 } }) !== 4) {
    throw new Error('expected graphDataRevision reader to floor finite numeric metadata values')
  }
  if (readGraphDataRevision({ metadata: { graphDataRevision: -7 } }) !== 0) {
    throw new Error('expected graphDataRevision reader to clamp negative metadata values to 0')
  }
  if (readGraphDataRevision({ metadata: { graphDataRevision: 'bad' } }) !== 0) {
    throw new Error('expected graphDataRevision reader to ignore non-numeric metadata values')
  }
}
