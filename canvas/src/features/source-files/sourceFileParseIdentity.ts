import { hashStringToHexCached } from '@/lib/hash/textHashCache'

// Bump when source-file parse semantics change so persisted parsedGraphData reparses on startup.
export const SOURCE_FILE_PARSE_SEMANTICS_VERSION = 2 as const

export function buildSourceFileParseIdentityHash(args: {
  cacheNamespace: string
  name: string
  text: string
}): string {
  const cacheNamespace = String(args.cacheNamespace || '').trim() || 'source-file'
  const name = String(args.name || '').trim()
  const text = String(args.text || '')
  return hashStringToHexCached(
    `${cacheNamespace}:v${SOURCE_FILE_PARSE_SEMANTICS_VERSION}`,
    `v${SOURCE_FILE_PARSE_SEMANTICS_VERSION}\n${name}\n${text}`,
  )
}
