import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { validateImmutableReleaseManifestSource } from './immutable-release-manifest.mjs'

const main = async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'source-sha': { type: 'string' },
      'docs-sha': { type: 'string' },
      digest: { type: 'string' },
    },
    strict: true,
  })
  if (positionals.length !== 1) throw new Error('one immutable release manifest path is required')
  const manifestPath = path.resolve(positionals[0])
  const result = await validateImmutableReleaseManifestSource(
    await readFile(manifestPath, 'utf8'),
    {
      sourceRevision: values['source-sha'],
      agenticCanvasOsRevision: values['docs-sha'],
      digest: values.digest,
    },
  )
  process.stdout.write(`${JSON.stringify({
    status: 'passed',
    input: manifestPath,
    digest: result.digest,
    sourceRevision: result.manifest.sourceRevision,
    agenticCanvasOsRevision: result.manifest.agenticCanvasOs.revision,
  })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
