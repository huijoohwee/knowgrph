type FakeRow = Record<string, unknown>

const normalizeSql = (sql: string): string =>
  String(sql || '')
    .toLowerCase()
    .replace(/["`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const readSelectedColumns = (sql: string): string[] => {
  const normalizedSql = normalizeSql(sql)
  const selectPrefix = 'select '
  const fromIndex = normalizedSql.indexOf(' from ')
  if (!normalizedSql.startsWith(selectPrefix) || fromIndex <= selectPrefix.length) return []
  const selectClause = normalizedSql.slice(selectPrefix.length, fromIndex)
  if (selectClause.trim() === '*') return []
  return selectClause
    .split(',')
    .map(part => part.trim())
    .map(part => {
      const aliasMatch = /\s+as\s+([a-z0-9_]+)/.exec(part)
      if (aliasMatch?.[1]) return aliasMatch[1]
      const pieces = part.split('.')
      return pieces[pieces.length - 1] || part
    })
    .filter(Boolean)
}

export class FakeKnowgrphStorageD1Database {
  workspaces = new Map<string, FakeRow>()
  documents = new Map<string, FakeRow>()
  documentChunks = new Map<string, FakeRow>()
  graphSnapshots = new Map<string, FakeRow>()
  syncDevices = new Map<string, FakeRow>()
  syncEvents = new Map<string, FakeRow>()
  stripeCheckoutSessions = new Map<string, FakeRow>()
  stripeWebhookEvents = new Map<string, FakeRow>()
  agenticCommerceSessions = new Map<string, FakeRow>()
  agenticCommerceProofs = new Map<string, FakeRow>()
  agenticCommerceTraceEvents = new Map<string, FakeRow>()

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
      async raw<T = unknown[]>() {
        return db.readRawRows(sql, boundValues) as T[]
      },
    }
  }

  private applyMutation(sql: string, values: unknown[]) {
    const normalizedSql = normalizeSql(sql)
    if (normalizedSql.includes('insert into workspaces')) {
      const [id, slug, title, createdAt, updatedAt] = values
      this.workspaces.set(String(id), { id, slug, title, visibility: 'private', created_at: createdAt, updated_at: updatedAt })
      return
    }
    if (normalizedSql.includes('insert into sync_devices')) {
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
    if (normalizedSql.includes('insert into sync_events')) {
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
    if (normalizedSql.includes('delete from sync_events where created_at < ?')) {
      const cutoff = String(values[0] || '')
      for (const [id, row] of this.syncEvents.entries()) {
        if (String(row.created_at || '') < cutoff) this.syncEvents.delete(id)
      }
      return
    }
    if (normalizedSql.includes('insert into documents')) {
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
    if (normalizedSql.includes('insert into document_chunks')) {
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
    if (normalizedSql.includes('delete from document_chunks')) {
      this.documentChunks.delete(String(values[0]))
      return
    }
    if (normalizedSql.includes('insert into graph_snapshots')) {
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
    if (normalizedSql.includes('insert into stripe_checkout_sessions')) {
      const [
        id,
        workspaceId,
        status,
        paymentStatus,
        mode,
        amountTotal,
        currency,
        customerId,
        customerEmail,
        url,
        metadataJson,
        createdAt,
        updatedAt,
        completedAt,
      ] = values
      const existing = this.stripeCheckoutSessions.get(String(id)) || {}
      this.stripeCheckoutSessions.set(String(id), {
        ...existing,
        id,
        workspace_id: workspaceId,
        status,
        payment_status: paymentStatus,
        mode,
        amount_total: amountTotal,
        currency,
        customer_id: customerId,
        customer_email: customerEmail,
        url: url || existing.url || null,
        metadata_json: metadataJson,
        created_at: existing.created_at || createdAt,
        updated_at: updatedAt,
        completed_at: completedAt || existing.completed_at || null,
      })
      return
    }
    if (normalizedSql.includes('insert into stripe_webhook_events')) {
      const [id, eventType, livemode, payloadHash, receivedAt, processedAt] = values
      this.stripeWebhookEvents.set(String(id), {
        id,
        event_type: eventType,
        livemode,
        payload_hash: payloadHash,
        received_at: receivedAt,
        processed_at: processedAt,
      })
      return
    }
    if (normalizedSql.includes('insert into agentic_commerce_sessions')) {
      const [
        id,
        sellerId,
        idempotencyKey,
        payloadHash,
        status,
        paymentRail,
        amountTotal,
        currency,
        payerDid,
        depositAddress,
        requestJson,
        responseJson,
        riskSignalsJson,
        createdAt,
        updatedAt,
        completedAt,
        cancelledAt,
      ] = values
      const existing = this.agenticCommerceSessions.get(String(id)) || {}
      this.agenticCommerceSessions.set(String(id), {
        ...existing,
        id,
        seller_id: sellerId,
        idempotency_key: idempotencyKey,
        payload_hash: payloadHash,
        status,
        payment_rail: paymentRail,
        amount_total: amountTotal,
        currency,
        payer_did: payerDid,
        deposit_address: depositAddress,
        request_json: existing.request_json || requestJson,
        response_json: responseJson,
        risk_signals_json: riskSignalsJson,
        created_at: existing.created_at || createdAt,
        updated_at: updatedAt,
        completed_at: completedAt || existing.completed_at || null,
        cancelled_at: cancelledAt || existing.cancelled_at || null,
      })
      return
    }
    if (normalizedSql.includes('update agentic_commerce_sessions')) {
      const [status, responseJson, riskSignalsJson, updatedAt, completedAt, cancelledAt, id] = values
      const existing = this.agenticCommerceSessions.get(String(id))
      if (existing) {
        this.agenticCommerceSessions.set(String(id), {
          ...existing,
          status,
          response_json: responseJson,
          risk_signals_json: riskSignalsJson,
          updated_at: updatedAt,
          completed_at: completedAt || existing.completed_at || null,
          cancelled_at: cancelledAt || existing.cancelled_at || null,
        })
      }
      return
    }
    if (normalizedSql.includes('insert into agentic_commerce_proofs')) {
      const [id, sessionId, proofJson, createdAt] = values
      this.agenticCommerceProofs.set(String(id), {
        id,
        session_id: sessionId,
        proof_json: proofJson,
        created_at: createdAt,
      })
      return
    }
    if (normalizedSql.includes('insert into agentic_commerce_trace_events')) {
      const [id, sessionId, eventType, payloadJson, createdAt] = values
      this.agenticCommerceTraceEvents.set(String(id), {
        id,
        session_id: sessionId,
        event_type: eventType,
        payload_json: payloadJson,
        created_at: createdAt,
      })
      return
    }
    if (normalizedSql.includes('delete from graph_snapshots')) {
      this.graphSnapshots.delete(String(values[0]))
      return
    }
    if (normalizedSql.includes('update sync_devices set last_push_cursor')) {
      const [cursor, updatedAt, id, workspaceId] = values
      const existing = this.syncDevices.get(String(id))
      if (existing && existing.workspace_id === workspaceId) {
        this.syncDevices.set(String(id), { ...existing, last_push_cursor: cursor, updated_at: updatedAt })
      }
      return
    }
    if (normalizedSql.includes('update sync_devices set last_pull_cursor')) {
      const [cursor, updatedAt, id, workspaceId] = values
      const existing = this.syncDevices.get(String(id))
      if (existing && existing.workspace_id === workspaceId) {
        this.syncDevices.set(String(id), { ...existing, last_pull_cursor: cursor, updated_at: updatedAt })
      }
    }
  }

  private readRows(sql: string, values: unknown[]): FakeRow[] {
    const normalizedSql = normalizeSql(sql)
    if (normalizedSql.includes('select id, content_md from documents where documents.workspace_id = ? and documents.canonical_path = ? and documents.deleted = ?')) {
      const [workspaceId, canonicalPath, deleted] = values
      const rows = Array.from(this.documents.values()).filter(
        row =>
          row.workspace_id === workspaceId
          && row.canonical_path === canonicalPath
          && Number(row.deleted || 0) === Number(deleted || 0),
      )
      return rows.slice(0, 1).map(row => ({ id: row.id, content_md: row.content_md }))
    }
    if (normalizedSql.includes('select id, content_md from documents where workspace_id = ? and canonical_path = ? and deleted = 0')) {
      const [workspaceId, canonicalPath] = values
      const rows = Array.from(this.documents.values()).filter(
        row =>
          row.workspace_id === workspaceId
          && row.canonical_path === canonicalPath
          && Number(row.deleted || 0) === 0,
      )
      return rows.slice(0, 1).map(row => ({ id: row.id, content_md: row.content_md }))
    }
    if (normalizedSql.includes('select id, chunk_order, markdown from document_chunks')) {
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
    if (normalizedSql.includes('select id, canonical_path, title, doc_type, content_hash, revision, updated_at') && normalizedSql.includes('from documents')) {
      const [workspaceId] = values
      return Array.from(this.documents.values())
        .filter(row => row.workspace_id === workspaceId && Number(row.deleted || 0) === 0)
        .sort((a, b) => {
          const pathDelta = String(a.canonical_path || '').localeCompare(String(b.canonical_path || ''))
          if (pathDelta !== 0) return pathDelta
          return String(a.id || '').localeCompare(String(b.id || ''))
        })
        .map(row => ({
          id: row.id,
          canonical_path: row.canonical_path,
          title: row.title,
          doc_type: row.doc_type,
          content_hash: row.content_hash,
          revision: row.revision,
          updated_at: row.updated_at,
          content_length: String(row.content_md || '').length,
        }))
    }
    if (normalizedSql.includes('select revision from documents')) {
      const [id, workspaceId] = values
      const row = this.documents.get(String(id))
      if (!row || row.workspace_id !== workspaceId) return []
      return [{ revision: row.revision }]
    }
    if (normalizedSql.includes('select max(graph_revision) as graph_revision from graph_snapshots')) {
      const [documentId, workspaceId] = values
      const rows = Array.from(this.graphSnapshots.values()).filter(
        row => row.document_id === documentId && row.workspace_id === workspaceId,
      )
      const max = rows.reduce((acc, row) => Math.max(acc, Number(row.graph_revision || 0)), 0)
      return rows.length > 0 ? [{ graph_revision: max }] : []
    }
    if (normalizedSql.includes('select id from stripe_webhook_events where id = ?')) {
      const row = this.stripeWebhookEvents.get(String(values[0]))
      return row ? [{ id: row.id }] : []
    }
    if (normalizedSql.includes('select * from stripe_checkout_sessions where id = ?')) {
      const row = this.stripeCheckoutSessions.get(String(values[0]))
      return row ? [row] : []
    }
    if (normalizedSql.includes('select * from agentic_commerce_sessions where id = ?')) {
      const row = this.agenticCommerceSessions.get(String(values[0]))
      return row ? [row] : []
    }
    if (normalizedSql.includes('select * from agentic_commerce_sessions where seller_id = ? and idempotency_key = ?')) {
      const [sellerId, idempotencyKey] = values
      return Array.from(this.agenticCommerceSessions.values())
        .filter(row => row.seller_id === sellerId && row.idempotency_key === idempotencyKey)
        .slice(0, 1)
    }
    if (normalizedSql.includes('select * from agentic_commerce_proofs where session_id = ?')) {
      const [sessionId] = values
      return Array.from(this.agenticCommerceProofs.values())
        .filter(row => row.session_id === sessionId)
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
        .slice(0, 1)
    }
    if (normalizedSql.includes('from documents where documents.workspace_id = ?')) {
      return this.filterByWorkspaceAndSince(this.documents, values)
    }
    if (normalizedSql.includes('select * from documents')) {
      return this.filterByWorkspaceAndSince(this.documents, values)
    }
    if (normalizedSql.includes('from document_chunks where document_chunks.workspace_id = ?')) {
      return this.filterByWorkspaceAndSince(this.documentChunks, values)
    }
    if (normalizedSql.includes('select * from document_chunks')) {
      return this.filterByWorkspaceAndSince(this.documentChunks, values)
    }
    if (normalizedSql.includes('from graph_snapshots where graph_snapshots.workspace_id = ?')) {
      return this.filterByWorkspaceAndSince(this.graphSnapshots, values)
    }
    if (normalizedSql.includes('select * from graph_snapshots')) {
      return this.filterByWorkspaceAndSince(this.graphSnapshots, values)
    }
    return []
  }

  private readRawRows(sql: string, values: unknown[]): unknown[][] {
    const rows = this.readRows(sql, values)
    const columns = readSelectedColumns(sql)
    if (columns.length === 0) return rows.map(row => Object.values(row))
    return rows.map(row => columns.map(column => row[column]))
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
