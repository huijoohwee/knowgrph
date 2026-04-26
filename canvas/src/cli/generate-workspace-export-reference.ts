import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { WORKSPACE_EXPORT_MENU_ITEMS } from '@/lib/toolbar/exportMenuSsot'

function escapeMarkdownCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />')
    .trim()
}

function buildRow(args: { id: string; label: string }): string {
  const cells = [args.label, `\`${args.id}\``].map(escapeMarkdownCell)
  return `| ${cells.join(' | ')} |`
}

function buildMarkdown(): string {
  return [
    '# knowgrph - Workspace Export Reference (Runtime SSOT)',
    '',
    'App SSOT entrypoint: `canvas/src/lib/toolbar/exportMenuSsot.ts`',
    'Generated file: `docs/documents/knowgrph-workspace-export-reference.md`.',
    '',
    'Notes:',
    '- Export menu entries are SSOT-driven so Launch → Export stays in sync with the codebase reference.',
    "- PNG/SVG prefer DOM capture when `renderMediaAsNodes` is disabled so Rich Media overlays are included.",
    '',
    '| Export menu label | export action key |',
    '| --- | --- |',
    ...WORKSPACE_EXPORT_MENU_ITEMS.map(item => buildRow({ id: item.id, label: item.menuLabel })),
    '',
  ].join('\n')
}

function main(): void {
  const filePath = fileURLToPath(import.meta.url)
  const rootDir = path.resolve(path.dirname(filePath), '../../..')
  const outputPath = path.join(rootDir, 'docs/documents/knowgrph-workspace-export-reference.md')
  fs.writeFileSync(outputPath, buildMarkdown(), 'utf8')
  process.stdout.write(`Wrote ${outputPath}\n`)
}

main()

