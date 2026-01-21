import { resolveCurationJsonViewText } from '@/components/BottomPanel/bottomPanelJsonView'

export function testBottomPanelCurationJsonEditorPrefersSourceJson() {
  const graph = '{"nodes":[],"edges":[]}'
  const source = '{"metadata":{"video_id":"abc"},"segments":[],"markdown":""}'

  const a = resolveCurationJsonViewText({
    tab: 'curation',
    curationView: 'json',
    jsonSourceDocumentText: source,
    graphJsonText: graph,
  })
  if (a.text !== source || a.isSource !== true) {
    throw new Error('Expected curation JSON editor to prefer source JSON when present')
  }

  const b = resolveCurationJsonViewText({
    tab: 'curation',
    curationView: 'json',
    jsonSourceDocumentText: '   ',
    graphJsonText: graph,
  })
  if (b.text !== graph || b.isSource !== false) {
    throw new Error('Expected curation JSON editor to fall back to graph JSON when source is empty')
  }

  const c = resolveCurationJsonViewText({
    tab: 'nodes',
    curationView: 'json',
    jsonSourceDocumentText: source,
    graphJsonText: graph,
  })
  if (c.text !== graph || c.isSource !== false) {
    throw new Error('Expected non-curation views to keep graph JSON')
  }
}

