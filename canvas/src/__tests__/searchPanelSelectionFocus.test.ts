import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSearchPanelSelectionRequestsSharedSelectionZoom() {
  const searchPanelPath = resolve(process.cwd(), 'src', 'components', 'SearchPanel.tsx')
  const text = readFileSync(searchPanelPath, 'utf8')

  if (!text.includes('const commitSearchSelection = React.useCallback((result: SearchResult | null | undefined) => {')) {
    throw new Error('expected SearchPanel to centralize search result selection into a shared handler')
  }
  if (!text.includes("setSelectionSource('menu')")) {
    throw new Error('expected SearchPanel selection to mark search-originated selections as menu-driven')
  }
  if (!text.includes("requestZoom('selection')")) {
    throw new Error('expected SearchPanel selection to request shared selection zoom so chosen results surface in the viewport')
  }
  if (!text.includes('commitSearchSelection(searchResults[activeIdx])')) {
    throw new Error('expected keyboard Enter selection to reuse the shared search selection handler')
  }
  if (!text.includes('onClick={() => commitSearchSelection(r)}')) {
    throw new Error('expected pointer selection to reuse the shared search selection handler')
  }
}
