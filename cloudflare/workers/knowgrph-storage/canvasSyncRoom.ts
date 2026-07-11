import {
  KNOWGRPH_STORAGE_API_VERSION,
  type KnowgrphCanvasRoomPeerRecord,
  type KnowgrphCanvasRoomStatusResponse,
  type KnowgrphStorageChatRole,
} from './contract'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const CANVAS_ROOM_INTERNAL_HEADERS = {
  workspaceId: 'x-knowgrph-room-workspace-id',
  roomId: 'x-knowgrph-room-id',
  userId: 'x-knowgrph-user-id',
  sessionId: 'x-knowgrph-session-id',
  displayName: 'x-knowgrph-user-display-name',
  role: 'x-knowgrph-room-role',
} as const

const readJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const value = await request.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

const readString = (record: Record<string, unknown>, key: string): string =>
  String(record[key] || '').trim()

const readHeaderString = (request: Request, key: string): string =>
  String(request.headers.get(key) || '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isChatRole = (value: string): value is KnowgrphStorageChatRole =>
  value === 'viewer' || value === 'editor' || value === 'owner' || value === 'provider-admin'

const isWebSocketUpgrade = (request: Request): boolean =>
  String(request.headers.get('upgrade') || '').trim().toLowerCase() === 'websocket'

const parseWebSocketMessage = (message: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(message)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

type KnowgrphCanvasRoomSocketLike = WebSocket & {
  serializeAttachment?: (value: unknown) => void
  deserializeAttachment?: () => unknown
}

type CanvasRoomConnectionAttachment = {
  workspaceId: string
  roomId: string
  userId: string
  sessionId: string
  displayName: string
  role: KnowgrphStorageChatRole
  joinedAt: number
  caretLine: number | null
}

type CanvasRoomAssetRecord = Record<string, unknown> & {
  workspaceId: string
  roomId: string
  artifactId: string
  contentHash: string
}

type WebSocketPairCtor = new () => {
  0: KnowgrphCanvasRoomSocketLike
  1: KnowgrphCanvasRoomSocketLike
}

type KnowgrphDurableObjectStateLike = {
  storage: {
    put: (key: string, value: unknown) => Promise<void>
    get?: (key: string) => Promise<unknown>
  }
  acceptWebSocket?: (socket: WebSocket) => void
  getWebSockets?: () => WebSocket[]
}

export class KnowgrphCanvasSyncRoom {
  private readonly state: KnowgrphDurableObjectStateLike

  constructor(state: KnowgrphDurableObjectStateLike) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/connect') {
      return this.handleConnect(request)
    }
    if (url.pathname === '/status') {
      return this.handleStatus(request)
    }
    if (url.pathname === '/asset-sync') {
      return this.handleAssetSync(request)
    }
    return json(404, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'canvas room route not found' })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message !== 'string') return
    const payload = parseWebSocketMessage(message)
    if (!payload) {
      this.sendJson(ws as KnowgrphCanvasRoomSocketLike, { type: 'error', error: 'invalid room message payload' })
      return
    }
    const attachment = this.readAttachment(ws as KnowgrphCanvasRoomSocketLike)
    if (!attachment) {
      this.sendJson(ws as KnowgrphCanvasRoomSocketLike, { type: 'error', error: 'missing room attachment' })
      return
    }
    if (payload.type === 'ping') {
      this.sendJson(ws as KnowgrphCanvasRoomSocketLike, { type: 'pong', ts: Date.now() })
      return
    }
    if (payload.type === 'presence.update') {
      const caretLineRaw = payload.caretLine
      const nextDisplayName = readString(payload, 'displayName') || attachment.displayName
      const caretLine = typeof caretLineRaw === 'number' && Number.isFinite(caretLineRaw)
        ? Math.max(0, Math.floor(caretLineRaw))
        : null
      const nextAttachment: CanvasRoomConnectionAttachment = {
        ...attachment,
        displayName: nextDisplayName,
        caretLine,
      }
      this.writeAttachment(ws as KnowgrphCanvasRoomSocketLike, nextAttachment)
      this.broadcastJson({
        type: 'presence.updated',
        peer: this.toPeerRecord(nextAttachment),
      })
      return
    }
    if (payload.type === 'document.sync') {
      const documentKey = readString(payload, 'documentKey')
      const text = String(payload.text || '')
      if (!documentKey) {
        this.sendJson(ws as KnowgrphCanvasRoomSocketLike, { type: 'error', error: 'missing document key for room sync' })
        return
      }
      this.broadcastJson({
        type: 'document.synced',
        peerId: attachment.userId,
        displayName: attachment.displayName,
        roomId: attachment.roomId,
        workspaceId: attachment.workspaceId,
        documentKey,
        text,
        sentAt: Date.now(),
      }, ws)
      return
    }
    if (payload.type === 'asset.latest.request') {
      const latestAsset = await this.readLatestAsset(attachment.workspaceId, attachment.roomId)
      this.sendJson(ws as KnowgrphCanvasRoomSocketLike, {
        type: 'asset.latest',
        asset: latestAsset,
      })
      return
    }
    this.sendJson(ws as KnowgrphCanvasRoomSocketLike, { type: 'error', error: 'unsupported room message type' })
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): void {
    const attachment = this.readAttachment(ws as KnowgrphCanvasRoomSocketLike)
    if (attachment) {
      this.broadcastJson({
        type: 'peer.left',
        peer: this.toPeerRecord(attachment),
      }, ws)
    }
    ws.close(code, reason)
  }

  private async handleConnect(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return json(405, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'unsupported canvas room connect method' })
    }
    if (!isWebSocketUpgrade(request)) {
      return json(426, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'canvas room connect requires websocket upgrade' })
    }
    if (typeof this.state.acceptWebSocket !== 'function') {
      return json(500, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'canvas room websocket accept is unavailable' })
    }
    const attachment = this.readConnectionAttachment(request)
    if (!attachment) {
      return json(401, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'missing authenticated canvas room identity' })
    }
    const WebSocketPairClass = (globalThis as typeof globalThis & { WebSocketPair: WebSocketPairCtor }).WebSocketPair
    const webSocketPair = new WebSocketPairClass()
    const client = webSocketPair[0]
    const server = webSocketPair[1]
    this.state.acceptWebSocket(server)
    this.writeAttachment(server, attachment)
    const latestAsset = await this.readLatestAsset(attachment.workspaceId, attachment.roomId)
    this.sendJson(server, {
      type: 'room.connected',
      workspaceId: attachment.workspaceId,
      roomId: attachment.roomId,
      peer: this.toPeerRecord(attachment),
    })
    this.sendJson(server, {
      type: 'room.roster',
      peers: this.listPeers(),
    })
    if (latestAsset) {
      this.sendJson(server, {
        type: 'asset.latest',
        asset: latestAsset,
      })
    }
    this.broadcastJson({
      type: 'peer.joined',
      peer: this.toPeerRecord(attachment),
    }, server)
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket })
  }

  private async handleStatus(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return json(405, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'unsupported canvas room status method' })
    }
    const workspaceId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.workspaceId)
      || String(new URL(request.url).searchParams.get('workspaceId') || '').trim()
    const roomId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.roomId)
      || String(new URL(request.url).searchParams.get('roomId') || '').trim()
    if (!workspaceId || !roomId) {
      return json(400, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'workspaceId and roomId are required for canvas room status' })
    }
    const latestAssetKey = await this.readLatestAssetKey(workspaceId, roomId)
    const response: KnowgrphCanvasRoomStatusResponse = {
      ok: true,
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId,
      roomId,
      activePeerCount: this.listPeers().length,
      latestAssetKey,
      peers: this.listPeers(),
    }
    return json(200, response)
  }

  private async handleAssetSync(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json(405, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'unsupported canvas room route method' })
    }
    const body = await readJsonBody(request)
    if (!body) {
      return json(400, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'invalid canvas room asset payload' })
    }
    const workspaceId = readString(body, 'workspaceId')
    const roomId = readString(body, 'roomId')
    const artifactId = readString(body, 'artifactId')
    const contentHash = readString(body, 'contentHash')
    if (!workspaceId || !roomId || !artifactId || !contentHash) {
      return json(400, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'missing canvas room asset identity' })
    }
    const assetRecord: CanvasRoomAssetRecord = {
      ...body,
      workspaceId,
      roomId,
      artifactId,
      contentHash,
    }
    const storageKey = `asset:${workspaceId}:${roomId}:${artifactId}`
    await this.state.storage.put(storageKey, assetRecord)
    await this.state.storage.put(`asset-latest:${workspaceId}:${roomId}`, storageKey)
    this.broadcastJson({
      type: 'asset.synced',
      asset: assetRecord,
    })
    return json(200, {
      ok: true,
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId,
      roomId,
      artifactId,
    })
  }

  private readConnectionAttachment(request: Request): CanvasRoomConnectionAttachment | null {
    const workspaceId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.workspaceId)
    const roomId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.roomId)
    const userId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.userId)
    const sessionId = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.sessionId)
    const displayName = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.displayName)
    const roleRaw = readHeaderString(request, CANVAS_ROOM_INTERNAL_HEADERS.role)
    if (!workspaceId || !roomId || !userId || !sessionId || !displayName || !isChatRole(roleRaw)) return null
    return {
      workspaceId,
      roomId,
      userId,
      sessionId,
      displayName,
      role: roleRaw,
      joinedAt: Date.now(),
      caretLine: null,
    }
  }

  private readAttachment(socket: KnowgrphCanvasRoomSocketLike): CanvasRoomConnectionAttachment | null {
    if (typeof socket.deserializeAttachment !== 'function') return null
    const value = socket.deserializeAttachment()
    if (!isRecord(value)) return null
    const roleRaw = readString(value, 'role')
    const workspaceId = readString(value, 'workspaceId')
    const roomId = readString(value, 'roomId')
    const userId = readString(value, 'userId')
    const sessionId = readString(value, 'sessionId')
    const displayName = readString(value, 'displayName')
    const joinedAtRaw = value.joinedAt
    const caretLineRaw = value.caretLine
    if (!workspaceId || !roomId || !userId || !sessionId || !displayName || !isChatRole(roleRaw)) return null
    return {
      workspaceId,
      roomId,
      userId,
      sessionId,
      displayName,
      role: roleRaw,
      joinedAt: typeof joinedAtRaw === 'number' && Number.isFinite(joinedAtRaw) ? joinedAtRaw : Date.now(),
      caretLine: typeof caretLineRaw === 'number' && Number.isFinite(caretLineRaw) ? caretLineRaw : null,
    }
  }

  private writeAttachment(socket: KnowgrphCanvasRoomSocketLike, attachment: CanvasRoomConnectionAttachment): void {
    if (typeof socket.serializeAttachment === 'function') {
      socket.serializeAttachment(attachment)
    }
  }

  private listSockets(): KnowgrphCanvasRoomSocketLike[] {
    if (typeof this.state.getWebSockets !== 'function') return []
    return this.state.getWebSockets() as KnowgrphCanvasRoomSocketLike[]
  }

  private listPeers(): KnowgrphCanvasRoomPeerRecord[] {
    return this.listSockets()
      .map(socket => this.readAttachment(socket))
      .filter((value): value is CanvasRoomConnectionAttachment => value !== null)
      .map(peer => this.toPeerRecord(peer))
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  }

  private toPeerRecord(attachment: CanvasRoomConnectionAttachment): KnowgrphCanvasRoomPeerRecord {
    return {
      userId: attachment.userId,
      displayName: attachment.displayName,
      role: attachment.role,
      joinedAt: attachment.joinedAt,
      caretLine: attachment.caretLine,
    }
  }

  private async readLatestAssetKey(workspaceId: string, roomId: string): Promise<string | null> {
    if (typeof this.state.storage.get !== 'function') return null
    const value = await this.state.storage.get(`asset-latest:${workspaceId}:${roomId}`)
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private async readLatestAsset(workspaceId: string, roomId: string): Promise<CanvasRoomAssetRecord | null> {
    if (typeof this.state.storage.get !== 'function') return null
    const latestAssetKey = await this.readLatestAssetKey(workspaceId, roomId)
    if (!latestAssetKey) return null
    const value = await this.state.storage.get(latestAssetKey)
    return isRecord(value) ? value as CanvasRoomAssetRecord : null
  }

  private sendJson(socket: KnowgrphCanvasRoomSocketLike, body: unknown): void {
    try {
      socket.send(JSON.stringify(body))
    } catch {
      // Socket may have closed between roster enumeration and send; ignore.
    }
  }

  private broadcastJson(body: unknown, excludeSocket?: WebSocket): void {
    for (const socket of this.listSockets()) {
      if (excludeSocket && socket === excludeSocket) continue
      this.sendJson(socket, body)
    }
  }
}
