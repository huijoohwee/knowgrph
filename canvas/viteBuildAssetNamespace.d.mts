export function resolveBuildAssetNamespace(sourceRevision: string): string

export function buildVersionedAssetFileNames(sourceRevision: string): {
  entryFileNames: string
  chunkFileNames: string
  assetFileNames: string
}
