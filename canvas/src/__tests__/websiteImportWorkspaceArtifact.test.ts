import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildWebpageWorkspaceEntryTextFromUpstreamMarkdown,
  buildWebsiteImportWebpageDocFromUpstreamMarkdown,
} from '@/features/markdown-workspace/workspaceImport'

export const testWebsiteImportWorkspaceWritesArtifactDoc = () => {
  const self = fileURLToPath(import.meta.url)
  const dir = path.dirname(self)
  const upstreamPath = path.resolve(dir, './fixtures/remotion-dev.upstream-fixture.md')
  const upstream = fs.readFileSync(upstreamPath, 'utf-8')

  const actual = buildWebpageWorkspaceEntryTextFromUpstreamMarkdown({
    upstreamMarkdown: upstream,
    url: 'https://example.com/',
    view: 'html',
    title: 'Remotion | Make videos programmatically',
    fidelityLevel: 4,
    includeImages: true,
    preserveBodyFidelity: true,
    websiteImportMeta: {
      importId: 'import-1',
      nodeId: 'node-1',
      outputDirRel: '.tmp',
      rawHtmlRelPath: '.tmp/import-1/nodes/node-1/raw.html',
      markdownRelPath: '.tmp/import-1/nodes/node-1/page.md',
      conversionJsonRelPath: '.tmp/import-1/nodes/node-1/conversion.json',
      rawHtmlSha256: 'raw-hash',
    },
  })

  if (!actual.startsWith('---\n')) throw new Error('missing frontmatter')
  if (!actual.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!actual.includes('kgWebpageView:')) throw new Error('missing kgWebpageView')
  if (!actual.includes('kgWebsiteImportId:')) throw new Error('missing kgWebsiteImportId')
  if (!actual.includes('kgWebsiteNodeId:')) throw new Error('missing kgWebsiteNodeId')
  if (!actual.includes('kgWebsiteRawHtmlRelPath:')) throw new Error('missing raw HTML artifact path')
  if (!actual.includes('kgWebsiteMarkdownRelPath:')) throw new Error('missing markdown artifact path')
  if (!actual.includes('kgWebsiteConversionJsonRelPath:')) throw new Error('missing conversion JSON artifact path')
  if (!actual.includes('kgWebsiteRawHtmlSha256:')) throw new Error('missing raw HTML artifact hash')
  if (!actual.includes('kgWebpageFidelityLevel: "4"')) throw new Error('missing source-fidelity level')

  if (actual.includes('## Layout Structure')) throw new Error('should not invent layout structure section')
  if (actual.includes('GLOBAL NAVIGATION')) throw new Error('should not inject layout wireframe into source text')
  if (!actual.includes('# Make videos programmatically.')) throw new Error('missing upstream title')
  if (!actual.includes('## Pricing')) throw new Error('missing upstream pricing section')
}

export const testWebsiteImportWorkspaceWritesSourceFaithfulDoc = () => {
  const upstream = [
    '# The AIAP Field Guide (Version 4.0)',
    '',
    'A 12 months self-directed AI/ML learning journey.',
    '',
    '## Section 3: Deep Learning',
    '',
    'TensorFlow and PyTorch are two popular AI frameworks.',
    '',
    'Optional: Mathematics for Machine Learning',
  ].join('\n')

  const actual = buildWebsiteImportWebpageDocFromUpstreamMarkdown({
    upstreamMarkdown: upstream,
    url: 'https://aiap.sg/aiap-field-guide/',
    view: 'markdown',
    websiteImportMeta: { importId: 'import-1', nodeId: 'node-1', outputDirRel: '.tmp' },
  })

  if (!actual.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!actual.includes('kgWebsiteImportId:')) throw new Error('missing kgWebsiteImportId')
  if (!actual.includes('Section 3: Deep Learning')) throw new Error('missing Section 3 heading')
  if (!actual.includes('Optional: Mathematics for Machine Learning')) throw new Error('missing upstream optional line')
}
