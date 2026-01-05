import { getWorkflowPresetMarkdownTable } from '../features/parsers/workflowPresets'

function main() {
  const table = getWorkflowPresetMarkdownTable()
  process.stdout.write(`${table}\n`)
}

main()

