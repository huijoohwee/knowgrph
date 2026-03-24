import { fetchWorkspaceUrlContent } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'

export async function testUrlImportAuthWallStubSkipsHydrationForXHome() {
  const url = 'https://x.com/home'
  const res = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
  if (!res || typeof res.text !== 'string') throw new Error('missing content')
  if (!/kgWebpageView:\s*"markdown"/i.test(res.text)) throw new Error('expected markdown view')
  if (!/kgWebpageHydrate:\s*"false"/i.test(res.text)) throw new Error('expected hydrate=false')
}

export async function testUrlImportAuthWallStubSkipsHydrationForLinkedInFeed() {
  const url = 'https://www.linkedin.com/feed/'
  const res = await fetchWorkspaceUrlContent(url, { mode: 'import', viewHint: 'markdown' })
  if (!res || typeof res.text !== 'string') throw new Error('missing content')
  if (!/kgWebpageView:\s*"markdown"/i.test(res.text)) throw new Error('expected markdown view')
  if (!/kgWebpageHydrate:\s*"false"/i.test(res.text)) throw new Error('expected hydrate=false')
}

