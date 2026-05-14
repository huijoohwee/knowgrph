import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const build = (codes: number[]): string => String.fromCharCode(...codes)

const HOST = build([102, 105, 103, 109, 97, 46, 99, 111, 109])
const WWW_HOST = `${build([119, 119, 119, 46])}${HOST}`
const HTTPS_WWW = `${build([104, 116, 116, 112, 115, 58, 47, 47])}${WWW_HOST}${build([47])}`

function walkFiles(rootDir: string): string[] {
  const out: string[] = []
  const stack: string[] = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop()!
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i]!
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        stack.push(p)
        continue
      }
      if (!e.isFile()) continue
      if (!/\.(ts|tsx|md|mdx|json|css|html)$/.test(e.name)) continue
      out.push(p)
    }
  }
  return out
}

export function testForbidHardcodedDesignVendorHosts(): void {
  const self = fileURLToPath(import.meta.url)
  const root = path.resolve(path.dirname(self), '..')
  const files = walkFiles(root)
  for (let i = 0; i < files.length; i += 1) {
    const text = fs.readFileSync(files[i]!, 'utf-8')
    if (text.includes(HTTPS_WWW) || text.includes(WWW_HOST) || text.includes(HOST)) {
      throw new Error(`forbidden vendor host literal detected in: ${files[i]}`)
    }
  }
}

