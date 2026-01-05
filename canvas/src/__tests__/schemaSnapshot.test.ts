import assert from 'node:assert/strict'
import { applySchemaUiSnapshotIfNeeded } from '@/features/schema-editor/utils'

type SchemaUiApplyRegistration = {
  apply: () => void
  schemaHash: string
}

type SchemaEditorSnapshotsModule = {
  getSchemaUiApplyRegistrationSnapshot: () => SchemaUiApplyRegistration | null
  isSchemaUiEditorOpenSnapshot: () => boolean
  canUseSchemaUiApplyRegistration: (reg: SchemaUiApplyRegistration | null, currentSchemaHash: string) => boolean
}

type GraphStoreModule = {
  useGraphStore: {
    getState: () => { schema: unknown }
  }
}

const mockSnapshotsModule: SchemaEditorSnapshotsModule = {
  getSchemaUiApplyRegistrationSnapshot: () => null,
  isSchemaUiEditorOpenSnapshot: () => false,
  canUseSchemaUiApplyRegistration: () => false,
}

const mockGraphStoreModule: GraphStoreModule = {
  useGraphStore: {
    getState: () => ({ schema: null }),
  },
}

let lastApplyCalls = 0
let lastCanUseArgs: { reg: SchemaUiApplyRegistration | null; hash: string } | null = null

function installMocks() {
  const anyGlobal = globalThis as unknown as {
    __kgTestMocks__?: {
      schemaEditorSnapshots?: SchemaEditorSnapshotsModule
      graphStore?: GraphStoreModule
    }
  }

  if (!anyGlobal.__kgTestMocks__) {
    anyGlobal.__kgTestMocks__ = {}
  }

  anyGlobal.__kgTestMocks__.schemaEditorSnapshots = mockSnapshotsModule
  anyGlobal.__kgTestMocks__.graphStore = mockGraphStoreModule
}

export function testApplySchemaUiSnapshotSkipsWhenEditorClosed() {
  lastApplyCalls = 0
  lastCanUseArgs = null

  mockSnapshotsModule.getSchemaUiApplyRegistrationSnapshot = () => ({
    apply: () => {
      lastApplyCalls += 1
    },
    schemaHash: 'hash-1',
  })
  mockSnapshotsModule.isSchemaUiEditorOpenSnapshot = () => false
  mockSnapshotsModule.canUseSchemaUiApplyRegistration = () => true

  mockGraphStoreModule.useGraphStore.getState = () => ({ schema: { foo: 'bar' } })

  installMocks()

  applySchemaUiSnapshotIfNeeded()

  assert.equal(lastApplyCalls, 0)
  assert.equal(lastCanUseArgs, null)
}

export function testApplySchemaUiSnapshotCallsApplyWhenHashMatches() {
  lastApplyCalls = 0
  lastCanUseArgs = null

  const reg: SchemaUiApplyRegistration = {
    apply: () => {
      lastApplyCalls += 1
    },
    schemaHash: 'hash-1',
  }

  mockSnapshotsModule.getSchemaUiApplyRegistrationSnapshot = () => reg
  mockSnapshotsModule.isSchemaUiEditorOpenSnapshot = () => true
  mockSnapshotsModule.canUseSchemaUiApplyRegistration = (givenReg, hash) => {
    lastCanUseArgs = { reg: givenReg, hash }
    return true
  }

  mockGraphStoreModule.useGraphStore.getState = () => ({ schema: { foo: 'bar' } })

  installMocks()

  applySchemaUiSnapshotIfNeeded()

  assert.equal(lastApplyCalls, 1)
  if (!lastCanUseArgs) {
    throw new Error('lastCanUseArgs should be set when canUseSchemaUiApplyRegistration is called')
  }
  const args = lastCanUseArgs as { reg: SchemaUiApplyRegistration | null; hash: string }
  assert.strictEqual(args.reg, reg)
  assert.ok(typeof args.hash === 'string')
  assert.ok(args.hash.length > 0)
}
