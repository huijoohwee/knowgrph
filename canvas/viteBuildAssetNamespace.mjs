const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/

export function resolveBuildAssetNamespace(sourceRevision) {
  const revision = String(sourceRevision || '').trim()
  if (!SOURCE_REVISION_PATTERN.test(revision)) {
    throw new Error('Versioned build assets require an exact 40-character source revision SHA')
  }
  return `assets/${revision}`
}

export function buildVersionedAssetFileNames(sourceRevision) {
  const namespace = resolveBuildAssetNamespace(sourceRevision)
  return {
    entryFileNames: `${namespace}/[name]-[hash].js`,
    chunkFileNames: `${namespace}/[name]-[hash].js`,
    assetFileNames: `${namespace}/[name]-[hash][extname]`,
  }
}
