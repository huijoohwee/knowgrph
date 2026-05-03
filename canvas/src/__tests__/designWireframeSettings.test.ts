import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDesignWireframeSettings } from '@/lib/render/designWireframeSettings'

export function testDesignWireframeSettingsDefaultsAndClamp() {
  const base = readDesignWireframeSettings(null)
  if (typeof base.showEdges !== 'boolean') throw new Error('expected boolean default showEdges')
  if (typeof base.maxEdges !== 'number' || base.maxEdges <= 0) throw new Error('expected numeric default maxEdges')

  const graphOverride = readDesignWireframeSettings(
    {
      metadata: {
        'renderer:designWireframe': {
          showEdges: false,
        },
      },
    } as unknown as never,
    {
      'renderer:designWireframe': {
        showEdges: true,
      },
    } as unknown as never,
  )
  if (graphOverride.showEdges !== true) throw new Error('expected graph metadata to override showEdges')

  const bad = readDesignWireframeSettings({
    metadata: {
      'renderer:designWireframe': {
        showEdges: 'yes',
        showLabelChips: 1,
        showMetaChips: null,
        avoidLabelCollisions: 'no',
        showTextPreview: {},
        showMediaPreview: [],
        depthFade: 'true',
        maxEdges: 999999,
        maxLabelChars: -5,
      },
    },
  } as unknown as never)
  if (bad.maxEdges !== 5000) throw new Error('expected maxEdges to clamp to 5000')
  if (bad.maxLabelChars !== 8) throw new Error('expected maxLabelChars to clamp to 8')

  const ok = readDesignWireframeSettings({
    metadata: {
      'renderer:designWireframe': {
        showEdges: true,
        showLabelChips: false,
        showMetaChips: true,
        avoidLabelCollisions: false,
        showTextPreview: false,
        showMediaPreview: true,
        depthFade: false,
        maxEdges: 120,
        maxLabelChars: 32,
      },
    },
  } as unknown as never)
  if (ok.showEdges !== true) throw new Error('expected showEdges true')
  if (ok.showLabelChips !== false) throw new Error('expected showLabelChips false')
  if (ok.avoidLabelCollisions !== false) throw new Error('expected avoidLabelCollisions false')
  if (ok.maxEdges !== 120) throw new Error('expected maxEdges 120')
  if (ok.maxLabelChars !== 32) throw new Error('expected maxLabelChars 32')
}

export function testDesignWireframeSettingsReusesSharedMetadataReader() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'render', 'designWireframeSettings.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected designWireframeSettings to reuse the shared document metadata coercion helper upstream')
  }
  if (!text.includes('const schemaMeta = toMetadataRecord(schema?.metadata)')) {
    throw new Error('expected designWireframeSettings to reuse the shared document metadata reader for schema metadata')
  }
  if (!text.includes('const graphMeta = graphMetadata ? (toMetadataRecord(graphMetadata) as Record<string, JSONValue>) : null')) {
    throw new Error('expected designWireframeSettings to reuse the shared document metadata reader for graph metadata overrides')
  }
  if (text.includes("schema?.metadata && typeof schema.metadata === 'object' && !Array.isArray(schema.metadata)")) {
    throw new Error('expected designWireframeSettings to stop coercing schema metadata inline')
  }
}

export function testDesignWireframeSettingsReusesSharedPlainObjectGuard() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'render', 'designWireframeSettings.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected designWireframeSettings to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected designWireframeSettings to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const schemaObj = readPlainObject(schemaRaw)')) {
    throw new Error('expected designWireframeSettings schema overrides to reuse the shared local plain-object helper')
  }
  if (!text.includes('const graphObj = readPlainObject(graphRaw)')) {
    throw new Error('expected designWireframeSettings graph overrides to reuse the shared local plain-object helper')
  }
  if (text.includes("const schemaObj = schemaRaw && typeof schemaRaw === 'object' && !Array.isArray(schemaRaw) ? (schemaRaw as Record<string, unknown>) : null")) {
    throw new Error('expected designWireframeSettings to stop coercing override objects inline')
  }
}
