import fs from 'node:fs'
import path from 'node:path'

export type WebpageArtifactFixtureName = 'codex' | 'remotion'

export const readWebpageArtifactFixture = (fixtureName: WebpageArtifactFixtureName) => {
  const fixturePath = path.resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'webpage-artifacts', `${fixtureName}.md`)
  const markdownText = fs.readFileSync(fixturePath, 'utf8')
  if (!markdownText || !markdownText.trim()) throw new Error(`expected ${fixtureName} webpage artifact fixture to be non-empty`)
  return {
    markdownText,
    activeDocumentPath: `/fixtures/webpage-artifacts/${fixtureName}.md`,
    editorUri: `inmemory://${fixtureName}-webpage-artifact.md`,
  }
}
