export type QueuedMarkdownApplyRequest<TRequest> = {
  key: string
  request: TRequest
}

export class MarkdownApplyRequestQueue<TRequest> {
  private activeKey = ''
  private queued: QueuedMarkdownApplyRequest<TRequest> | null = null
  private readonly waitersByKey = new Map<string, Set<(result: boolean) => void>>()

  get inFlight(): boolean {
    return !!this.activeKey
  }

  isKeyInFlight(key: string): boolean {
    return !!key && (key === this.activeKey || key === this.queued?.key)
  }

  start(key: string): void {
    this.activeKey = key
  }

  waitFor(key: string): Promise<boolean> {
    if (!key) return Promise.resolve(false)
    return new Promise(resolve => {
      const existing = this.waitersByKey.get(key)
      if (existing) existing.add(resolve)
      else this.waitersByKey.set(key, new Set([resolve]))
    })
  }

  enqueueLatest(request: TRequest, key: string): Promise<boolean> {
    if (this.queued?.key && this.queued.key !== key) this.settle(this.queued.key, false)
    this.queued = { request, key }
    return this.waitFor(key)
  }

  settle(key: string, result: boolean): void {
    if (!key) return
    const waiters = this.waitersByKey.get(key)
    if (!waiters) return
    this.waitersByKey.delete(key)
    for (const resolve of waiters) resolve(result)
  }

  takeQueued(): QueuedMarkdownApplyRequest<TRequest> | null {
    const next = this.queued
    this.queued = null
    this.activeKey = next?.key || ''
    return next
  }

  finish(): void {
    this.settle(this.activeKey, false)
    this.settle(this.queued?.key || '', false)
    this.activeKey = ''
    this.queued = null
  }
}
