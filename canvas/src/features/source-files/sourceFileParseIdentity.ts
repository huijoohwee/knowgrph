import { hashStringToHexSharedContentCached } from '@/lib/hash/textHashCache'

// Bump when source-file parse semantics change so persisted parsedGraphData reparses on startup.
export const SOURCE_FILE_PARSE_SEMANTICS_VERSION = 2 as const

export function buildSourceFileParseIdentityHash(args: {
  cacheNamespace: string
  name: string
  text: string
}): string {
  const name = String(args.name || '').trim()
  const text = String(args.text || '')
  return hashStringToHexSharedContentCached(
    `v${SOURCE_FILE_PARSE_SEMANTICS_VERSION}\n${name}\n${text}`,
    `source-file-parse:v${SOURCE_FILE_PARSE_SEMANTICS_VERSION}`,
  )
}
