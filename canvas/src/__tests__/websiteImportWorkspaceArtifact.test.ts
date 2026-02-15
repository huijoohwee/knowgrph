import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildWebpageWorkspaceEntryTextFromUpstreamMarkdown,
  buildWebsiteImportWebpageDocFromUpstreamMarkdown,
} from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

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
    websiteImportMeta: { importId: 'import-1', nodeId: 'node-1', outputDirRel: '.tmp' },
  })

  if (!actual.startsWith('---\n')) throw new Error('missing frontmatter')
  if (!actual.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!actual.includes('kgWebpageView:')) throw new Error('missing kgWebpageView')
  if (!actual.includes('kgWebsiteImportId:')) throw new Error('missing kgWebsiteImportId')
  if (!actual.includes('kgWebsiteNodeId:')) throw new Error('missing kgWebsiteNodeId')

  const layoutSlice = sliceBetween(actual, '## Layout Structure', '\n---\n')
  if (!layoutSlice) throw new Error('missing layout structure section')
  if (!layoutSlice.includes('GLOBAL NAVIGATION')) throw new Error('missing global navigation layout')

  const actualTemplateGallery = sliceBetween(actual, '## Template Showcase', '### Available Templates')
  if (!actualTemplateGallery) throw new Error('missing template showcase')
  if (!actualTemplateGallery.includes('┌─────────────────────────────────────────────────────────────────────────┐')) {
    throw new Error('missing template gallery ascii grid')
  }
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
