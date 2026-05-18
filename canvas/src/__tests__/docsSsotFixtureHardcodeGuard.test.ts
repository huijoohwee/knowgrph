import fs from 'node:fs'
import path from 'node:path'

import { KNOWGRPH_VIDEO_DEMO_BASENAME, readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'

export async function testKnowgrphVideoDemoFixtureForbidsHardcodedEndpointLiterals() {
  const fixtureText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
  if (!fixtureText.trim()) {
    throw new Error('expected knowgrph-video-demo docs fixture text')
  }
  const forbiddenLiterals = [
    'http://localhost:8000/api/llm/chat/completions',
    'http://localhost:8001/api/llm/chat/completions',
    'https://abcxyz.trycloudflare.com/api/llm/chat/completions',
  ]
  const matched = forbiddenLiterals.filter((literal) => fixtureText.includes(literal))
  if (matched.length > 0) {
    throw new Error(
      `expected docs fixture to avoid hardcoded DeerFlow endpoint URLs; found: ${matched.join(', ')}`,
    )
  }
}

export async function testDocsSsotFixtureReadsCloudflareD1BackedRouteInsteadOfLocalDocsRoot() {
  const helperPath = path.resolve(process.cwd(), 'src', 'tests', 'lib', 'docsSsotFixture.ts')
  const helperText = fs.readFileSync(helperPath, 'utf8')
  const legacyRootTupleLiteral = `[${["'..'", "'..'", "'huijoohwee'", "'docs'"].join(', ')}]`
  const legacyRootEnvName = ['KG_TEST', 'DOCS_SSOT_ROOT'].join('_')
  const legacyAbsoluteRoot = [
    '',
    'Users',
    'huijoohwee',
    'Documents',
    'GitHub',
    'huijoohwee',
    'docs',
  ].join('/')
  const forbiddenLiterals = [
    legacyRootTupleLiteral,
    legacyRootEnvName,
    legacyAbsoluteRoot,
  ]
  const matched = forbiddenLiterals.filter((literal) => helperText.includes(literal))
  if (matched.length > 0) {
    throw new Error(
      `expected docs SSOT fixture helper to read the Cloudflare D1-backed storage route instead of a local docs root; found: ${matched.join(', ')}`,
    )
  }
  if (!helperText.includes('/api/storage/doc/')) {
    throw new Error('expected docs SSOT fixture helper to fetch from the D1-backed public storage document route')
  }
}
