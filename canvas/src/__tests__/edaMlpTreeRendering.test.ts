import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { schemaFromJsonLd } from '@/features/schema/schemaJsonLd'

export async function testEdaMlpTreeRendering() {
  const envValue = String(process.env.KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH || '').trim()
  const candidatePaths = envValue
    ? [resolve(process.cwd(), envValue)]
    : [
        resolve(process.cwd(), '../data/test-data/eda-mlp-interview-session.fixture.md'),
        resolve(process.cwd(), 'data/test-data/eda-mlp-interview-session.fixture.md'),
      ]

  const mdPath = candidatePaths.find(p => existsSync(p))
  if (!mdPath) {
    await Promise.resolve()
    return
  }

  const markdown = readFileSync(mdPath, 'utf8')
  if (!markdown.trim()) {
    await Promise.resolve()
    return
  }

  const jsonld = buildMarkdownJsonLd('file://eda-mlp-interview-session.md', markdown)
  const schema = schemaFromJsonLd(jsonld)
  const meta = schema.metadata as Record<string, unknown> | undefined
  if (!meta) {
    throw new Error('expected schema.metadata to be present')
  }

  const layoutMode = String(meta.layoutMode || '')
  if (layoutMode !== 'mermaid') {
    throw new Error(`expected metadata.layoutMode to be 'mermaid', got '${layoutMode}'`)
  }

  const mermaidMeta =
    meta.mermaid && typeof meta.mermaid === 'object' && !Array.isArray(meta.mermaid)
      ? (meta.mermaid as Record<string, unknown>)
      : null
  if (!mermaidMeta) {
    throw new Error('expected metadata.mermaid to be present')
  }

  const edgeLabels = mermaidMeta.edgeLabels as unknown
  if (!Array.isArray(edgeLabels) || !edgeLabels.includes('pointsTo')) {
    throw new Error('expected metadata.mermaid.edgeLabels to include "pointsTo"')
  }

  const separation = mermaidMeta.separation as unknown
  if (typeof separation !== 'number' || !Number.isFinite(separation) || separation <= 0) {
    throw new Error(`expected positive metadata.mermaid.separation, got ${String(separation)}`)
  }

  const density =
    mermaidMeta.mermaidDensity && typeof mermaidMeta.mermaidDensity === 'object' && !Array.isArray(mermaidMeta.mermaidDensity)
      ? (mermaidMeta.mermaidDensity as Record<string, unknown>)
      : null
  if (!density) {
    throw new Error('expected metadata.mermaid.mermaidDensity to be present')
  }

  const statementCount = density.statementCount as unknown
  if (typeof statementCount !== 'number' || !Number.isFinite(statementCount) || statementCount <= 0) {
    throw new Error(`expected positive metadata.mermaid.mermaidDensity.statementCount, got ${String(statementCount)}`)
  }

  await Promise.resolve()
}
