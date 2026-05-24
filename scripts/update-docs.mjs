import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const args = new Set(process.argv.slice(2))
const previewOnly = args.has('--preview-only')
const referencesOnly = args.has('--references-only')

if (previewOnly && referencesOnly) {
  console.error('[docs:update] choose at most one of --preview-only or --references-only')
  process.exit(1)
}

const referenceScripts = [
  'docs:byteplus-chat-reference',
  'docs:byteplus-chat-codebase-index',
  'docs:byteplus-image-reference',
  'docs:byteplus-image-codebase-index',
  'docs:byteplus-video-reference',
  'docs:byteplus-video-codebase-index',
  'docs:grabmaps-reference',
  'docs:grabmaps-sgp-admin-areas',
  'docs:grabmaps-codebase-index',
  'docs:openai-reference',
]

const workflowPreviewDocuments = [
  'docs/documents/knowgrph-pipeline-document.md',
  'docs/documents/knowgrph-pipeline-deep-dive-document.md',
  'docs/documents/knowgrph-parser-document.md',
  'docs/documents/knowgrph-orchestrator-document.md',
  'docs/documents/knowgrph-ontology-document.md',
  'docs/documents/knowgrph-schema-document.md',
  'docs/documents/knowgrph-renderer-document.md',
  'docs/documents/knowgrph-semantic-document.md',
  'docs/documents/knowgrph-ui-ux-design-document.md',
  'docs/documents/knowgrph-codebase-semantics-document.md',
  'docs/documents/knowgrph-fields-document.md',
  'docs/documents/knowgrph-metadata-document.md',
  'docs/documents/knowgrph-ingestor-document.md',
  'docs/documents/knowgrph-codebase-index-document.md',
  'docs/documents/knowgrph-demo-document.md',
  'docs/documents/knowgrph-design-document.md',
  'docs/documents/knowgrph-llm-prompt-contract.md',
  'docs/documents/knowgrph-local-storage-document.md',
  'docs/documents/knowgrph-mermaid-frontmatter-document.md',
  'docs/documents/knowgrph-settings-document.md',
  'docs/documents/knowgrph-testing-document.md',
]

const workflowPreviewOutputDir = 'data/knowgrph-workflow-preview'

const run = (command, commandArgs, label) => {
  console.log(`[docs:update] ${label}`)
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!previewOnly) {
  for (const scriptName of referenceScripts) {
    run('npm', ['run', scriptName], `run ${scriptName}`)
  }
}

if (!referencesOnly) {
  for (const markdownPath of workflowPreviewDocuments) {
    run(
      'python3',
      ['-m', 'knowgrph_parser', 'markdown', '--input', markdownPath, '--output-dir', workflowPreviewOutputDir],
      `render ${markdownPath} -> ${workflowPreviewOutputDir}`,
    )
  }
}
