import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testChatResponseContractPromptRequiresHeadlessRendererNeutralOutput() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'chatResponseBaseContract.ts'), 'utf8')
  const requiredSnippets = [
    'headless and renderer-neutral',
    'portable frontmatter plus Markdown data',
    'text, image, audio, video, card, widget, and edge semantics as data',
    'Editor Workspace, Flow Editor, Storyboard, Strybldr, Rich Media Panels, Cards, and Edges',
    'inline-edit through shared owners',
    'response.structuredContent.frontmatter',
    'metadata projection never becomes a graph backfill channel',
    'storytree branches',
    'kgStrybldrStoryboard',
    'storytree.nodes[].parentNodeId',
    'candidateRuns[].parentNodeId',
    'never paste static connector geometry',
    'input/card/story output handles feed a compute widget',
  ]
  requiredSnippets.forEach(snippet => {
    if (!text.includes(snippet)) throw new Error(`Expected KGC response contract to require neutral shared-surface output: ${snippet}`)
  })
}
