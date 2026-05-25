import { readFileSync } from 'node:fs'

export function testStoryboardCanvasKeepsNativeRendererContract() {
  const source = readFileSync(new URL('../components/StoryboardCanvas.tsx', import.meta.url), 'utf8')
  for (const snippet of ['Visual Brief', 'Reference Pack', 'selectNode(card.id)', 'buildStoryboardBoardModel']) {
    if (!source.includes(snippet)) {
      throw new Error(`expected StoryboardCanvas to retain native storyboard contract snippet: ${snippet}`)
    }
  }
  for (const forbidden of ['boords', 'peacock.boords.com', 'app.boords.com']) {
    if (source.toLowerCase().includes(forbidden)) {
      throw new Error(`expected StoryboardCanvas to avoid copied vendor reference: ${forbidden}`)
    }
  }
}
