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

function readDesignDoc(): string {
  const docPath = path.resolve(process.cwd(), '..', 'docs', 'knowgrph-design-document.md')
  return fs.readFileSync(docPath, 'utf8')
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
  process.stdout.write(`${lines.join('\n')}\n`)
}

main()
