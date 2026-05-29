import {
  buildAgenticCommerceSemanticKey,
  type AgenticCommerceEnvLike,
} from '../../../grph-shared/src/payments/agenticCommerceSsot'
import type { D1DatabaseLike } from '../shared/d1'
import {
  asRecord,
  mapSessionRow,
  parseJson,
  readProofForSession,
  readRecordString,
  readSession,
  stableJson,
  updateSessionState,
  writeProof,
  writeTraceEvent,
  type AgenticCommerceRiskSignal,
  type AgenticCommerceSessionRow,
} from './agenticCommercePersistence'
import { ingestOpenboxProof, readOpenboxRiskSignal } from './agenticCommerceIntegrations'

const buildProof = (args: {
  session: AgenticCommerceSessionRow
  riskSignal: AgenticCommerceRiskSignal | null
  completedAt: string
  txHash?: string | null
  attestationUid?: string | null
}) => {
  const proofId = `proof_${buildAgenticCommerceSemanticKey('commerce-proof', [
    args.session.id,
    args.completedAt,
    args.riskSignal?.score ?? '',
    args.riskSignal?.action ?? '',
    args.txHash || '',
    args.attestationUid || '',
  ])}`
  const canvasNode = args.session.payment_rail === 'erc20'
    ? {
        type: '@node:proof',
        session_id: args.session.id,
        tx_hash: args.txHash || null,
        attestation_uid: args.attestationUid || null,
      }
    : null
  return {
    proof_id: proofId,
    session_id: args.session.id,
    status: 'complete',
    payment_rail: args.session.payment_rail,
    amount_total: args.session.amount_total,
    currency: args.session.currency,
    ...(args.riskSignal ? { openbox_risk: args.riskSignal } : {}),
    ...(args.attestationUid ? { attestation_uid: args.attestationUid } : {}),
    ...(canvasNode ? { canvas_node: canvasNode } : {}),
    cost_log: {
      model: 'none',
      prompt_tokens: 0,
      completion_tokens: 0,
      cache_hits: 0,
      estimated_cost_usd: 0,
    },
  }
}

export const settleAgenticCommerceSession = async (
  db: D1DatabaseLike,
  env: AgenticCommerceEnvLike,
  sessionId: string,
  options: { txHash?: string | null; attestationUid?: string | null } = {},
): Promise<{ session: ReturnType<typeof mapSessionRow>; proof: unknown } | null> => {
  const session = await readSession(db, sessionId)
  if (!session) return null
  const existingProof = await readProofForSession(db, sessionId)
  if (session.status === 'complete' && existingProof) {
    return { session: mapSessionRow(session), proof: parseJson(existingProof.proof_json, null) }
  }

  const completedAt = session.completed_at || new Date().toISOString()
  const riskSignal = await readOpenboxRiskSignal(env, session)
  const riskSignals = riskSignal ? [riskSignal] : []
  const completedSession: AgenticCommerceSessionRow = {
    ...session,
    status: 'complete',
    updated_at: completedAt,
    completed_at: completedAt,
    risk_signals_json: stableJson(riskSignals),
  }
  const proof = buildProof({
    session: completedSession,
    riskSignal,
    completedAt,
    txHash: options.txHash || null,
    attestationUid: options.attestationUid || null,
  })
  await updateSessionState(db, {
    id: session.id,
    status: 'complete',
    responseJson: stableJson(mapSessionRow(completedSession)),
    riskSignalsJson: stableJson(riskSignals),
    updatedAt: completedAt,
    completedAt,
  })
  await writeProof(db, {
    id: proof.proof_id,
    sessionId: session.id,
    proofJson: stableJson(proof),
    createdAt: completedAt,
  })
  await writeTraceEvent(db, {
    sessionId: session.id,
    eventType: 'knowgrph.commerce.settle',
    payload: {
      tool: 'knowgrph.commerce.settle',
      session_id: session.id,
      proof_id: proof.proof_id,
      risk_signal_source: riskSignal?.source || null,
    },
    createdAt: completedAt,
  })
  const ingestResult = await ingestOpenboxProof(env, proof)
  if (ingestResult) {
    await writeTraceEvent(db, {
      sessionId: session.id,
      eventType: 'knowgrph.commerce.openbox_ingest',
      payload: {
        tool: 'knowgrph.commerce.openbox_ingest',
        session_id: session.id,
        proof_id: proof.proof_id,
        ok: ingestResult.ok,
        status: ingestResult.status,
        error: ingestResult.ok ? null : ingestResult.error,
      },
      createdAt: completedAt,
    })
  }
  const updated = await readSession(db, session.id)
  return {
    session: updated ? mapSessionRow(updated) : mapSessionRow(completedSession),
    proof,
  }
}

export const settleAgenticCommerceSessionFromStripeSession = async (
  db: D1DatabaseLike,
  env: AgenticCommerceEnvLike,
  stripeSession: Record<string, unknown>,
): Promise<void> => {
  const metadata = asRecord(stripeSession.metadata)
  const sessionId = metadata ? readRecordString(metadata, 'acp_session_id') : ''
  if (sessionId) await settleAgenticCommerceSession(db, env, sessionId)
}
