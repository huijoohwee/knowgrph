import fs from 'node:fs'
import path from 'node:path'
import { buildKgTokensCssText } from '@/lib/ui/tokens-ssot'

const root = process.cwd()
const outPath = path.resolve(root, 'src', 'styles', 'kgTokens.generated.css')
const next = [
  buildKgTokensCssText('light', { selector: ':root' }),
  buildKgTokensCssText('dark', { selector: ':root.dark' }),
].join('')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, next, { encoding: 'utf8' })
process.stdout.write(`${outPath}\n`)
