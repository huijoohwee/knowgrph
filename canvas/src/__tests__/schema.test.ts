import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defaultSchema, getRendererPalette, MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { validateSchema } from '@/features/schema/validation'
import { parseSchemaText } from '@/features/schema/io'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeSchemaTabEnterText } from '@/features/schema-editor/useSchemaTab'
import { LS_KEYS } from '@/lib/config'
import { readSchemaFromStorage, writeSchemaToStorage } from '@/hooks/store/schemaSlice'
import { getSchemaBaseForUiApply } from '@/features/schema/ui/utils'
import { canUseSchemaUiApplyRegistration, type SchemaUiApplyRegistration } from '@/features/schema-editor/useWorkflowManagerSchema'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { clampCollisionRadius } from '@/features/panels/utils/orchestratorTraversal'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { canonicalizeSchemaForPersistence, stringifyCanonicalSchema } from '@/features/schema/schemaCanonical'
import { schemaFromJsonLd, schemaToJsonLd } from '@/features/schema/schemaJsonLd'

export const testValidateSchemaFillsDefaults = () => {
  const s = validateSchema({})
  if (!s.labelStyles || s.labelStyles.fontSize !== defaultSchema.labelStyles!.fontSize) throw new Error('fontSize default missing')
  if (!s.layout || !s.layout.forces || typeof s.layout.forces.charge !== 'number') throw new Error('layout defaults missing')
  if (!s.layout || s.layout.mode !== defaultSchema.layout!.mode) throw new Error('layout mode default missing')
}

export const testValidateSchemaBehaviorDefaults = () => {
  const s = validateSchema({})
  if (!s.behavior) throw new Error('behavior defaults missing')
  const exp = s.behavior.expansion || {}
  if (exp.enabled === false) throw new Error('expansion should be enabled by default')
  if (exp.zoomOnSelection === false) throw new Error('zoomOnSelection default should be enabled')
  const s2 = validateSchema({ behavior: { ...defaultSchema.behavior, expansion: { enabled: false } } })
  const exp2 = s2.behavior?.expansion || {}
  if (exp2.enabled !== false) throw new Error('expansion enabled override not applied')
  if (exp2.zoomOnSelection === false) throw new Error('zoomOnSelection should not be forced off when only enabled is overridden')
}

export const testAddRenameRemoveNodeType = () => {
  const { addNodeType, renameNodeType, removeNodeType } = useGraphStore.getState()
  addNodeType('Company')
  if (!(useGraphStore.getState().schema.catalog!.nodeTypes.includes('Company'))) throw new Error('Add node type failed')
  renameNodeType('Company', 'Org')
  if (!(useGraphStore.getState().schema.catalog!.nodeTypes.includes('Org'))) throw new Error('Rename node type failed')
  removeNodeType('Org')
  if ((useGraphStore.getState().schema.catalog!.nodeTypes.includes('Org'))) throw new Error('Remove node type failed')
}

export const testUpsertRemoveNodeProperty = () => {
  const { addNodeType, upsertNodeProperty, removeNodeProperty } = useGraphStore.getState()
  addNodeType('Entity')
  upsertNodeProperty('Entity', 'name', { type: 'string', required: true })
  const vNode = useGraphStore.getState().schema.validation!.node!['Entity']
  if (!vNode || !(vNode.required || []).includes('name')) throw new Error('Upsert node property required failed')
  removeNodeProperty('Entity', 'name')
  const vNode2 = useGraphStore.getState().schema.validation!.node!['Entity']
  if ((vNode2?.required || []).includes('name')) throw new Error('Remove node property failed')
}

export const testClampAlphaDecay = () => {
  const { setAlphaDecay } = useGraphStore.getState()
  setAlphaDecay(5)
  const a = useGraphStore.getState().schema.layout!.forces!.alphaDecay!
  if (a > 1 || a < 0) throw new Error('AlphaDecay clamp failed')
}

export const testClampCollisionRadiusUsesSharedBounds = () => {
  const low = clampCollisionRadius(0)
  if (low < 4) throw new Error('Collision radius clamp should enforce minimum bound')
  const high = clampCollisionRadius(10_000)
  if (high > 40) throw new Error('Collision radius clamp should enforce maximum bound')
  const defaulted = clampCollisionRadius(null)
  if (defaulted < 4 || defaulted > 40) {
    throw new Error('Collision radius clamp should return a default within bounds')
  }
}

export const testSchemaTabEnterText = () => {
  const customSchema = {
    ...defaultSchema,
    nodeStyles: { ...defaultSchema.nodeStyles, Investor: { color: '#ff2600' } },
  }
  const unchanged = computeSchemaTabEnterText('schema', '{\n  "ok": true\n}', customSchema)
  if (unchanged !== null) throw new Error('schema tab enter should not override non-empty text')

  const notSchemaTab = computeSchemaTabEnterText('data', '', customSchema)
  if (notSchemaTab !== null) throw new Error('non-schema tab enter should return null')

  const computed = computeSchemaTabEnterText('schema', '', customSchema)
  if (!computed) throw new Error('schema tab enter should return schema json')
  const parsed = JSON.parse(computed) as typeof defaultSchema
  if (parsed.nodeStyles.Investor?.color !== '#ff2600') throw new Error('schema tab enter did not use provided schema')
}

export const testRendererPaletteReusesSharedMetadataAndObjectReaders = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'schema.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected schema renderer palette helper to reuse the shared document metadata reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected schema renderer palette helper to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const meta = toMetadataRecord(schema?.metadata)')) {
    throw new Error('expected schema renderer palette helper to reuse the shared document metadata reader')
  }
  if (!text.includes('if (isPlainObject(raw)) {')) {
    throw new Error('expected schema renderer palette helper to reuse the shared plain-object guard')
  }
  if (text.includes("schema && schema.metadata && typeof schema.metadata === 'object' && !Array.isArray(schema.metadata)")) {
    throw new Error('expected schema renderer palette helper to stop coercing schema metadata inline')
  }

  const palette = getRendererPalette({
    ...defaultSchema,
    metadata: {
      'renderer:palette': {
        nodes: { idea: '#111111' },
        edges: { critical: '#222222' },
      },
    },
  })
  if (palette.nodes.idea !== '#111111') throw new Error('expected renderer palette helper to honor custom node palette metadata')
  if (palette.edges.critical !== '#222222') throw new Error('expected renderer palette helper to honor custom edge palette metadata')
  if (palette.nodes.hypothesis !== MVP_COLOR_PALETTE.nodes.hypothesis) {
    throw new Error('expected renderer palette helper to preserve default node palette entries')
  }
}

export const testSchemaPersistenceWrites = () => {
  if (LS_KEYS.graphSchema !== 'kg:schema') throw new Error('graphSchema key mismatch')
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })

  const customSchema = validateSchema({
    ...defaultSchema,
    nodeStyles: { ...defaultSchema.nodeStyles, Investor: { color: '#ff2600' } },
  })
  const persistedCustom = canonicalizeSchemaForPersistence(customSchema)
  storage.setItem(LS_KEYS.graphSchema, JSON.stringify(persistedCustom))

  const raw = storage.getItem(LS_KEYS.graphSchema)
  if (!raw) throw new Error('schema not written to storage')
  const parsed = readSchemaFromStorage(storage)
  if (!parsed) throw new Error('schema not readable from storage')
  if (parsed.nodeStyles.Investor?.color !== '#ff2600') throw new Error('stored schema mismatch')

  const modified = validateSchema({
    ...customSchema,
    catalog: {
      ...(customSchema.catalog || {}),
      nodeTypes: [...(customSchema.catalog?.nodeTypes || []), 'SchemaPersistTestType'],
      edgeLabels: customSchema.catalog?.edgeLabels || [],
    },
  })
  const persistedModified = canonicalizeSchemaForPersistence(modified)
  storage.setItem(LS_KEYS.graphSchema, JSON.stringify(persistedModified))
  const parsed2 = readSchemaFromStorage(storage)
  if (!parsed2) throw new Error('schema not readable after mutation')
  const nodeTypes = parsed2.catalog?.nodeTypes || []
  if (!nodeTypes.includes('SchemaPersistTestType')) throw new Error('schema mutation not persisted')

  restore()
}

export const testResetImportSchemaTabTextSync = () => {
  const store = useGraphStore.getState()
  store.resetAll()

  const imported = validateSchema({
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, selectMode: 'multi' },
  })
  store.setSchema(imported)

  const currentSchema = useGraphStore.getState().schema
  const text = computeSchemaTabEnterText('schema', '', currentSchema)
  if (!text) throw new Error('schema tab enter text missing after reset+import')
  const parsed = JSON.parse(text) as typeof defaultSchema
  if (parsed.behavior?.selectMode !== imported.behavior?.selectMode) {
    throw new Error('schema tab text does not reflect imported behavior')
  }
}

export const testResetImportSchemaTabApplyModifiedSync = () => {
  const store = useGraphStore.getState()
  store.resetAll()

  const imported = validateSchema({
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, selectMode: 'multi' },
  })
  store.setSchema(imported)

  const modified = validateSchema({
    ...imported,
    behavior: { ...imported.behavior, createMode: 'panel-only' },
  })
  store.setSchema(modified)

  const currentSchema = useGraphStore.getState().schema
  const text = computeSchemaTabEnterText('schema', '', currentSchema)
  if (!text) throw new Error('schema tab enter text missing after reset+import+apply')
  const parsed = JSON.parse(text) as typeof defaultSchema
  if (parsed.behavior?.selectMode !== modified.behavior?.selectMode) {
    throw new Error('schema tab text does not reflect modified selectMode')
  }
  if (parsed.behavior?.createMode !== modified.behavior?.createMode) {
    throw new Error('schema tab text does not reflect modified createMode')
  }
}

export const testSchemaUiApplyUsesLatestStoreSchema = () => {
  const store = useGraphStore.getState()
  store.resetAll()

  const stale = useGraphStore.getState().schema

  const imported = validateSchema({
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, selectMode: 'multi' },
  })
  store.setSchema(imported)

  const base = getSchemaBaseForUiApply(stale)
  if (base.behavior?.selectMode !== imported.behavior?.selectMode) {
    throw new Error('schema ui apply base schema is stale')
  }
}

export const testSchemaUiApplyRegistrationGuardsAgainstImportRace = () => {
  const store = useGraphStore.getState()
  store.resetAll()

  const before = validateSchema({
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, createMode: 'panel-only' },
  })
  store.setSchema(before)

  const imported = validateSchema({
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, selectMode: 'multi' },
  })

  const beforeHash = JSON.stringify(before)
  const importedHash = JSON.stringify(imported)

  const reg: SchemaUiApplyRegistration = {
    schemaHash: beforeHash,
    apply: () => store.setSchema(before),
  }

  if (canUseSchemaUiApplyRegistration(reg, importedHash)) {
    throw new Error('ui apply registration should be rejected when schema hash differs')
  }

  if (!canUseSchemaUiApplyRegistration(reg, beforeHash)) {
    throw new Error('ui apply registration should be accepted when schema hash matches')
  }
}

export const testCanonicalSchemaStringifyIgnoresOrderingAndDefaultExpansionDrift = () => {
  const a = validateSchema({
    catalog: { nodeTypes: ['B', 'A'], edgeLabels: ['z', 'a'] },
    validation: {
      node: {
        Entity: {
          required: ['name', 'id'],
          uniqueness: ['id', 'name'],
        },
      },
    },
  })
  const b = validateSchema({
    catalog: { nodeTypes: ['A', 'B'], edgeLabels: ['a', 'z'] },
    validation: {
      node: {
        Entity: {
          required: ['id', 'name'],
          uniqueness: ['name', 'id'],
        },
      },
    },
    labelStyles: { ...defaultSchema.labelStyles, color: '#111111', halo: { ...(defaultSchema.labelStyles?.halo || {}), color: '#ffffff' } },
  })

  const sigA = stringifyCanonicalSchema(a)
  const sigB = stringifyCanonicalSchema(b)
  if (sigA !== sigB) {
    throw new Error('canonical schema stringify should ignore non-semantic ordering and default-only persistence drift')
  }
}

export const testSchemaJsonLdExportCanonicalizesOrdering = () => {
  const schema = validateSchema({
    ...defaultSchema,
    nodeStyles: {},
    edgeStyles: {},
    metadata: {},
    nodeShapes: {},
    catalog: { nodeTypes: ['Zoo', 'Alpha'], edgeLabels: ['zzz', 'aaa'] },
    propertySchemas: {
      node: {
        Zoo: {
          title: { type: 'string' },
          age: { type: 'number' },
        },
        Alpha: {
          zeta: { type: 'boolean' },
          alpha: { type: 'string' },
        },
      },
      edge: {
        zzz: {
          weight: { type: 'number' },
          alpha: { type: 'string' },
        },
      },
    },
    labelStyles: { ...defaultSchema.labelStyles, color: '#111111', halo: { ...(defaultSchema.labelStyles?.halo || {}), color: '#ffffff' } },
  })

  const exported = schemaToJsonLd(schema)
  const names = Array.isArray(exported['@graph']) ? exported['@graph'].map(entry => String(entry.name || '')) : []
  const expected = ['Alpha', 'Chunk', 'EmbeddingMeta', 'Entity', 'Image', 'Object', 'Subject', 'Zoo', 'aaa', 'pointsTo', 'relatedTo', 'zzz', 'alpha', 'zeta', 'age', 'title', 'alpha', 'weight']
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`schema JSON-LD export ordering drifted: ${JSON.stringify(names)}`)
  }
  const contextKeys = Object.keys(exported['@context'] || {})
  if (JSON.stringify(contextKeys) !== JSON.stringify(['kg'])) {
    throw new Error(`schema JSON-LD export should keep only canonical context keys in this minimal case: ${JSON.stringify(contextKeys)}`)
  }
}

export const testSchemaJsonLdImportIgnoresGraphEntryOrdering = () => {
  const imported = schemaFromJsonLd({
    '@context': { kg: 'http://example.org/kg#' },
    '@graph': [
      { '@id': 'kg:prop/weight', '@type': 'kg:Property', name: 'weight', owner: 'relatedTo', range: 'number' },
      { '@id': 'kg:prop/name', '@type': 'kg:Property', name: 'name', owner: 'Entity', range: 'string' },
      { '@id': 'kg:relatedTo', '@type': 'kg:EdgeLabel', name: 'relatedTo' },
      { '@id': 'kg:Entity', '@type': 'kg:NodeType', name: 'Entity' },
    ],
  })

  const nodeTypes = imported.catalog?.nodeTypes || []
  const edgeLabels = imported.catalog?.edgeLabels || []
  if (!nodeTypes.includes('Entity')) {
    throw new Error(`schema JSON-LD import should sort node types canonically: ${JSON.stringify(nodeTypes)}`)
  }
  if (!edgeLabels.includes('relatedTo')) {
    throw new Error(`schema JSON-LD import should sort edge labels canonically: ${JSON.stringify(edgeLabels)}`)
  }
  if (JSON.stringify([...nodeTypes].sort((a, b) => a.localeCompare(b))) !== JSON.stringify(nodeTypes)) {
    throw new Error(`schema JSON-LD import node types should remain canonically sorted: ${JSON.stringify(nodeTypes)}`)
  }
  if (JSON.stringify([...edgeLabels].sort((a, b) => a.localeCompare(b))) !== JSON.stringify(edgeLabels)) {
    throw new Error(`schema JSON-LD import edge labels should remain canonically sorted: ${JSON.stringify(edgeLabels)}`)
  }
  if (imported.propertySchemas?.node?.Entity?.name?.type !== 'string') {
    throw new Error('schema JSON-LD import lost node property when property preceded owner entry')
  }
  if (imported.propertySchemas?.edge?.relatedTo?.weight?.type !== 'number') {
    throw new Error('schema JSON-LD import lost edge property when property preceded owner entry')
  }
}

export const testParseSchemaTextRejectsInvalidJson = () => {
  let threw = false
  try {
    parseSchemaText('{')
  } catch {
    threw = true
  }
  if (!threw) throw new Error('parseSchemaText should throw on invalid JSON')
}

export const testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance = () => {
  const schema = validateSchema({
    ...defaultSchema,
    layout: { ...defaultSchema.layout, mode: 'force' },
    three: { ...defaultSchema.three, nodeSizingFormula: 'schema' },
    nodeSizes: {
      ...defaultSchema.nodeSizes,
      Entity: { radius: 13 },
    },
  })

  const withNodeSize = { id: 'n1', type: 'Entity', label: 'A', properties: { 'visual:nodeSize': 22 } }
  const r1 = getRenderNodeRadius2d(withNodeSize, schema)
  if (r1 !== 22) throw new Error(`node sizing should respect visual:nodeSize; got ${r1}`)

  const withImportance = { id: 'n2', type: 'Entity', label: 'B', properties: { 'visual:importance': 100 } }
  const r2 = getRenderNodeRadius2d(withImportance, schema)
  if (r2 < 10 || r2 > 40) throw new Error(`importance sizing should clamp to [10,40]; got ${r2}`)

  const withFallback = { id: 'n3', type: 'Entity', label: 'C', properties: {} }
  const r3 = getRenderNodeRadius2d(withFallback, schema)
  if (r3 !== 13) throw new Error(`node sizing should fall back to schema radius when missing props; got ${r3}`)
}
