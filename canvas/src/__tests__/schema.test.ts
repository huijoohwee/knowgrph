import { defaultSchema } from '@/lib/graph/schema'
import { validateSchema } from '@/features/schema/validation'
import { parseSchemaText } from '@/features/schema/io'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeSchemaTabEnterText } from '@/features/schema-editor/useSchemaTab'
import { LS_KEYS } from '@/lib/config'
import { readSchemaFromStorage } from '@/hooks/store/schemaSlice'
import { getSchemaBaseForUiApply } from '@/features/schema/ui/utils'
import { canUseSchemaUiApplyRegistration, type SchemaUiApplyRegistration } from '@/features/schema-editor/useBottomPanelSchema'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { clampCollisionRadius } from '@/features/panels/utils/orchestratorTraversal'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'

export const testValidateSchemaFillsDefaults = () => {
  const s = validateSchema({})
  if (!s.labelStyles || s.labelStyles.fontSize !== defaultSchema.labelStyles!.fontSize) throw new Error('fontSize default missing')
  if (!s.layout || !s.layout.forces || typeof s.layout.forces.charge !== 'number') throw new Error('layout defaults missing')
  if (!s.layout || s.layout.mode !== 'force') throw new Error('layout mode default missing')
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

export const testSchemaPersistenceWrites = () => {
  if (LS_KEYS.graphSchema !== 'kg:schema') throw new Error('graphSchema key mismatch')
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })

  const store = useGraphStore.getState()
  store.resetAll()

  const customSchema = validateSchema({
    ...defaultSchema,
    nodeStyles: { ...defaultSchema.nodeStyles, Investor: { color: '#ff2600' } },
  })
  store.setSchema(customSchema)

  const raw = storage.getItem(LS_KEYS.graphSchema)
  if (!raw) throw new Error('schema not written to storage')
  const parsed = readSchemaFromStorage(storage)
  if (!parsed) throw new Error('schema not readable from storage')
  if (parsed.nodeStyles.Investor?.color !== '#ff2600') throw new Error('stored schema mismatch')

  store.addNodeType('SchemaPersistTestType')
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
    layers: { mode: 'semantic' },
    three: { ...defaultSchema.three, nodeSizingFormula: 'schema' },
    nodeSizes: {
      ...defaultSchema.nodeSizes,
      Entity: { radius: 13 },
    },
  })

  const withNodeSize = { id: 'n1', type: 'Entity', label: 'A', properties: { 'visual:nodeSize': 22 } }
  const r1 = getRenderNodeRadius2d(withNodeSize, schema)
  if (r1 !== 22) throw new Error(`semantic mode should respect visual:nodeSize; got ${r1}`)

  const withImportance = { id: 'n2', type: 'Entity', label: 'B', properties: { 'visual:importance': 100 } }
  const r2 = getRenderNodeRadius2d(withImportance, schema)
  if (r2 < 10 || r2 > 40) throw new Error(`semantic mode importance should clamp to [10,40]; got ${r2}`)

  const withFallback = { id: 'n3', type: 'Entity', label: 'C', properties: {} }
  const r3 = getRenderNodeRadius2d(withFallback, schema)
  if (r3 !== 13) throw new Error(`semantic mode should fall back to schema radius when missing props; got ${r3}`)
}
