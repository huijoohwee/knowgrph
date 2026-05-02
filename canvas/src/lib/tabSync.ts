import type { StorageChannelKey } from '@/lib/config';
import { getLocalStorage, resolveBrowserStorageKey } from '@/lib/persistence';
import { scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'

export type SyncVersion = '1';

export type SyncKind =
  | 'SelectionChanged'
  | 'CodeCaretChanged'
  | 'ZoomTransformChanged'
  | 'GraphDataChanged'
  | 'SchemaChanged';

export interface SyncEnvelope<T> {
  version: SyncVersion;
  kind: SyncKind;
  graphId: string;
  sourceTabId: string;
  timestamp: number;
  /**
   * Optional stable signature (caller-provided). Used to dedupe/coalesce bursts
   * without forcing JSON.stringify(payload) for every publish.
   */
  sig?: string;
  payload: T;
}

export type SelectionPayload = {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
};

export type CodeCaretPayload = {
  pos: number;
  end: number;
};

export type ZoomPayload = {
  k: number;
  x: number;
  y: number;
};

export type GraphDataPayload = unknown;
export type SchemaPayload = { schema: unknown };

type Subscriber = (msg: SyncEnvelope<unknown>) => void;

export interface TabSync {
  publish: (msg: SyncEnvelope<unknown>) => void;
  subscribe: (fn: Subscriber) => () => void;
  destroy: () => void;
}

const channelSingletons = new Map<
  string,
  { bc: BroadcastChannel | null; storageListener: ((e: StorageEvent) => void) | null; refCount: number }
>();
const channelSubscribers = new Map<StorageChannelKey, Set<Subscriber>>();

const TAB_SYNC_PUBLISH_DELAY_MS = 16

export const createTabSync = (channelName: StorageChannelKey): TabSync => {
  const bcSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;
  const subscribers = new Set<Subscriber>();
  if (!channelSubscribers.has(channelName)) channelSubscribers.set(channelName, new Set<Subscriber>());
  const storageChannelKey = resolveBrowserStorageKey(channelName)

  let singleton = channelSingletons.get(channelName) || null;
  if (!singleton) {
    const bc = bcSupported ? new BroadcastChannel(channelName) : null;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageChannelKey || !e.newValue) return;
      try {
        const msg = JSON.parse(e.newValue);
        const subs = channelSubscribers.get(channelName);
        if (subs) subs.forEach((fn) => fn(msg));
      } catch (err) { void err }
    };
    if (!bc && typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    singleton = { bc, storageListener: onStorage, refCount: 0 };
    channelSingletons.set(channelName, singleton);
  }

  singleton.refCount += 1;

  if (singleton.bc) {
    singleton.bc.onmessage = (e) => {
      const msg = e.data;
      const subs = channelSubscribers.get(channelName);
      if (subs) subs.forEach((fn) => fn(msg));
    };
  }

  const publish = (msg: SyncEnvelope<unknown>) => {
    const kind = msg?.kind
    const graphId = msg?.graphId
    const sourceTabId = msg?.sourceTabId
    const signature = typeof msg?.sig === 'string' && msg.sig.trim() ? msg.sig.trim() : null
    const taskKey = `tab-sync:publish:${String(channelName)}:${String(kind)}:${String(graphId)}:${String(sourceTabId)}`
    const scopeKey = `${WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE}:${String(channelName)}:${String(kind)}:${String(graphId)}`
    scheduleWorkspaceSyncTask(
      taskKey,
      () => {
        const sendMsg: SyncEnvelope<unknown> = { ...msg, timestamp: Date.now() }
        if (singleton.bc) {
          singleton.bc.postMessage(sendMsg)
          return
        }
        try {
          const storage = getLocalStorage()
          if (!storage) return
          storage.setItem(channelName, JSON.stringify(sendMsg))
          storage.removeItem(channelName)
        } catch (err) {
          void err
        }
      },
      TAB_SYNC_PUBLISH_DELAY_MS,
      { signature, scopeKey },
    )
  };

  const subscribe = (fn: Subscriber) => {
    subscribers.add(fn);
    const subs = channelSubscribers.get(channelName);
    subs?.add(fn);
    return () => {
      subscribers.delete(fn);
      subs?.delete(fn);
    };
  };

  const destroy = () => {
    const s = channelSingletons.get(channelName);
    if (!s) return;
    s.refCount = Math.max(0, s.refCount - 1);
    if (s.refCount === 0) {
      if (s.bc) {
        try { s.bc.close(); } catch (err) { void err }
      }
      if (s.storageListener && typeof window !== 'undefined') {
        try { window.removeEventListener('storage', s.storageListener); } catch (err) { void err }
      }
      channelSingletons.delete(channelName);
      channelSubscribers.delete(channelName);
    }
  };

  return { publish, subscribe, destroy };
};

export const buildEnvelope = <T>(
  kind: SyncKind,
  graphId: string,
  sourceTabId: string,
  payload: T,
  meta?: { sig?: string | null },
): SyncEnvelope<T> => ({
  version: '1',
  kind,
  graphId,
  sourceTabId,
  timestamp: Date.now(),
  sig: typeof meta?.sig === 'string' && meta.sig.trim() ? meta.sig.trim() : undefined,
  payload,
});
