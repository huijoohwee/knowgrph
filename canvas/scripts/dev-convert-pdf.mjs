import fs from 'node:fs/promises'
import path from 'node:path'

const pdfPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : ''
if (!pdfPath) {
  console.error('Missing pdf path argument')
  process.exit(1)
}

const url = process.argv[3] || 'http://127.0.0.1:5173/__convert_pdf'
const buf = await fs.readFile(pdfPath)
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/pdf',
    Accept: 'application/json',
    'X-Import-Filename': path.basename(pdfPath),
  },
  body: buf,
})
const json = await res.json()
const md = String(json.markdown || '')
const pageCount = (md.match(/^## Page\b/gm) || []).length
console.log(JSON.stringify({ status: res.status, ok: json.ok, name: json.name, chars: md.length, pages: pageCount, error: json.error || '' }, null, 2))
console.log(md.split(/\r?\n/).slice(0, 20).join('\n'))
