import fs from 'node:fs'
import path from 'node:path'

import { parseGraphragCliConfigYamlToJsonLd } from '@/features/panels/utils/graphragConfig'

const argv = process.argv.slice(2)
const configArg = argv[0]
const graphIdArg = argv[1]

const configPath = configArg && configArg.trim() ? configArg.trim() : 'configs/graphrag/config.yaml'
const graphId = graphIdArg && graphIdArg.trim() ? graphIdArg.trim() : 'graph'

const absPath = path.resolve(process.cwd(), configPath)

let yamlText = ''
try {
  yamlText = fs.readFileSync(absPath, 'utf8')
} catch {
  process.stderr.write(`Failed to read GraphRAG config YAML at ${absPath}\n`)
  process.exit(1)
}

const doc = parseGraphragCliConfigYamlToJsonLd(yamlText, graphId)

if (!doc) {
  process.stderr.write('Unrecognized GraphRAG config YAML\n')
  process.exit(1)
}

const jsonText = JSON.stringify(doc, null, 2)
process.stdout.write(`${jsonText}\n`)

