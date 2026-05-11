type FakeRow = Record<string, unknown>

export class FakeKnowgrphStorageD1Database {
  workspaces = new Map<string, FakeRow>()
  documents = new Map<string, FakeRow>()
  documentChunks = new Map<string, FakeRow>()
  graphSnapshots = new Map<string, FakeRow>()
  syncDevices = new Map<string, FakeRow>()
  syncEvents = new Map<string, FakeRow>()

  prepare(sql: string) {
    const db = this
    let boundValues: unknown[] = []
    return {
      bind(...values: unknown[]) {
        boundValues = values
        return this
      },
      async run() {
        db.applyMutation(sql, boundValues)
        return { success: true }
      },
      async all<T = FakeRow>() {
        return { results: db.readRows(sql, boundValues) as T[] }
      },
    }
  }

  private applyMutation(sql: string, values: unknown[]) {
    if (sql.includes('INSERT INTO workspaces')) {
      const [id, slug, title, createdAt, updatedAt] = values
      this.workspaces.set(String(id), { id, slug, title, visibility: 'private', created_at: createdAt, updated_at: updatedAt })
      return
    }
    if (sql.includes('INSERT INTO sync_devices')) {
      const [id, workspaceId, deviceLabel, updatedAt] = values
      const existing = this.syncDevices.get(String(id)) || {}
      this.syncDevices.set(String(id), {
        ...existing,
        id,
        workspace_id: workspaceId,
        device_label: deviceLabel,
        last_pull_cursor: existing.last_pull_cursor ?? null,
        last_push_cursor: existing.last_push_cursor ?? null,
        updated_at: updatedAt,
      })
      return
    }
    if (sql.includes('INSERT INTO sync_events')) {
      const [id, workspaceId, deviceId, eventType, payloadJson, createdAt] = values
      this.syncEvents.set(String(id), {
        id,
        workspace_id: workspaceId,
        device_id: deviceId,
        event_type: eventType,
        payload_json: payloadJson,
        created_at: createdAt,
      })
      return
    }
    if (sql.includes('INSERT INTO documents')) {
      const [
        id,
        workspaceId,
        canonicalPath,
        title,
        docType,
        lang,
        graphId,
        sourceKind,
        contentMd,
        contentHash,
        parserVersion,
        revision,
        deleted,
        createdAt,
        updatedAt,
      ] = values
      this.documents.set(String(id), {
        id,
        workspace_id: workspaceId,
        canonical_path: canonicalPath,
        title,
        doc_type: docType,
        lang,
        graph_id: graphId,
        source_kind: sourceKind,
        content_md: contentMd,
        content_hash: contentHash,
        parser_version: parserVersion,
        revision,
        deleted,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      return
    }
    if (sql.includes('INSERT INTO document_chunks')) {
      const [id, documentId, workspaceId, chunkKey, chunkOrder, heading, markdown, tokenEstimate, contentHash, updatedAt] = values
      this.documentChunks.set(String(id), {
        id,
        document_id: documentId,
        workspace_id: workspaceId,
        chunk_key: chunkKey,
        chunk_order: chunkOrder,
        heading,
        markdown,
        token_estimate: tokenEstimate,
        content_hash: contentHash,
        updated_at: updatedAt,
      })
      return
    }
    if (sql.includes('DELETE FROM document_chunks')) {
      this.documentChunks.delete(String(values[0]))
      return
    }
    if (sql.includes('INSERT INTO graph_snapshots')) {
      const [id, documentId, workspaceId, graphRevision, graphHash, graphJson, layoutJson, derivedFromDocumentRevision, updatedAt] = values
      this.graphSnapshots.set(String(id), {
        id,
        document_id: documentId,
        workspace_id: workspaceId,
        graph_revision: graphRevision,
        graph_hash: graphHash,
        graph_json: graphJson,
        layout_json: layoutJson,
        derived_from_document_revision: derivedFromDocumentRevision,
        updated_at: updatedAt,
      })
      return
    }
    if (sql.includes('DELETE FROM graph_snapshots')) {
      this.graphSnapshots.delete(String(values[0]))
      return
    }
    if (sql.includes('UPDATE sync_devices SET last_push_cursor')) {
      const [cursor, updatedAt, id] = values
      const existing = this.syncDevices.get(String(id))
      if (existing) this.syncDevices.set(String(id), { ...existing, last_push_cursor: cursor, updated_at: updatedAt })
      return
    }
    if (sql.includes('UPDATE sync_devices SET last_pull_cursor')) {
      const [cursor, updatedAt, id] = values
      const existing = this.syncDevices.get(String(id))
      if (existing) this.syncDevices.set(String(id), { ...existing, last_pull_cursor: cursor, updated_at: updatedAt })
    }
  }

  private readRows(sql: string, values: unknown[]): FakeRow[] {
    if (sql.includes('SELECT id, content_md FROM documents WHERE workspace_id = ? AND canonical_path = ? AND deleted = 0')) {
      const [workspaceId, canonicalPath] = values
      const rows = Array.from(this.documents.values()).filter(
        row =>
          row.workspace_id === workspaceId
          && row.canonical_path === canonicalPath
          && Number(row.deleted || 0) === 0,
      )
      return rows.slice(0, 1).map(row => ({ id: row.id, content_md: row.content_md }))
    }
    if (sql.includes('SELECT id, chunk_order, markdown') && sql.includes('FROM document_chunks')) {
      const [workspaceId, documentId] = values
      return Array.from(this.documentChunks.values())
        .filter(row => row.workspace_id === workspaceId && row.document_id === documentId)
        .sort((a, b) => {
          const orderDelta = Number(a.chunk_order || 0) - Number(b.chunk_order || 0)
          if (orderDelta !== 0) return orderDelta
          return String(a.id || '').localeCompare(String(b.id || ''))
        })
        .map(row => ({ id: row.id, chunk_order: row.chunk_order, markdown: row.markdown }))
    }
    if (sql.includes('SELECT revision FROM documents')) {
      const [id, workspaceId] = values
      const row = this.documents.get(String(id))
      if (!row || row.workspace_id !== workspaceId) return []
      return [{ revision: row.revision }]
    }
    if (sql.includes('SELECT MAX(graph_revision) AS graph_revision FROM graph_snapshots')) {
      const [documentId, workspaceId] = values
      const rows = Array.from(this.graphSnapshots.values()).filter(
        row => row.document_id === documentId && row.workspace_id === workspaceId,
      )
      const max = rows.reduce((acc, row) => Math.max(acc, Number(row.graph_revision || 0)), 0)
      return rows.length > 0 ? [{ graph_revision: max }] : []
    }
    if (sql.includes('SELECT * FROM documents')) {
      return this.filterByWorkspaceAndSince(this.documents, values)
    }
    if (sql.includes('SELECT * FROM document_chunks')) {
      return this.filterByWorkspaceAndSince(this.documentChunks, values)
    }
    if (sql.includes('SELECT * FROM graph_snapshots')) {
      return this.filterByWorkspaceAndSince(this.graphSnapshots, values)
    }
    return []
  }

  private filterByWorkspaceAndSince(source: Map<string, FakeRow>, values: unknown[]): FakeRow[] {
    const workspaceId = values[0]
    const since = typeof values[1] === 'string' ? values[1] : null
    return Array.from(source.values())
      .filter(row => row.workspace_id === workspaceId)
      .filter(row => (since ? String(row.updated_at || '') > since : true))
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
  }
}

export const createFakeKnowgrphStorageWorkerEnv = () => ({
  DB: new FakeKnowgrphStorageD1Database(),
})
