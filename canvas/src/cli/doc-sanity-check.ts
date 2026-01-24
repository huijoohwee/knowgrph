import fs from 'node:fs'
import path from 'node:path'
import {
  getOrchestratorSectionDiagnostics,
  getOrchestratorSectionMarkdownTable,
  getRenderSectionDiagnostics,
  getRenderSectionMarkdownTable,
} from '../lib/config'
import { getWorkflowPresetMarkdownTable, WORKFLOW_PRESETS } from '../features/parsers/workflowPresets'
import { settingsRegistry } from '../features/settings/registry'
import { getSettingsMarkdownTable, getSettingsMarkdownRecords } from './settings-doc'

function countTableRows(table: string): number {
  const lines = table.split('\n').filter(line => line.trim().length > 0)
  if (lines.length <= 2) return 0
  return lines.length - 2
}

function formatCountRow(label: string, registryCount: number, tableCount: number): string {
  const status = registryCount === tableCount ? 'OK' : 'MISMATCH'
  return `${label}: registry=${registryCount}, table=${tableCount}, status=${status}`
}

function readDesignDoc(): string | null {
  const docPath = path.resolve(process.cwd(), '..', 'docs', 'knowgrph-design-document.md')
  try {
    return fs.readFileSync(docPath, 'utf8')
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err && err.code === 'ENOENT') {
      process.stdout.write(`Optional design doc not found, skipping checks: ${docPath}\n`)
      return null
    }
    throw err
  }
}

function extractTableBetweenMarkers(content: string, startMarker: string, endMarker: string): string {
  const startIndex = content.indexOf(startMarker)
  const endIndex = content.indexOf(endMarker)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`Markers not found or misordered: ${startMarker} / ${endMarker}`)
  }
  const start = startIndex + startMarker.length
  return content.slice(start, endIndex).trim()
}

function checkOrchestratorSections(): string {
  const diagnostics = getOrchestratorSectionDiagnostics()
  const table = getOrchestratorSectionMarkdownTable()
  const registryCount = diagnostics.length
  const tableCount = countTableRows(table)
  return formatCountRow('Orchestrator sections', registryCount, tableCount)
}

function checkRenderSectionsDocTable(): string {
  const diagnostics = getRenderSectionDiagnostics()
  const registryCount = diagnostics.length
  const expectedTable = getRenderSectionMarkdownTable().trim()
  const content = readDesignDoc()
  if (!content) {
    return 'Render sections: skipped (optional design doc missing)'
  }
  const actualTable = extractTableBetweenMarkers(
    content,
    '<!-- RENDER_SECTIONS_TABLE_START -->',
    '<!-- RENDER_SECTIONS_TABLE_END -->',
  ).trim()
  if (actualTable !== expectedTable) {
    throw new Error('Render sections table in knowgrph-design-document.md does not match getRenderSectionMarkdownTable()')
  }
  const tableCount = countTableRows(actualTable)
  return formatCountRow('Render sections', registryCount, tableCount)
}

const resolveGuidelinesPath = (): string => {
  const workspaceRoot = path.resolve(process.cwd(), '..', '..')
  const target = path.join('guidelines', 'codebase-maintainability-cid-guidelines.md')
  const direct = path.join(workspaceRoot, target)
  if (fs.existsSync(direct)) return direct
  const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(workspaceRoot, entry.name, target)
    if (fs.existsSync(candidate)) return candidate
  }
  return direct
}

function checkDocsMaintainability(): string {
  const docsDir = path.resolve(process.cwd(), '..', 'docs', 'documents')
  const entries = fs.readdirSync(docsDir, { withFileTypes: true })
  const violations: string[] = []
  const shouldIgnore = (name: string): boolean => {
    if (name === 'knowgrph-frontend-document.md') return true
    if (name.endsWith('-prd-tad.md')) return true
    if (name.endsWith('-prd.md')) return true
    if (name.endsWith('-tad.md')) return true
    if (name.endsWith('-guidelines.md')) return true
    return false
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.md')) continue
    if (shouldIgnore(entry.name)) continue
    const fullPath = path.join(docsDir, entry.name)
    const content = fs.readFileSync(fullPath, 'utf8')
    const lineCount = content.split('\n').length
    if (lineCount > 600) {
      violations.push(`${entry.name} (${lineCount} lines)`)
    }
  }
  if (violations.length > 0) {
    const guidelinesPath = resolveGuidelinesPath()
    throw new Error(
      `Documentation maintainability violation: docs/documents files exceed 600 lines per guidelines at ${guidelinesPath}: ${violations.join(
        ', ',
      )}`,
    )
  }
  return 'Docs maintainability: OK (all docs/documents/*.md ≤ 600 lines)'
}

function resolveAgenticRagSchemaReadmePath(): string | null {
  const workspaceRoot = path.resolve(process.cwd(), '..', '..')
  const preferred = path.join(workspaceRoot, 'huijoohwee.github.io', 'schema', 'AgenticRAG', 'README.md')
  if (fs.existsSync(preferred)) return preferred

  const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(workspaceRoot, entry.name, 'schema', 'AgenticRAG', 'README.md')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function extractSchemaFilesFromReadme(content: string): string[] {
  const startMarker = '<!-- SCHEMA_FILES_START -->'
  const endMarker = '<!-- SCHEMA_FILES_END -->'
  const startIndex = content.indexOf(startMarker)
  const endIndex = content.indexOf(endMarker)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('AgenticRAG README is missing SCHEMA_FILES_START/END markers')
  }
  const slice = content.slice(startIndex + startMarker.length, endIndex)
  const fenceStart = slice.indexOf('```')
  if (fenceStart === -1) throw new Error('AgenticRAG README schema files section missing code fence')
  const fenceEnd = slice.indexOf('```', fenceStart + 3)
  if (fenceEnd === -1) throw new Error('AgenticRAG README schema files section missing closing code fence')
  const tree = slice.slice(fenceStart + 3, fenceEnd)
  const lines = tree.split('\n').map(l => l.trim()).filter(Boolean)

  let activeDir = ''
  const out: string[] = []
  for (const line of lines) {
    const idx = line.indexOf('── ')
    if (idx === -1) continue
    const token = line.slice(idx + 3).trim().split(/\s+/)[0] || ''
    if (!token) continue
    if (token.endsWith('/')) {
      activeDir = token.replace(/\/+$/, '')
      continue
    }
    if (token.includes('/') || activeDir === '' || !line.startsWith('│')) {
      out.push(token)
      continue
    }
    out.push(`${activeDir}/${token}`)
  }
  return out
}

function listSchemaFilesFromDisk(schemaDir: string): string[] {
  const out: string[] = []
  const v1 = path.join(schemaDir, 'v1', 'context.jsonld')
  if (fs.existsSync(v1)) out.push('v1/context.jsonld')
  const readme = path.join(schemaDir, 'README.md')
  if (fs.existsSync(readme)) out.push('README.md')
  const entries = fs.readdirSync(schemaDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.jsonld')) continue
    out.push(entry.name)
  }
  return out.sort()
}

function checkAgenticRagSchemaFilesTable(): string {
  const readmePath = resolveAgenticRagSchemaReadmePath()
  if (!readmePath) return 'AgenticRAG schema README sync: skipped (schema repo not found)'

  const schemaDir = path.dirname(readmePath)
  const content = fs.readFileSync(readmePath, 'utf8')
  const fromReadme = extractSchemaFilesFromReadme(content).sort()
  const fromDisk = listSchemaFilesFromDisk(schemaDir)

  const a = new Set(fromReadme)
  const b = new Set(fromDisk)
  const missing: string[] = []
  const extra: string[] = []
  fromDisk.forEach((p) => {
    if (!a.has(p)) missing.push(p)
  })
  fromReadme.forEach((p) => {
    if (!b.has(p)) extra.push(p)
  })
  if (missing.length > 0 || extra.length > 0) {
    const parts = []
    if (missing.length > 0) parts.push(`missing in README: ${missing.join(', ')}`)
    if (extra.length > 0) parts.push(`extra in README: ${extra.join(', ')}`)
    throw new Error(`AgenticRAG README schema files section is out of sync (${parts.join(' | ')})`)
  }
  return 'AgenticRAG schema README sync: OK'
}

function checkWorkflowPresets(): string {
  const registryCount = WORKFLOW_PRESETS.length
  const table = getWorkflowPresetMarkdownTable()
  const tableCount = countTableRows(table)
  return formatCountRow('Workflow presets', registryCount, tableCount)
}

function checkSettingsRegistry(): string {
  const registryCount = settingsRegistry.length
  const records = getSettingsMarkdownRecords()
  const table = getSettingsMarkdownTable()
  const tableCount = countTableRows(table)
  const diagnostics = []
  diagnostics.push(formatCountRow('Settings registry', registryCount, tableCount))
  const recordCount = records.length
  const recordStatus = recordCount === registryCount ? 'OK' : 'MISMATCH'
  diagnostics.push(`Settings records: registry=${registryCount}, records=${recordCount}, status=${recordStatus}`)
  return diagnostics.join('\n')
}

function main() {
  const lines = []
  lines.push(checkOrchestratorSections())
  lines.push(checkRenderSectionsDocTable())
  lines.push(checkWorkflowPresets())
  lines.push(checkSettingsRegistry())
  lines.push(checkAgenticRagSchemaFilesTable())
  lines.push(checkDocsMaintainability())
  process.stdout.write(`${lines.join('\n')}\n`)
}

main()
