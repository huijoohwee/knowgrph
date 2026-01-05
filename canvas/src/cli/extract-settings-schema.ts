import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type SettingsFlowRow = {
  area: string
  modules: string[]
  classes: string[]
  functions: string[]
  responsibility: string
  imports: string[]
  notes: string
  lineRange: string
}

type SettingsFlowSchema = Record<string, SettingsFlowRow>

function splitLines(text: string): string[] {
  return text.split(/\r?\n/)
}

function stripTicks(value: string): string {
  return value.replace(/`/g, '').trim()
}

function splitList(value: string): string[] {
  return stripTicks(value)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

function buildFromMarkdown(flowMarkdown: string): SettingsFlowSchema {
  const lines = splitLines(flowMarkdown)
  const schema: SettingsFlowSchema = {}
  const headerIndex = lines.findIndex(
    line => line.includes('| Area') && line.includes('| Responsibility') && line.includes('| Key'),
  )
  if (headerIndex === -1) return schema

  for (let index = headerIndex + 2; index < lines.length; index++) {
    const line = lines[index] ?? ''
    if (!line.includes('|')) break
    const rawCells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
    if (rawCells.length < 11) continue

    const [area, responsibility, modules, classes, functions, keyRaw, , , imports, notes] = rawCells
    const tail = rawCells.slice(10)
    const lineRangeCandidate = [...tail]
      .reverse()
      .find(value => stripTicks(value) && stripTicks(value) !== '<br />')
    const lineRange = stripTicks(lineRangeCandidate ?? (tail.length ? tail[tail.length - 1] ?? '' : ''))
    let key = stripTicks(keyRaw)
    if (!key) continue
    if (key.includes('/')) continue
    if (key === 'max-lines.max') key = 'max-lines'

    schema[key] = {
      area: stripTicks(area),
      modules: splitList(modules),
      classes: splitList(classes),
      functions: splitList(functions),
      responsibility: stripTicks(responsibility),
      imports: splitList(imports),
      notes: stripTicks(notes),
      lineRange,
    }
  }

  return schema
}

function ensure(schema: SettingsFlowSchema, key: string, row: SettingsFlowRow): void {
  if (!schema[key]) schema[key] = row
}

function main(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(currentDir, '../../..')
  const flowMdPath = path.join(repoRoot, 'knowgrph-codebase-responsibility-flow.md')
  const outJsonPublic = path.join(repoRoot, 'canvas', 'public', 'settings-flow.json')
  const outJsonSrc = path.join(repoRoot, 'canvas', 'src', 'features', 'settings', 'settings-flow.schema.json')

  const exists = existsSync(flowMdPath)
  const schema = exists ? buildFromMarkdown(readFileSync(flowMdPath, 'utf8')) : ({} as SettingsFlowSchema)

  ensure(schema, 'uiOverlayOpacity', {
    area: 'Global Translucency',
    modules: ['canvas/src/pages/Canvas.tsx'],
    classes: ['window.document.documentElement'],
    functions: ['useEffect'],
    responsibility: 'Canvas writes CSS variables to :root',
    imports: ['React', 'zustand'],
    notes: 'persisted kg:ui:overlayOpacity; clamps to [0,1]',
    lineRange: 'canvas/src/pages/Canvas.tsx:22–27',
  })

  const json = JSON.stringify(schema, null, 2)
  writeFileSync(outJsonPublic, json, 'utf8')
  writeFileSync(outJsonSrc, json, 'utf8')
  const suffix = exists ? '' : ' (source doc missing, defaults only)'
  process.stdout.write(
    `Wrote ${outJsonPublic} and ${outJsonSrc} with ${Object.keys(schema).length} settings${suffix}\n`,
  )
}

main()
