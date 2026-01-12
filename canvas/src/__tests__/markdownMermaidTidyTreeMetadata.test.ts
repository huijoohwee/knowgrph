import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { schemaFromJsonLd } from '@/features/schema/schemaJsonLd'

export async function testMarkdownMermaidFrontmatterTidyTreeMetadataDefaults() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(process.cwd(), 'src/__tests__/sandbox/md-mmd-template.md')
  const markdown = readFileSync(path, 'utf8')

  const jsonld = buildMarkdownJsonLd(
    'file://md-mmd-template.md',
    markdown,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const schema = schemaFromJsonLd(jsonld)
  const meta = schema.metadata as Record<string, unknown> | undefined
  if (!meta) {
    throw new Error('expected schema.metadata to be present')
  }
  const tidy = meta.tidyTree as Record<string, unknown> | undefined
  if (!tidy) {
    throw new Error('expected metadata.tidyTree to be present')
  }

  const orientation = tidy.orientation
  const separation = tidy.separation

  if (orientation !== 'vertical') {
    throw new Error(`expected metadata.tidyTree.orientation === "vertical", got ${String(orientation)}`)
  }
  if (separation !== 1.5) {
    throw new Error(`expected metadata.tidyTree.separation === 1.5, got ${String(separation)}`)
  }

  const density = tidy.mermaidDensity as Record<string, unknown> | undefined
  if (!density) {
    throw new Error('expected metadata.tidyTree.mermaidDensity to be present')
  }
  const statementCount = density.statementCount
  if (typeof statementCount !== 'number' || !Number.isFinite(statementCount) || statementCount <= 0) {
    throw new Error(`expected positive mermaidDensity.statementCount, got ${String(statementCount)}`)
  }
  const densityLabel = String(density.density || '')
  if (!densityLabel) {
    throw new Error('expected non-empty mermaidDensity.density label')
  }
  if (densityLabel !== 'sparse') {
    throw new Error(`expected mermaidDensity.density === "sparse", got ${densityLabel}`)
  }

  await Promise.resolve()
}
