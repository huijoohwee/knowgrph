export const DOCUMENT_REPOSITORY_TARGETS = {
  knowgrphDocs: 'knowgrph-docs',
  workspaceDocs: 'workspace-docs',
} as const

export type DocumentRepositoryTarget =
  (typeof DOCUMENT_REPOSITORY_TARGETS)[keyof typeof DOCUMENT_REPOSITORY_TARGETS]

export type DocumentRepositoryAuthority = {
  repositoryTarget: DocumentRepositoryTarget
  githubPath: string
  canonicalPath: string
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx'])

const normalizeDocumentPath = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^workspace:/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')

const hasSupportedExtension = (path: string, documentKind: 'markdown' | 'json'): boolean => {
  const extension = path.split('.').pop()?.toLowerCase() || ''
  return documentKind === 'json' ? extension === 'json' : MARKDOWN_EXTENSIONS.has(extension)
}

const isSafeRepositoryPath = (path: string): boolean => {
  const parts = path.split('/').filter(Boolean)
  return parts.length > 0 && parts.every(part => part !== '.' && part !== '..')
}

export const resolveDocumentRepositoryAuthority = (args: {
  documentKey: unknown
  documentKind: 'markdown' | 'json'
}): DocumentRepositoryAuthority | null => {
  const normalizedPath = normalizeDocumentPath(args.documentKey)
  if (!normalizedPath || !isSafeRepositoryPath(normalizedPath)) return null
  if (normalizedPath === 'agentic-canvas-os' || normalizedPath.startsWith('agentic-canvas-os/')) return null
  if (normalizedPath.startsWith('huijoohwee/docs/workspace-seeds/')) return null

  let repositoryTarget: DocumentRepositoryTarget = DOCUMENT_REPOSITORY_TARGETS.workspaceDocs
  let repositoryPath = normalizedPath

  if (normalizedPath.startsWith('knowgrph/docs/')) {
    repositoryTarget = DOCUMENT_REPOSITORY_TARGETS.knowgrphDocs
    repositoryPath = normalizedPath.slice('knowgrph/'.length)
  } else if (normalizedPath.startsWith('huijoohwee/docs/')) {
    repositoryPath = normalizedPath.slice('huijoohwee/'.length)
  } else if (normalizedPath.startsWith('docs/workspace-seeds/')) {
    repositoryTarget = DOCUMENT_REPOSITORY_TARGETS.knowgrphDocs
  } else if (!normalizedPath.startsWith('docs/')) {
    repositoryPath = `docs/${normalizedPath}`
  }

  if (!repositoryPath.startsWith('docs/') || !isSafeRepositoryPath(repositoryPath)) return null
  if (!hasSupportedExtension(repositoryPath, args.documentKind)) return null

  const repositoryName = repositoryTarget === DOCUMENT_REPOSITORY_TARGETS.knowgrphDocs
    ? 'knowgrph'
    : 'huijoohwee'
  return {
    repositoryTarget,
    githubPath: repositoryPath,
    canonicalPath: `${repositoryName}/${repositoryPath}`,
  }
}
