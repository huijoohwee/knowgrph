import { randomUUID } from "node:crypto";

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 64;

function positiveInteger(value, fallback, label) {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return resolved;
}

export function createEcsSessionStore({
  ttlMs,
  maxSessions,
  now = Date.now,
  idFactory = randomUUID,
  onDispose = () => {},
  isActive = () => false,
} = {}) {
  const resolvedTtlMs = positiveInteger(ttlMs, DEFAULT_TTL_MS, "ttlMs");
  const resolvedMaxSessions = positiveInteger(maxSessions, DEFAULT_MAX_SESSIONS, "maxSessions");
  if (
    typeof now !== "function"
    || typeof idFactory !== "function"
    || typeof onDispose !== "function"
    || typeof isActive !== "function"
  ) {
    throw new TypeError("now, idFactory, onDispose, and isActive must be functions");
  }

  const sessions = new Map();

  function disposeRecord(record, reason) {
    try {
      const disposed = onDispose(record.session, reason);
      if (disposed === false) throw new Error("session disposal was rejected");
      if (disposed && typeof disposed.then === "function") {
        throw new TypeError("session disposal must be synchronous");
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        errorCode: "ECS_SESSION_DISPOSE_FAILED",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function sweepExpired(referenceTime = now()) {
    const expiredSessionIds = [];
    const disposalFailures = [];
    for (const [sessionId, record] of sessions) {
      if (record.expiresAt > referenceTime) continue;
      if (isActive(record.session)) {
        record.expiresAt = referenceTime + resolvedTtlMs;
        continue;
      }
      const disposal = disposeRecord(record, "expired");
      if (!disposal.ok) {
        record.expiresAt = referenceTime + resolvedTtlMs;
        disposalFailures.push({ sessionId, ...disposal });
        continue;
      }
      sessions.delete(sessionId);
      expiredSessionIds.push(sessionId);
    }
    return { expiredSessionIds, disposalFailures };
  }

  function create(session) {
    const swept = sweepExpired();
    if (swept.disposalFailures.length > 0) return swept.disposalFailures[0];
    if (sessions.size >= resolvedMaxSessions) {
      return {
        ok: false,
        errorCode: "ECS_SESSION_CAPACITY_REACHED",
        message: `At most ${resolvedMaxSessions} ECS sessions may be active`,
      };
    }
    const sessionId = idFactory();
    if (typeof sessionId !== "string" || sessionId.trim() === "" || sessions.has(sessionId)) {
      return {
        ok: false,
        errorCode: "ECS_SESSION_ID_UNAVAILABLE",
        message: "Could not allocate a unique ECS session id",
      };
    }
    const createdAt = now();
    sessions.set(sessionId, {
      createdAt,
      expiresAt: createdAt + resolvedTtlMs,
      session,
    });
    return { ok: true, sessionId, createdAt, expiresAt: createdAt + resolvedTtlMs };
  }

  function get(sessionId) {
    const { disposalFailures, expiredSessionIds } = sweepExpired();
    const disposalFailure = disposalFailures.find((entry) => entry.sessionId === sessionId);
    if (disposalFailure) return disposalFailure;
    const record = sessions.get(sessionId);
    if (!record) {
      const expired = expiredSessionIds.includes(sessionId);
      return {
        ok: false,
        errorCode: expired ? "ECS_SESSION_EXPIRED" : "ECS_SESSION_NOT_FOUND",
        message: expired ? `ECS session ${sessionId} expired` : `ECS session ${sessionId} was not found`,
      };
    }
    record.expiresAt = now() + resolvedTtlMs;
    return { ok: true, session: record.session, expiresAt: record.expiresAt };
  }

  function close(sessionId, reason = "completed") {
    const record = sessions.get(sessionId);
    if (!record) {
      return {
        ok: false,
        errorCode: "ECS_SESSION_NOT_FOUND",
        message: `ECS session ${sessionId} was not found`,
      };
    }
    const disposal = disposeRecord(record, reason);
    if (!disposal.ok) return disposal;
    sessions.delete(sessionId);
    return { ok: true };
  }

  function size() {
    sweepExpired();
    return sessions.size;
  }

  return Object.freeze({ create, get, close, size, sweepExpired });
}
