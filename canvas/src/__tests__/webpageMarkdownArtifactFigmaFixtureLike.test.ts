import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { looksLikeWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

export const testWebpageMarkdownArtifactFigmaFixtureIsRecognized = () => {
  const self = fileURLToPath(import.meta.url)
  const dir = path.dirname(self)
  const fixturePath = path.resolve(dir, '../../../../sandbox/test-data/webpage-markdown-figma.md')
  if (!fs.existsSync(fixturePath)) throw new Error(`missing fixture: ${fixturePath}`)
  const text = fs.readFileSync(fixturePath, 'utf-8')
  if (!looksLikeWebpageMarkdownArtifactDoc(text)) throw new Error('expected figma fixture-like markdown recognized as artifact')
  if (!/\*\*URL:\*\*\s+https:\/\//.test(text)) throw new Error('expected fixture URL header')
  if (!/^##\s+(?:📋\s+)?TABLE\s+OF\s+CONTENTS\s*$/mi.test(text)) throw new Error('expected fixture table of contents heading')
}
