import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readRepoFile = (repoRelativePath: string): string =>
  readFileSync(resolve(process.cwd(), '..', repoRelativePath), 'utf8')

export function testPixVersePrdTadUsesImplementedBaselineOwners(): void {
  const doc = readRepoFile('docs/documents/knowgrph-pixverse-mcp-prd-tad.md')
  const ownerText = [
    readRepoFile('canvas/src/features/panels/views/pixverseMcpApiDocs.ts'),
    readRepoFile('canvas/src/features/integrations/pixverseVideoGenerationSsot.ts'),
    readRepoFile('canvas/src/features/panels/views/settingsMcpDocEntries.ts'),
    readRepoFile('canvas/src/features/panels/views/settingsView.constants.ts'),
    readRepoFile('knowgrph_parser/superagent_harness.py'),
    readRepoFile('knowgrph_parser/superagent_tools.py'),
    readRepoFile('knowgrph_parser/superagent_pixverse.py'),
  ].join('\n')

  const requiredDocTokens = [
    'version: 0.12.1',
    'status: accepted-implemented-baseline',
    'Phase A shipped: MainPanel MCP includes PixVerse MCP readiness through the shared `SettingsView` owner.',
    'Phase B baseline shipped: `knowgrph_parser` now supports `provider_mode="pixverse"`',
    'MainPanel Integrations and chat-readiness UX now include PixVerse-aware provider affordances through existing settings owners.',
    '`canvas/src/features/panels/views/pixverseMcpApiDocs.ts` | Shipped',
    '`canvas/src/features/panels/views/pixverseVideoGenerationApiDocs.ts` | Shipped',
    '`knowgrph_parser/superagent_pixverse.py` | Shipped',
    'Flow Editor, Storyboard, and Animatic consume shared graph/media fields only.',
  ]
  for (const token of requiredDocTokens) {
    if (!doc.includes(token)) {
      throw new Error(`Expected PixVerse PRD/TAD to include ${JSON.stringify(token)}`)
    }
  }

  const requiredOwnerTokens = [
    'PIXVERSE_MCP_DOC_AREA',
    'PIXVERSE_VIDEO_GENERATION_DOC_ROWS',
    'buildPixVerseLocalMcpConfigJson',
    'provider_mode="pixverse"',
    '"video.generate.pixverse"',
    'PixVerseMcpStdioClient',
    'run_pixverse_text_to_video',
  ]
  for (const token of requiredOwnerTokens) {
    if (!ownerText.includes(token)) {
      throw new Error(`Expected PixVerse implementation owners to include ${JSON.stringify(token)}`)
    }
  }

  const staleDocTokens = [
    'status: Draft',
    'cannot yet express PixVerse',
    'No PixVerse readiness surface exists',
    'Video remains mock-only today',
    'Claiming PixVerse is already a shipped harness provider',
    'Future PixVerse provider',
    'new PixVerse subprocess wrapper',
    'Add a new PixVerse execution path additively',
    'harness remains mock-only for video',
    'Shipped vs proposed states',
  ]
  for (const token of staleDocTokens) {
    if (doc.includes(token)) {
      throw new Error(`Expected PixVerse PRD/TAD to remove stale token ${JSON.stringify(token)}`)
    }
  }
}
