import {
  createPersistedCollectionDb,
  type PersistedCollectionChangeEvent,
} from '@/lib/storage/persistedCollectionStore'

type KeyedRecord = {
  pk: string
  value: string
}

type KeyedRecordMap = {
  rows: KeyedRecord
}

export async function testPersistedCollectionStoreSupportsCustomKeysAndChangeEvents() {
  const db = createPersistedCollectionDb<KeyedRecordMap>({
    storageKey: 'kg:test:persisted-collection-change-events',
    persistent: false,
    collectionNames: ['rows'],
    recordKeyByCollection: {
      rows: row => String(row.pk || '').trim(),
    },
  })

  const events: Array<PersistedCollectionChangeEvent<KeyedRecord>> = []
  const subscription = db.collections.rows.$.subscribe(event => {
    events.push(event)
  })

  try {
    await db.collections.rows.incrementalUpsert({ pk: 'row-1', value: 'alpha' })
    const inserted = await db.collections.rows.findOne('row-1').exec()
    if (!inserted) {
      throw new Error('expected custom-keyed row to be readable by its resolved key after insert')
    }
    if (inserted.get('value') !== 'alpha') {
      throw new Error('expected inserted custom-keyed row to retain its stored value')
    }

    await inserted.incrementalPatch({ value: 'beta' })
    const listed = await db.collections.rows.find().exec()
    if (listed.length !== 1 || listed[0]?.get('value') !== 'beta') {
      throw new Error('expected find().exec() to rebuild row handles from the resolved custom key')
    }

    await listed[0]!.remove()
    const afterDelete = await db.collections.rows.findOne('row-1').exec()
    if (afterDelete) {
      throw new Error('expected custom-keyed row removal to delete the resolved record key')
    }

    const operations = events.map(event => event.operation).join(',')
    if (operations !== 'INSERT,UPDATE,DELETE') {
      throw new Error(`expected INSERT,UPDATE,DELETE change events for custom-keyed rows, got ${operations || 'none'}`)
    }
    const eventIds = events.map(event => event.documentId).join(',')
    if (eventIds !== 'row-1,row-1,row-1') {
      throw new Error(`expected change events to preserve the resolved document key, got ${eventIds || 'none'}`)
    }
  } finally {
    subscription.unsubscribe()
    await db.db.remove()
  }
}
