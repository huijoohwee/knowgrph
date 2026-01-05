import { getRenderSectionMarkdownTable } from '../lib/config'

function main() {
  const table = getRenderSectionMarkdownTable()
  process.stdout.write(`${table}\n`)
}

main()

