import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import {
  buildImmutableReleaseManifest,
  calculateImmutableReleaseManifestDigest,
  serializeImmutableReleaseManifest,
} from './immutable-release-manifest.mjs'

const main = async () => {
  const { values } = parseArgs({
    options: {
      'source-sha': { type: 'string' },
      'target-ref': { type: 'string' },
      output: { type: 'string' },
      'publication-mode': { type: 'string', default: 'ci' },
      'push-hook-mode': { type: 'string', default: 'not-applicable' },
      'expected-remote-sha': { type: 'string' },
      'github-output': { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values['source-sha'] || !values['target-ref'] || !values.output) {
    throw new Error('--source-sha, --target-ref, and --output are required')
  }
  const manifest = await buildImmutableReleaseManifest({
    sourceRevision: values['source-sha'],
    targetRef: values['target-ref'],
    expectedRemoteRevision: values['expected-remote-sha'] || null,
    publicationMode: values['publication-mode'],
    pushHookMode: values['push-hook-mode'],
  })
  const outputPath = path.resolve(values.output)
  const source = serializeImmutableReleaseManifest(manifest)
  const digest = calculateImmutableReleaseManifestDigest(source)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, source, 'utf8')
  if (values['github-output']) {
    const githubOutput = String(process.env.GITHUB_OUTPUT || '').trim()
    if (!githubOutput) throw new Error('GITHUB_OUTPUT is required with --github-output')
    await appendFile(githubOutput, `digest=${digest}\n`, 'utf8')
  }
  process.stdout.write(`${JSON.stringify({ status: 'passed', output: outputPath, digest, manifest })}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
