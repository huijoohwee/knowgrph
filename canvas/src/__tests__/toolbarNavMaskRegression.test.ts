import fs from 'node:fs'
import path from 'node:path'

export function testToolbarNavMasksCanvasUnderlay() {
  const filePath = path.resolve(process.cwd(), 'src/pages/Canvas.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('relative flex h-screen w-screen')) {
    throw new Error('Expected root canvas container to be positioned (relative) so split-mode header can overlay the canvas')
  }
  if (!text.includes('bg-transparent')) {
    throw new Error('Expected toolbar nav to be transparent so renderer visuals remain visible underneath')
  }
  if (!text.includes('pointer-events-none')) {
    throw new Error('Expected toolbar nav wrapper to not block pointer events for the canvas underneath')
  }
  if (!text.includes('pointer-events-auto')) {
    throw new Error('Expected toolbar content to remain interactive inside a pointer-events-none nav wrapper')
  }
  if (!text.includes('header className="absolute top-0 inset-x-0 z-[400]"')) {
    throw new Error('Expected workspace toolbar header to be an absolute overlay in editor/table mode')
  }
  if (!text.includes('absolute top-0 inset-x-0 z-[200]')) {
    throw new Error('Expected canvas toolbar nav to cover the top edge (top-0) to avoid visible underlay strip')
  }
}
