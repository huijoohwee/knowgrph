import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardFixedCardOverlaySkipsNoopTransformWrites() {
  const text = readFileSync(resolve(process.cwd(), 'src/components/FlowEditorCanvas/StoryboardCardOverlayLayer2d.tsx'), 'utf8')
  for (const snippet of [
    "willChange: 'transform'",
    'lastAppliedBoxByCardIdRef',
    'const boxChanged = !prevBox',
    'Math.abs(prevBox.left - box.left) >= 0.25',
    'if (boxChanged) {',
    'lastAppliedBoxByCardIdRef.current.set',
    'lastAppliedBoxByCardIdRef.current.delete(key)',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected Storyboard fixed-card overlay to avoid redundant transform writes: ${snippet}`)
    }
  }
}
