import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

export const testImportUrlWebpageCreatesHtmlFrontmatterStub = async () => {
  const res = await fetchWorkspaceUrlContent('https://grapesjs.com/pricing')
  if (!res || typeof res.text !== 'string') throw new Error('missing content')
  const text = res.text
  if (!text.includes('kgWebpageUrl:')) throw new Error('missing kgWebpageUrl')
  if (!text.includes('kgWebpageView:')) throw new Error('missing kgWebpageView')
  if (!/kgWebpageView:\s*"html"/i.test(text) && !/kgWebpageView:\s*html/i.test(text)) {
    throw new Error('expected kgWebpageView to be html')
  }
  const body = text.replace(/^---[\s\S]*?\n---\n?/m, '')
  if (body.trim()) throw new Error('expected stub body to be empty')
}

