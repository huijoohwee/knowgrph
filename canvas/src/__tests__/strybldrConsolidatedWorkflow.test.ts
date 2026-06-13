import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type StoryboardPayload = {
  sources?: Array<{ sourceUnitId?: string }>
  elements?: Array<{ id?: string; sourceUnitId?: string; order?: number }>
  storytree?: unknown
}

const githubRoot = resolve(process.cwd(), '../..')
const strybldrDemoPath = resolve(githubRoot, 'huijoohwee/docs/knowgrph-strybldr-demo.md')
const legacyVideodbDemoPath = resolve(githubRoot, 'huijoohwee/docs/knowgrph-videodb-demo.md')

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const demoText = readFileSync(strybldrDemoPath, 'utf8')

assert(!existsSync(legacyVideodbDemoPath), 'legacy knowgrph-videodb-demo.md must remain removed')

for (const requiredText of [
  'videodb_workflow_status: "VideoDB API + MCP workflow integrated into full SenseNova Text, Image, Video to VideoDB E2E pipeline"',
  'sensenova_workflow_status: "SenseNova API Text, Image, Video generation feeds VideoDB upload, index, search, stream, and local publish packet workflow"',
  '2D Renderer: Strybldr',
  '2D Renderer: Storyboard',
  '2D Renderer: Flow Editor',
  'SenseNova API Lane (Text, Image, Video)',
  'VideoDB API + MCP Recreate 77FAnT935IE Lane',
  'Confirm MainPanel Integrations exposes SenseNova API readiness',
  'MainPanel MCP exposes `VideoDB Director MCP`',
  'kgWebpageUrl: "https://www.youtube.com/watch?v=77FAnT935IE"',
  'SenseNova API readiness',
  'VideoDB Director MCP',
  'videodbMcpApiDocs.ts',
  'videodb-recreate-77FAnT935IE-source',
  'Source, Storyboard, Elements, Runtime, Review, and Publish cards',
  'No Prod, Cloudflare, or external publication claim exists until the operator explicitly authorizes it',
]) {
  assert(demoText.includes(requiredText), `Strybldr demo missing VideoDB recreate workflow text: ${requiredText}`)
}

const storyboardMatch = demoText.match(/```json strybldr-storyboard\n([\s\S]*?)\n```/)
assert(storyboardMatch, 'Strybldr demo must include a strybldr-storyboard JSON payload')

const storyboard = JSON.parse(storyboardMatch[1] || '{}') as StoryboardPayload
const sources = storyboard.sources || []
const elements = storyboard.elements || []
const storytree = storyboard.storytree

assert(sources.length === 5, `expected five SenseNova+VideoDB E2E sources, got ${sources.length}`)
assert(elements.length === 16, `expected sixteen SenseNova+VideoDB E2E element cards, got ${elements.length}`)
assert(storytree === undefined, '77FAnT935IE-only demo must not include unrelated storytree payloads')

assert(
  sources.some(source => source.sourceUnitId === 'validation-input-import-url-source'),
  'storyboard must keep the Strybldr import URL source',
)
assert(
  elements.some(element => element.id === 'validation-videodb-review-card'),
  'storyboard must keep the VideoDB review card',
)
assert(
  sources.some(source => source.sourceUnitId === 'sensenova-api-contract'),
  'storyboard must include the SenseNova API PRD/TAD source',
)
assert(
  elements.some(element => element.id === 'sensenova-api-readiness-card' && element.sourceUnitId === 'sensenova-api-contract'),
  'storyboard must include the SenseNova API readiness card',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-mcp-contract'),
  'storyboard must include the VideoDB MCP PRD/TAD source',
)
assert(
  elements.some(element => element.id === 'videodb-mcp-readiness-card' && element.sourceUnitId === 'videodb-mcp-contract'),
  'storyboard must include the VideoDB MCP readiness card',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-api-reference-contract'),
  'storyboard must include the VideoDB API reference source',
)
assert(
  sources.some(source => source.sourceUnitId === 'videodb-recreate-77FAnT935IE-source'),
  'storyboard must include the VideoDB recreate source',
)
for (const requiredVideodbCard of [
  'videodb-api-reference-readiness-card',
  'videodb-recreate-source-setup-card',
  'videodb-recreate-storyboard-card',
  'videodb-recreate-api-mcp-execution-card',
  'videodb-recreate-review-card',
  'videodb-recreate-publish-card',
]) {
  assert(
    elements.some(element => element.id === requiredVideodbCard),
    `storyboard must include the VideoDB API+MCP recreate card ${requiredVideodbCard}`,
  )
}

assert(
  !/job-upload-|job-index-|job-generation-|stream\.videodb\.io|deployed_api_claim:\s*true|\bzapier\b|\bnotion\b|客家|strytree|storytree|ForkCompare|Frostline|strybldr-demo-image-|strybldr-demo-el-|https:\/\/[^`\s"]*generated[^`\s"]*|signed-jwt-/i.test(demoText),
  'Strybldr demo must not contain fabricated runtime SenseNova/VideoDB values or unrelated non-E2E workflow content',
)
