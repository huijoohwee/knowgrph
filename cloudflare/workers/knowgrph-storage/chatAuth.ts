import {
  KNOWGRPH_STORAGE_API_VERSION,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  type KnowgrphStorageChatAuditEntry,
  type KnowgrphStorageChatAuditResponse,
  type KnowgrphStorageChatPoliciesResponse,
  type KnowgrphStorageChatPolicyRecord,
  type KnowgrphStorageChatRelayRequest,
  type KnowgrphStorageChatRelayResponse,
  type KnowgrphStorageChatRole,
  type KnowgrphStorageChatSessionMembership,
  type KnowgrphStorageChatSessionResponse,
  type KnowgrphStorageErrorResponse,
  type KnowgrphStorageWorkerEnv,
} from './contract'
import {
  type ChatProxyAuditRow,
  type D1DatabaseLike,
  normalizeNullableString,
  normalizeString,
  readActiveAuthSessionByHash,
  readChatProxyAuditRows,
  readWorkspaceMembershipRow,
  readWorkspaceMembershipRowsByUser,
  readWorkspaceProviderPolicyRow,
  readWorkspaceProviderPolicyRows,
  writeChatProxyAuditRow,
} from './db'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-client-request-id,x-knowgrph-session-token',
  'access-control-max-age': '86400',
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  ...CORS_HEADERS,
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const errorResponse = (
  status: number,
  code: KnowgrphStorageErrorResponse['code'],
  error: string,
): Response => json(status, {
  ok: false,
  apiVersion: KNOWGRPH_STORAGE_API_VERSION,
  error,
  code,
} satisfies KnowgrphStorageErrorResponse)

const parseJsonRequestBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

const normalizeIsoToMs = (value: string | null | undefined): number | null => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const buildAuditId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `chat_audit:${crypto.randomUUID()}`
    : `chat_audit:${Date.now()}:${Math.random().toString(16).slice(2)}`

const readAuthorizationBearerToken = (request: Request): string => {
  const authorization = String(request.headers.get('authorization') || '').trim()
  if (/^bearer\s+/i.test(authorization)) return authorization.replace(/^bearer\s+/i, '').trim()
  return String(request.headers.get('x-knowgrph-session-token') || '').trim()
}

const encodeHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')

const hashToken = async (value: string): Promise<string> => {
  const input = normalizeString(value)
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return encodeHex(new Uint8Array(digest))
}

const readWorkspaceSuffix = (pathname: string, prefix: string): string => {
  const suffix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
  return normalizeString(decodeURIComponent(suffix))
}

const readAuditLimit = (request: Request): number => {
  const limit = Number(new URL(request.url).searchParams.get('limit') || '')
  return Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50
}

const hasAuditAccessRole = (role: string): boolean =>
  role === 'owner' || role === 'provider-admin'

const hasRelayAccessRole = (role: string): boolean =>
  role === 'editor' || role === 'owner' || role === 'provider-admin'

const mapPolicyRow = (row: Awaited<ReturnType<typeof readWorkspaceProviderPolicyRows>>[number]): KnowgrphStorageChatPolicyRecord => ({
  workspaceId: row.workspace_id,
  providerId: row.provider_id as KnowgrphStorageChatPolicyRecord['providerId'],
  allowServerManaged: Number(row.allow_server_managed || 0) === 1,
  allowByok: Number(row.allow_byok || 0) === 1,
  monthlyRequestLimit: row.monthly_request_limit == null ? null : Number(row.monthly_request_limit),
  monthlyTokenLimit: row.monthly_token_limit == null ? null : Number(row.monthly_token_limit),
  monthlySpendLimitCents: row.monthly_spend_limit_cents == null ? null : Number(row.monthly_spend_limit_cents),
  defaultModel: normalizeNullableString(row.default_model),
  updatedAtMs: normalizeIsoToMs(row.updated_at),
})

const mapAuditRow = (row: ChatProxyAuditRow): KnowgrphStorageChatAuditEntry => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id,
  membershipId: row.membership_id,
  providerId: row.provider_id,
  authMode: row.auth_mode as KnowgrphStorageChatAuditEntry['authMode'],
  requestId: normalizeNullableString(row.request_id),
  upstreamStatus: row.upstream_status == null ? null : Number(row.upstream_status),
  relayStatus: row.relay_status,
  modelId: normalizeNullableString(row.model_id),
  requestBytes: row.request_bytes == null ? null : Number(row.request_bytes),
  responseBytes: row.response_bytes == null ? null : Number(row.response_bytes),
  latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
  errorCode: normalizeNullableString(row.error_code),
  errorMessage: normalizeNullableString(row.error_message),
  createdAtMs: normalizeIsoToMs(row.created_at),
})

type AuthenticatedChatContext = {
  session: {
    id: string
    userId: string
    expiresAt: string
  }
  user: {
    id: string
    email: string
    displayName: string
    status: string
  }
}

type AuthenticatedChatContextResult =
  | { ok: true; value: AuthenticatedChatContext }
  | { ok: false; response: Response }

type AuthorizedMembershipResult =
  | { ok: true; membership: { id: string; role: KnowgrphStorageChatRole; status: string } }
  | { ok: false; response: Response }

const readAuthenticatedChatContext = async (
  request: Request,
  db: D1DatabaseLike,
): Promise<AuthenticatedChatContextResult> => {
  const token = readAuthorizationBearerToken(request)
  if (!token) return { ok: false, response: errorResponse(401, 'forbidden', 'missing bearer session token') }
  const tokenHash = await hashToken(token)
  const nowIso = new Date().toISOString()
  const session = await readActiveAuthSessionByHash(db, tokenHash, nowIso)
  if (!session) return { ok: false, response: errorResponse(401, 'forbidden', 'invalid or expired session') }
  return {
    ok: true,
    value: {
      session: {
        id: session.id,
        userId: session.user_id,
        expiresAt: session.expires_at,
      },
      user: {
        id: session.user_id,
        email: session.user_email,
        displayName: session.user_display_name,
        status: session.user_status,
      },
    },
  }
}

const readAuthorizedMembership = async (args: {
  db: D1DatabaseLike
  workspaceId: string
  userId: string
}): Promise<AuthorizedMembershipResult> => {
  const membership = await readWorkspaceMembershipRow(args.db, args.workspaceId, args.userId)
  if (!membership) return { ok: false, response: errorResponse(403, 'forbidden', 'workspace membership is required') }
  return {
    ok: true,
    membership: {
      id: membership.id,
      role: membership.role as KnowgrphStorageChatRole,
      status: membership.status,
    },
  }
}

const isAuthenticatedChatContextFailure = (
  value: AuthenticatedChatContextResult,
): value is Extract<AuthenticatedChatContextResult, { ok: false }> =>
  value.ok === false

const isAuthorizedMembershipFailure = (
  value: AuthorizedMembershipResult,
): value is Extract<AuthorizedMembershipResult, { ok: false }> =>
  value.ok === false

export const isKnowgrphStorageChatRoute = (pathname: string): boolean =>
  pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.chatSession
  || pathname === KNOWGRPH_STORAGE_ROUTE_PATHS.chatRelay
  || pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.chatPoliciesPrefix)
  || pathname.startsWith(KNOWGRPH_STORAGE_ROUTE_PATHS.chatAuditPrefix)

export const handleChatSession = async (request: Request, db: D1DatabaseLike): Promise<Response> => {
  const auth = await readAuthenticatedChatContext(request, db)
  if (isAuthenticatedChatContextFailure(auth)) return auth.response
  const memberships = await readWorkspaceMembershipRowsByUser(db, auth.value.user.id)
  const response: KnowgrphStorageChatSessionResponse = {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    user: {
      id: auth.value.user.id,
      email: auth.value.user.email,
      displayName: auth.value.user.displayName,
      status: auth.value.user.status,
    },
    session: {
      id: auth.value.session.id,
      expiresAt: auth.value.session.expiresAt,
    },
    memberships: memberships.map(row => ({
      workspaceId: row.workspace_id,
      role: row.role as KnowgrphStorageChatRole,
      status: row.status,
    } satisfies KnowgrphStorageChatSessionMembership)),
  }
  return json(200, response)
}

export const handleChatPolicies = async (request: Request, db: D1DatabaseLike): Promise<Response> => {
  const workspaceId = readWorkspaceSuffix(new URL(request.url).pathname, KNOWGRPH_STORAGE_ROUTE_PATHS.chatPoliciesPrefix)
  if (!workspaceId) return errorResponse(400, 'bad_request', 'workspaceId is required')
  const auth = await readAuthenticatedChatContext(request, db)
  if (isAuthenticatedChatContextFailure(auth)) return auth.response
  const membership = await readAuthorizedMembership({ db, workspaceId, userId: auth.value.user.id })
  if (isAuthorizedMembershipFailure(membership)) return membership.response
  const policies = await readWorkspaceProviderPolicyRows(db, workspaceId)
  const response: KnowgrphStorageChatPoliciesResponse = {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    workspaceId,
    membership: {
      userId: auth.value.user.id,
      role: membership.membership.role,
      status: membership.membership.status,
    },
    policies: policies.map(mapPolicyRow),
  }
  return json(200, response)
}

export const handleChatAudit = async (request: Request, db: D1DatabaseLike): Promise<Response> => {
  const workspaceId = readWorkspaceSuffix(new URL(request.url).pathname, KNOWGRPH_STORAGE_ROUTE_PATHS.chatAuditPrefix)
  if (!workspaceId) return errorResponse(400, 'bad_request', 'workspaceId is required')
  const auth = await readAuthenticatedChatContext(request, db)
  if (isAuthenticatedChatContextFailure(auth)) return auth.response
  const membership = await readAuthorizedMembership({ db, workspaceId, userId: auth.value.user.id })
  if (isAuthorizedMembershipFailure(membership)) return membership.response
  if (!hasAuditAccessRole(membership.membership.role)) {
    return errorResponse(403, 'forbidden', 'owner or provider-admin role is required')
  }
  const rows = await readChatProxyAuditRows(db, workspaceId, readAuditLimit(request))
  const response: KnowgrphStorageChatAuditResponse = {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    workspaceId,
    entries: rows.map(mapAuditRow),
  }
  return json(200, response)
}

const isChatRelayRequest = (value: unknown): value is KnowgrphStorageChatRelayRequest => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.apiVersion === KNOWGRPH_STORAGE_API_VERSION
    && typeof record.workspaceId === 'string'
    && typeof record.providerId === 'string'
    && (record.authMode === 'serverManaged' || record.authMode === 'byok')
    && typeof record.model === 'string'
    && Array.isArray(record.messages)
    && (record.providerOptions == null || typeof record.providerOptions === 'object')
  )
}

const readDefaultPolicy = (args: {
  workspaceId: string
  providerId: string
}): KnowgrphStorageChatPolicyRecord => ({
  workspaceId: args.workspaceId,
  providerId: args.providerId as KnowgrphStorageChatPolicyRecord['providerId'],
  allowServerManaged: false,
  allowByok: true,
  monthlyRequestLimit: null,
  monthlyTokenLimit: null,
  monthlySpendLimitCents: null,
  defaultModel: null,
  updatedAtMs: null,
})

export const handleChatRelay = async (
  request: Request,
  env: KnowgrphStorageWorkerEnv,
  db: D1DatabaseLike,
): Promise<Response> => {
  const payload = await parseJsonRequestBody<KnowgrphStorageChatRelayRequest>(request)
  if (!isChatRelayRequest(payload)) return errorResponse(400, 'bad_request', 'invalid chat relay request payload')
  const auth = await readAuthenticatedChatContext(request, db)
  if (isAuthenticatedChatContextFailure(auth)) return auth.response
  const membership = await readAuthorizedMembership({ db, workspaceId: payload.workspaceId, userId: auth.value.user.id })
  if (isAuthorizedMembershipFailure(membership)) return membership.response
  if (!hasRelayAccessRole(membership.membership.role)) {
    return errorResponse(403, 'forbidden', 'editor, owner, or provider-admin role is required')
  }
  const policyRow = await readWorkspaceProviderPolicyRow(db, payload.workspaceId, payload.providerId)
  const policy = policyRow ? mapPolicyRow(policyRow) : readDefaultPolicy({
    workspaceId: payload.workspaceId,
    providerId: payload.providerId,
  })
  if (payload.authMode === 'serverManaged' && !policy.allowServerManaged) {
    return errorResponse(403, 'forbidden', 'server-managed relay mode is not enabled for this workspace provider')
  }
  if (payload.authMode === 'byok' && !policy.allowByok) {
    return errorResponse(403, 'forbidden', 'BYOK relay mode is not enabled for this workspace provider')
  }
  if (payload.authMode === 'byok' && !normalizeString(payload.byokApiKey)) {
    return errorResponse(400, 'bad_request', 'byokApiKey is required when authMode=byok')
  }
  if (payload.stream === true) {
    return errorResponse(400, 'bad_request', 'stream relay is not supported by the storage chat relay yet')
  }
  const proxyBaseUrl = normalizeString(env.KNOWGRPH_STORAGE_CHAT_PROXY_BASE_URL)
  if (!proxyBaseUrl) return errorResponse(500, 'server_error', 'missing KNOWGRPH_STORAGE_CHAT_PROXY_BASE_URL')
  let proxyUrl: URL
  try {
    proxyUrl = new URL('/__chat_proxy/v1/chat/completions', proxyBaseUrl.endsWith('/') ? proxyBaseUrl : `${proxyBaseUrl}/`)
  } catch {
    return errorResponse(500, 'server_error', 'invalid KNOWGRPH_STORAGE_CHAT_PROXY_BASE_URL')
  }
  const requestId = normalizeString(request.headers.get('x-client-request-id')) || buildAuditId()
  const proxyHeaders = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
    'x-kg-chat-provider': payload.providerId,
    'x-client-request-id': requestId,
  })
  if (payload.endpointUrl) proxyHeaders.set('x-kg-chat-upstream', String(payload.endpointUrl).trim())
  if (payload.authMode === 'byok' && payload.byokApiKey) proxyHeaders.set('x-kg-chat-api-key', payload.byokApiKey.trim())
  const requestBody = JSON.stringify({
    model: payload.model,
    messages: payload.messages,
    stream: false,
    ...(payload.providerOptions && typeof payload.providerOptions === 'object'
      ? payload.providerOptions
      : {}),
  })
  const requestBytes = new TextEncoder().encode(requestBody).byteLength
  const startedAtMs = Date.now()
  let upstreamStatus: number | null = null
  let responseBytes: number | null = null
  let errorMessage: string | null = null
  let relayStatus = 'allowed'
  let responseBody: unknown = null
  try {
    const proxyResponse = await fetch(proxyUrl.toString(), {
      method: 'POST',
      headers: proxyHeaders,
      body: requestBody,
    })
    upstreamStatus = proxyResponse.status
    const responseText = await proxyResponse.text()
    responseBytes = new TextEncoder().encode(responseText).byteLength
    try {
      responseBody = responseText ? JSON.parse(responseText) : null
    } catch {
      responseBody = responseText
    }
    if (!proxyResponse.ok) {
      relayStatus = 'upstream_error'
      errorMessage = typeof responseBody === 'string'
        ? responseBody
        : normalizeNullableString((responseBody as { error?: unknown } | null)?.error) || proxyResponse.statusText || 'chat relay upstream failed'
    }
  } catch (error) {
    relayStatus = 'network_error'
    errorMessage = error instanceof Error ? error.message : String(error || 'chat relay request failed')
  }
  const createdAtIso = new Date().toISOString()
  await writeChatProxyAuditRow(db, {
    id: buildAuditId(),
    workspaceId: payload.workspaceId,
    userId: auth.value.user.id,
    membershipId: membership.membership.id,
    providerId: payload.providerId,
    authMode: payload.authMode,
    requestId,
    upstreamStatus,
    relayStatus,
    modelId: payload.model,
    requestBytes,
    responseBytes,
    latencyMs: Date.now() - startedAtMs,
    errorCode: relayStatus === 'allowed' ? null : relayStatus,
    errorMessage,
    createdAt: createdAtIso,
  })
  if (relayStatus !== 'allowed') {
    return errorResponse(upstreamStatus && upstreamStatus >= 400 ? upstreamStatus : 502, 'server_error', errorMessage || 'chat relay request failed')
  }
  const response: KnowgrphStorageChatRelayResponse = {
    ok: true,
    apiVersion: KNOWGRPH_STORAGE_API_VERSION,
    workspaceId: payload.workspaceId,
    providerId: payload.providerId,
    authMode: payload.authMode,
    upstreamStatus: upstreamStatus || 200,
    relayStatus: 'allowed',
    body: responseBody,
  }
  return json(200, response)
}
