import { readFileSync } from 'node:fs'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { schemaFromJsonLd } from '@/features/schema/schemaJsonLd'

export function testEdaMlpTreeRendering() {
  // Path to the file as specified by user
  const filePath = '/Users/huijoohwee/Documents/GitHub/huijoohwee.github.io/guidelines/eda-mlp-implementation-guidelines.md'
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.warn('Could not read file at absolute path, trying relative to workspace root or skipping test if not found.')
    // Fallback for CI/CD or different env where absolute path might differ
    // Assuming the test runs in project root or we can find it
    // For this task, we assume the file exists at the path provided by user or we fail.
    throw e
  }

  const jsonld = buildMarkdownJsonLd(filePath, content)
  const schema = schemaFromJsonLd(jsonld)

  if (schema.layout?.mode !== 'tree') {
    throw new Error(`expected schema.layout.mode to be 'tree', got '${schema.layout?.mode}'`)
  }
  
  const tree = schema.layout?.tree
  if (!tree) {
    throw new Error('expected schema.layout.tree to be defined')
  }
  if (!tree.direction) {
    throw new Error('expected schema.layout.tree.direction to be defined')
  }
  
  // Check if metadata has tree info
  const meta = jsonld.metadata as Record<string, any>
  if (meta.layoutMode !== 'tree') {
    throw new Error(`expected metadata.layoutMode to be 'tree', got '${meta.layoutMode}'`)
  }
  if (!meta.tree) {
    throw new Error('expected metadata.tree to be defined')
  }
}
