import fs from 'node:fs'
import path from 'node:path'

export function testLoaderCacheKeyIncludesParserRegistryRevision() {
  const filePath = path.resolve(process.cwd(), 'src/features/parsers/loader.ts')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('getParserRegistryRevision')) {
    throw new Error('Expected loader to reference parser registry revision to avoid stale cached parses')
  }
  if (!text.includes('getCachedParse(parserId, name, normalizedText, cfgKey')) {
    throw new Error('Expected loader to pass cfgKey into getCachedParse')
  }
  if (!text.includes('setCachedParse(parserId, name, normalizedText, res, cfgKey')) {
    throw new Error('Expected loader to pass cfgKey into setCachedParse')
  }
}

