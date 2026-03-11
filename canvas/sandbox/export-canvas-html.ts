import fs from 'node:fs/promises'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { defaultSchema } from '@/lib/graph/schema'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'

function readArg(name: string): string {
  const ix = process.argv.indexOf(name)
  const v = ix >= 0 ? process.argv[ix + 1] : ''
  const out = String(v || '').trim()
  if (!out) throw new Error(`Missing ${name}`)
  return out
}

function readOptionalArg(name: string): string {
  const ix = process.argv.indexOf(name)
  const v = ix >= 0 ? process.argv[ix + 1] : ''
  return String(v || '').trim()
}

async function main() {
  const input = readArg('--input')
  const output = readArg('--output')
  const modeRaw = readOptionalArg('--mode')
  const mode = modeRaw === '3d' ? '3d' : '2d'

  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' })
  ;(globalThis as unknown as { window?: unknown }).window = dom.window
  ;(globalThis as unknown as { document?: unknown }).document = dom.window.document
  ;(globalThis as unknown as { DOMParser?: unknown }).DOMParser = dom.window.DOMParser
  ;(globalThis as unknown as { XMLSerializer?: unknown }).XMLSerializer = dom.window.XMLSerializer
  ;(globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle = dom.window.getComputedStyle

  const text = await fs.readFile(input, 'utf8')
  const name = path.basename(input)

  const loaded = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
  const graphData = loaded?.graphData || null
  if (!graphData) throw new Error('No graphData produced from input')

  const svgMarkup =
    mode === '3d'
      ? exportGraphAsCentered3dSvgMarkup({
          graphData,
          schema: defaultSchema,
          widthPx: 1280,
          heightPx: 720,
          paddingPx: 96,
          includeXmlDeclaration: false,
          animated: false,
        })
      : exportGraphAsCenteredSvgMarkup({
          graphData,
          schema: defaultSchema,
          widthPx: 1280,
          heightPx: 720,
          paddingPx: 96,
          includeXmlDeclaration: false,
          animated: false,
        })
  if (!svgMarkup || !svgMarkup.trim()) throw new Error('Failed to build SVG')

  const html = await buildGraphHtmlViewerMarkup({
    title: `${name} (Canvas)`,
    svgMarkup,
    graphData,
    includeRichMediaOverlays: true,
    mediaPanelDensity: 'default',
  })
  if (!html || !html.trim()) throw new Error('Failed to build HTML')

  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, html, 'utf8')
  process.stdout.write(output + '\n')
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err) + '\n')
  process.exit(1)
})
