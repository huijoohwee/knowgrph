import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settingsRegistry } from '../features/settings/registry'
import { FALLBACK_DETAILS } from '../features/panels/views/SettingsFallbackDetails'

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

function normalizeHeaderCell(value: string): string {
  return stripTicks(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function buildHeaderIndexMap(headerLine: string): Record<string, number> {
  const cells = headerLine
    .split('|')
    .slice(1, -1)
    .map(cell => normalizeHeaderCell(cell))
  const map: Record<string, number> = {}
  cells.forEach((cell, idx) => {
    if (!cell) return
    map[cell] = idx
  })
  return map
}

function resolveHeaderIndex(
  map: Record<string, number>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const idx = map[normalizeHeaderCell(key)]
    if (typeof idx === 'number') return idx
  }
  return undefined
}

function buildFromMarkdown(flowMarkdown: string): SettingsFlowSchema {
  const lines = splitLines(flowMarkdown)
  const schema: SettingsFlowSchema = {}
  const headerIndex = lines.findIndex(line => line.includes('|') && line.toLowerCase().includes('key'))
  if (headerIndex === -1) return schema
  const headerMap = buildHeaderIndexMap(lines[headerIndex] ?? '')
  const idxArea = resolveHeaderIndex(headerMap, ['Area'])
  const idxResponsibility = resolveHeaderIndex(headerMap, ['Responsibility'])
  const idxModules = resolveHeaderIndex(headerMap, ['Modules', 'Module'])
  const idxClasses = resolveHeaderIndex(headerMap, ['Classes/Objects', 'ClassesObjects', 'Classes', 'Objects'])
  const idxFunctions = resolveHeaderIndex(headerMap, ['Functions/Methods', 'FunctionsMethods', 'Functions', 'Methods'])
  const idxKey = resolveHeaderIndex(headerMap, ['Key', 'Setting key', 'Settingkey'])
  const idxImports = resolveHeaderIndex(headerMap, ['Imports', 'Import'])
  const idxNotes = resolveHeaderIndex(headerMap, ['Notes', 'Note'])
  const idxLineRange = resolveHeaderIndex(headerMap, ['Line Range', 'LineRange', 'Lines'])
  if (typeof idxKey !== 'number') return schema

  for (let index = headerIndex + 2; index < lines.length; index++) {
    const line = lines[index] ?? ''
    if (!line.trim().startsWith('|')) break
    const rawCells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
    const keyRaw = rawCells[idxKey] ?? ''
    let key = stripTicks(keyRaw)
    if (!key) continue
    if (key.includes('/')) continue
    if (key === 'max-lines.max') key = 'max-lines'

    schema[key] = {
      area: stripTicks(typeof idxArea === 'number' ? rawCells[idxArea] ?? '' : ''),
      modules: splitList(typeof idxModules === 'number' ? rawCells[idxModules] ?? '' : ''),
      classes: splitList(typeof idxClasses === 'number' ? rawCells[idxClasses] ?? '' : ''),
      functions: splitList(typeof idxFunctions === 'number' ? rawCells[idxFunctions] ?? '' : ''),
      responsibility: stripTicks(
        typeof idxResponsibility === 'number' ? rawCells[idxResponsibility] ?? '' : '',
      ),
      imports: splitList(typeof idxImports === 'number' ? rawCells[idxImports] ?? '' : ''),
      notes: stripTicks(typeof idxNotes === 'number' ? rawCells[idxNotes] ?? '' : ''),
      lineRange: stripTicks(
        typeof idxLineRange === 'number' ? rawCells[idxLineRange] ?? '' : '',
      ),
    }
  }

  return schema
}

function ensure(schema: SettingsFlowSchema, key: string, row: SettingsFlowRow): void {
  if (!schema[key]) schema[key] = row
}

function collectFiles(dirPath: string, extensions: string[]): string[] {
  const entries = readdirSync(dirPath)
  const results: string[] = []
  entries.forEach(name => {
    const fullPath = path.join(dirPath, name)
    const st = statSync(fullPath)
    if (st.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions))
      return
    }
    if (extensions.some(ext => fullPath.endsWith(ext))) results.push(fullPath)
  })
  return results
}

function dedupe<T>(list: T[]): T[] {
  return Array.from(new Set(list))
}

function findDefinitionLocation(
  fileContentsByPath: Array<{ path: string; rel: string; lines: string[] }>,
  key: string,
): { module: string; lineRange: string } | null {
  const needleA = `key: '${key}'`
  const needleB = `key: "${key}"`
  for (const entry of fileContentsByPath) {
    for (let i = 0; i < entry.lines.length; i += 1) {
      const line = entry.lines[i] ?? ''
      if (line.includes(needleA) || line.includes(needleB)) {
        return { module: entry.rel, lineRange: `${entry.rel}:L${i + 1}` }
      }
    }
  }
  return null
}

function extractSetterNames(fn: unknown): string[] {
  if (typeof fn !== 'function') return []
  const src = fn.toString()
  const matches = src.match(/\.set[A-Za-z0-9_]+/g) || []
  return dedupe(matches.map(m => m.slice(1)))
}

function extractClassesFromFunction(fn: unknown): string[] {
  if (typeof fn !== 'function') return []
  const src = fn.toString()
  const classes: string[] = []
  if (src.includes('useGraphStore')) classes.push('useGraphStore')
  if (src.includes('localStorage')) classes.push('window.localStorage')
  if (src.includes('documentElement')) classes.push('window.document.documentElement')
  if (src.includes('document')) classes.push('window.document')
  if (src.includes('window')) classes.push('window')
  return dedupe(classes)
}

function findSetterModules(
  storeFiles: Array<{ rel: string; text: string }>,
  setterNames: string[],
): string[] {
  const modules: string[] = []
  setterNames.forEach(setter => {
    const hit = storeFiles.find(f => f.text.includes(setter))
    if (hit) modules.push(hit.rel)
  })
  return dedupe(modules)
}

function buildImportsForSource(source: string): string[] {
  if (source === 'store') return ['zustand']
  if (source === 'localStorage') return ['localStorage']
  if (source === 'env') return ['import.meta.env']
  if (source === 'backendEnv') return ['window.__ENV__']
  if (source === 'eslint') return ['eslint']
  return []
}

function humanizeKey(value: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
}

function inferAreaFromKey(key: string): string {
  if (key.startsWith('graphDataTable.aggregate')) return 'Graph Data Table Aggregation'
  if (key.startsWith('graphDataTable.')) return 'Graph Data Table'
  if (key.startsWith('graphFields.')) return 'Graph Fields'
  if (key.startsWith('graphHoverPreview.')) return 'Graph Hover Preview'
  if (key.startsWith('spotlight.')) return 'Launch Spotlight Layout'
  if (key === 'enableLaunchSpotlight') return 'Launch Spotlight'
  if (key.startsWith('schema.behavior.hover.')) return 'Graph Hover Preview'
  return '—'
}

function inferResponsibilityFromKey(key: string, type: string): string {
  const leaf = key.split('.').slice(-1)[0] || key
  const words = humanizeKey(leaf)
  if (type === 'boolean') {
    if (leaf.startsWith('enable')) return `Enable ${words.replace(/^enable\s+/, '')}`.trim()
    if (leaf.startsWith('show')) return `Show ${words.replace(/^show\s+/, '')}`.trim()
  }
  if (leaf.endsWith('Ms')) return `${words.replace(/\sms$/, '')} (ms)`
  return words
}

function deriveFromCode(repoRoot: string): SettingsFlowSchema {
  const canvasRoot = path.join(repoRoot, 'canvas')
  const srcRoot = path.join(canvasRoot, 'src')
  const settingsDir = path.join(srcRoot, 'features', 'settings')
  const storeDir = path.join(srcRoot, 'hooks', 'store')
  const settingFiles = collectFiles(settingsDir, ['.ts', '.tsx'])
  const storeFiles = collectFiles(storeDir, ['.ts', '.tsx'])
  const settingFileContents = settingFiles.map(filePath => {
    const rel = path.relative(repoRoot, filePath)
    const text = readFileSync(filePath, 'utf8')
    return { path: filePath, rel, lines: splitLines(text) }
  })
  const storeFileContents = storeFiles.map(filePath => ({
    rel: path.relative(repoRoot, filePath),
    text: readFileSync(filePath, 'utf8'),
  }))

  const schema: SettingsFlowSchema = {}
  settingsRegistry.forEach(meta => {
    const fallback = FALLBACK_DETAILS[meta.key] || {}
    const def = findDefinitionLocation(settingFileContents, meta.key)
    const setters = extractSetterNames(meta.write)
    const setterModules = findSetterModules(storeFileContents, setters)
    const classes = dedupe([
      ...extractClassesFromFunction(meta.read),
      ...extractClassesFromFunction(meta.write),
    ])
    const functions = dedupe(setters)
    const modules = dedupe([
      ...(def ? [def.module] : []),
      ...setterModules,
    ])
    const area = fallback.area || inferAreaFromKey(meta.key)
    const responsibility =
      fallback.responsibility || inferResponsibilityFromKey(meta.key, meta.type)
    schema[meta.key] = {
      area,
      responsibility,
      notes: fallback.notes || '',
      modules,
      classes,
      functions,
      imports: buildImportsForSource(meta.source),
      lineRange: def?.lineRange || '',
    }
  })
  return schema
}

function toMdCell(value: string): string {
  return String(value || '').replace(/\|/g, '\\|')
}

function buildMarkdown(schema: SettingsFlowSchema): string {
  const header =
    '| Area | Responsibility | Modules | Classes/Objects | Functions/Methods | Key | Imports | Notes | Line Range |'
  const separator =
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  const rows = Object.entries(schema)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => {
      return [
        `| ${toMdCell(row.area)} | ${toMdCell(row.responsibility)} | \`${toMdCell(row.modules.join(', '))}\` | \`${toMdCell(row.classes.join(', '))}\` | \`${toMdCell(row.functions.join(', '))}\` | \`${toMdCell(key)}\` | \`${toMdCell(row.imports.join(', '))}\` | ${toMdCell(row.notes)} | \`${toMdCell(row.lineRange)}\` |`,
      ].join('')
    })
  return ['# Knowgrph Codebase Responsibility Flow', '', header, separator, ...rows, ''].join('\n')
}

function mergeFlowRow(base: SettingsFlowRow, override: SettingsFlowRow): SettingsFlowRow {
  const pickText = (next: string, prev: string) => {
    const trimmed = String(next || '').trim()
    if (!trimmed || trimmed === '—') return prev
    return trimmed
  }
  const pickList = (next: string[], prev: string[]) => (Array.isArray(next) && next.length > 0 ? next : prev)
  return {
    area: pickText(override.area, base.area),
    responsibility: pickText(override.responsibility, base.responsibility),
    notes: pickText(override.notes, base.notes),
    modules: pickList(override.modules, base.modules),
    classes: pickList(override.classes, base.classes),
    functions: pickList(override.functions, base.functions),
    imports: pickList(override.imports, base.imports),
    lineRange: pickText(override.lineRange, base.lineRange),
  }
}

function main(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(currentDir, '../../..')
  const flowMdPath = path.join(repoRoot, 'knowgrph-codebase-responsibility-flow.md')
  const outJsonPublic = path.join(repoRoot, 'canvas', 'public', 'settings-flow.json')
  const outJsonSrc = path.join(repoRoot, 'canvas', 'src', 'features', 'settings', 'settings-flow.schema.json')

  const exists = existsSync(flowMdPath)
  const schemaFromMd = exists ? buildFromMarkdown(readFileSync(flowMdPath, 'utf8')) : ({} as SettingsFlowSchema)
  const schemaFromCode = deriveFromCode(repoRoot)
  const knownKeys = new Set(settingsRegistry.map(meta => meta.key))
  const merged: SettingsFlowSchema = {}
  Object.entries(schemaFromCode).forEach(([key, row]) => {
    if (knownKeys.has(key)) merged[key] = row
  })
  Object.entries(schemaFromMd).forEach(([key, row]) => {
    if (!knownKeys.has(key)) return
    const base = merged[key]
    merged[key] = base ? mergeFlowRow(base, row) : row
  })

  const overlay = merged['uiOverlayOpacity']
  ensure(merged, 'uiOverlayOpacity', {
    area: overlay?.area || 'Global Translucency',
    modules: overlay?.modules || [],
    classes: overlay?.classes || [],
    functions: overlay?.functions || [],
    responsibility: overlay?.responsibility || 'Main UI overlay opacity',
    imports: overlay?.imports || ['zustand'],
    notes: overlay?.notes || 'clamps to [0,1]',
    lineRange: overlay?.lineRange || '',
  })

  writeFileSync(flowMdPath, buildMarkdown(merged), 'utf8')

  const json = JSON.stringify(merged, null, 2)
  writeFileSync(outJsonPublic, json, 'utf8')
  writeFileSync(outJsonSrc, json, 'utf8')
  const suffix = exists ? '' : ' (source doc created)'
  process.stdout.write(
    `Wrote ${outJsonPublic} and ${outJsonSrc} with ${Object.keys(merged).length} settings${suffix}\n`,
  )
}

main()
