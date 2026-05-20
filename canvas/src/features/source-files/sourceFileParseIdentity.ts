import { hashStringToHexSharedContentCached } from '@/lib/hash/textHashCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

// Bump when source-file parse semantics change so persisted parsedGraphData reparses on startup.
export const SOURCE_FILE_PARSE_SEMANTICS_VERSION = 3 as const

export function buildSourceFileParseIdentityHash(args: {
  cacheNamespace: string
  name: string
  text: string
}): string {
  const namespace = String(args.cacheNamespace || '').trim()
  const name = String(args.name || '').trim()
  const text = String(args.text || '')
  const textHash = hashStringToHexSharedContentCached(text, `source-file-parse-text:v${SOURCE_FILE_PARSE_SEMANTICS_VERSION}`)
  return buildScopedGraphSemanticKey('source-file-parse-identity', {
    graphSemanticKey: [
      `v:${SOURCE_FILE_PARSE_SEMANTICS_VERSION}`,
      namespace,
      name,
      `len:${text.length}`,
      textHash,
    ].join('|'),
  })
}
