import { getOrchestratorSectionMarkdownTable } from '../lib/config'

function main() {
  const table = getOrchestratorSectionMarkdownTable()
  process.stdout.write(`${table}\n`)
}

main()
