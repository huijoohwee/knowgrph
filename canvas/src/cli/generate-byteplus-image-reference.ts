import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BYTEPLUS_IMAGE_GENERATION_DOC_ROWS,
  type BytePlusImageApiDocRow,
} from '@/features/integrations/byteplusImageGenerationSsot'

function escapeMarkdownCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />')
    .trim()
}

function buildJoinedCell(values: readonly string[]): string {
  return values.map(value => `\`${value}\``).join('; ')
}

function buildRow(row: BytePlusImageApiDocRow): string {
  const cells = [
    row.key,
    row.typeLabel,
    row.value,
    row.keyDescription,
    row.valueDescription,
    row.ssot,
    buildJoinedCell(row.module),
    buildJoinedCell(row.className),
    buildJoinedCell(row.functionName),
  ].map(escapeMarkdownCell)
  return `| ${cells.join(' | ')} |`
}

function getSortedRows(): BytePlusImageApiDocRow[] {
  return [...BYTEPLUS_IMAGE_GENERATION_DOC_ROWS].sort((left, right) => left.key.localeCompare(right.key))
}

function buildMarkdown(): string {
  return [
    '# knowgrph - BytePlus OpenArk Image Generation API Reference (SSOT + Codebase Map)',
    '',
    'App SSOT entrypoint: `canvas/src/features/integrations/byteplusImageGenerationSsot.ts`',
    'Vendor docs: https://docs.byteplus.com/en/docs/ModelArk/1666945',
    '',
    'Generated file: `docs/documents/knowgrph-byteplus-openark-image-generation-api-reference.md`.',
    '',
    'Table columns:',
    '- `key | type | value | key-description | value-description`: curated BytePlus image request-surface SSOT',
    '- `module | class | function`: where the row is anchored in the knowgrph codebase',
    '- Rows are sorted by `key` in ascending `a-z` order for static-reference scanability.',
    '',
    '| key | type | value | key-description | value-description | ssot | module | class | function |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...getSortedRows().map(buildRow),
    '',
  ].join('\n')
}

function main(): void {
  const filePath = fileURLToPath(import.meta.url)
  const rootDir = path.resolve(path.dirname(filePath), '../../..')
  const outputPath = path.join(rootDir, 'docs/documents/knowgrph-byteplus-openark-image-generation-api-reference.md')
  fs.writeFileSync(outputPath, buildMarkdown(), 'utf8')
  process.stdout.write(`Wrote ${outputPath}\n`)
}

main()
