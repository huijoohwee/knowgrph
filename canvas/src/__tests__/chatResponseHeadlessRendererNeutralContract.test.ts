import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testChatResponseContractPromptRequiresHeadlessRendererNeutralOutput() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'chatResponseBaseContract.ts'), 'utf8')
  const requiredSnippets = [
    'headless and renderer-neutral',
    'portable frontmatter plus Markdown data',
    'text, image, audio, video, card, widget, and edge semantics as data',
    'Editor Workspace, Flow Editor, Storyboard, Rich Media Panels, Cards, and Edges',
    'inline-edit through shared owners',
  ]
  requiredSnippets.forEach(snippet => {
    if (!text.includes(snippet)) throw new Error(`Expected KGC response contract to require neutral shared-surface output: ${snippet}`)
  })
}
