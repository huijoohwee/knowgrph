import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FLOW_RUN_ALL_PHASES } from '@/lib/storyboardWidget/runAllSequenceSsot'
import { TEST_VALIDATION_WORKSPACE_SEED_REL_PATH } from '@/features/workspace-fs/workspaceFs'

function escapeMarkdownCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />')
    .trim()
}

function buildMarkdown(): string {
  const lines: string[] = []
  lines.push('# knowgrph - Storyboard Widget Run All Sequence Reference (Runtime SSOT)')
  lines.push('')
  lines.push('App SSOT entrypoint: `canvas/src/lib/storyboardWidget/runAllSequenceSsot.ts`')
  lines.push('Generated file: `docs/documents/knowgrph-flow-run-all-reference.md`.')
  lines.push('')
  lines.push(`Validation script target: \`${TEST_VALIDATION_WORKSPACE_SEED_REL_PATH}\`.`)
  lines.push('')
  lines.push('| Sequence | phase id | label |')
  lines.push('| --- | --- | --- |')
  for (let i = 0; i < FLOW_RUN_ALL_PHASES.length; i += 1) {
    const phase = FLOW_RUN_ALL_PHASES[i]!
    lines.push(`| ${i + 1} | \`${escapeMarkdownCell(phase.id)}\` | ${escapeMarkdownCell(phase.label)} |`)
  }
  lines.push('')
  lines.push('Run-order policy:')
  lines.push('- Execute in phase order: Text -> Character/Location Image -> Scene Image -> Video.')
  lines.push('- Keep ordering stable by node position (`y`, then `x`, then `id`) inside each phase.')
  lines.push('- Prioritize scene images that feed video reference edges before other scene images.')
  lines.push('')
  return lines.join('\n')
}

function main(): void {
  const filePath = fileURLToPath(import.meta.url)
  const rootDir = path.resolve(path.dirname(filePath), '../../..')
  const outputPath = path.join(rootDir, 'docs/documents/knowgrph-flow-run-all-reference.md')
  fs.writeFileSync(outputPath, buildMarkdown(), 'utf8')
  process.stdout.write(`Wrote ${outputPath}\n`)
}

main()

