import { pickTextFile } from '@/lib/graph/file'
import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import { readCustomParsers, upsertCustomParser, type CustomParserConfig } from '@/features/parsers/persistence'
import { toParserSpec } from '@/features/parsers/custom'
import { registerParser } from '@/features/parsers/registry'
import { UI_COPY } from '@/lib/config'

export async function importCustomParsersFromText(text: string): Promise<{ imported: number; errors: string[] }>{
  const errors: string[] = []
  let items: CustomParserConfig[] = []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) items = parsed as CustomParserConfig[]
    else items = [parsed as CustomParserConfig]
  } catch {
    return { imported: 0, errors: [UI_COPY.invalidJsonLabel] }
  }
  let imported = 0
  for (const cfg of items) {
    if (!cfg || typeof cfg !== 'object') { errors.push('Invalid item'); continue }
    if (!cfg.id || !cfg.name || !cfg.base || !cfg.match) {
      const idStr = typeof cfg.id === 'string' ? cfg.id : ''
      errors.push(`Missing fields for ${idStr}`)
      continue
    }
    try {
      upsertCustomParser(cfg)
      const spec = toParserSpec(cfg)
      if (spec) registerParser(spec)
      imported += 1
    } catch {
      errors.push(`Failed to import ${cfg.id}`)
    }
  }
  return { imported, errors }
}

export async function importCustomParsersFromFile(): Promise<{ imported: number; errors: string[] }>{
  const f = await pickTextFile()
  if (!f) return { imported: 0, errors: ['No file selected'] }
  return importCustomParsersFromText(f.text)
}

export async function exportCustomParsersToFile(): Promise<boolean>{
  const arr = readCustomParsers()
  const pretty = JSON.stringify(arr, null, 2)
  const blob = new Blob([pretty], { type: 'application/json' })
  const saved = await saveBlobWithPicker(blob, 'parsers.json', { description: 'JSON Files', accept: { 'application/json': ['.json'] } })
  if (saved === '') return false
  if (saved) return true
  downloadBlob(blob, 'parsers.json')
  return true
}
