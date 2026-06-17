import { KNOWGRPH_STORAGE_API_VERSION } from './contract'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

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

type KnowgrphDurableObjectStateLike = {
  storage: {
    put: (key: string, value: unknown) => Promise<void>
  }
}

export class KnowgrphCanvasSyncRoom {
  private readonly state: KnowgrphDurableObjectStateLike

  constructor(state: KnowgrphDurableObjectStateLike) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/asset-sync') {
      return json(404, { ok: false, apiVersion: KNOWGRPH_STORAGE_API_VERSION, error: 'canvas room route not found' })
    }
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
    const storageKey = `asset:${workspaceId}:${roomId}:${artifactId}`
    await this.state.storage.put(storageKey, {
      ...body,
      workspaceId,
      roomId,
      artifactId,
      contentHash,
    })
    await this.state.storage.put(`asset-latest:${workspaceId}:${roomId}`, storageKey)
    return json(200, {
      ok: true,
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId,
      roomId,
      artifactId,
    })
  }
}
