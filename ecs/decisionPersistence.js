import { randomUUID } from "node:crypto";
import { constants as fileSystemConstants, promises as nodeFileSystem } from "node:fs";
import path from "node:path";

import {
  mergeDecisionsIntoKgcMarkdown,
  normalizeDecisionBatch,
} from "./decisionDocument.js";
import { KgcNodeContractError } from "./kgcNodeContract.js";

export {
  deserializeDecisionNode,
  serializeDecisionNode,
} from "./decisionDocument.js";
export { DECISION_TYPES } from "./kgcNodeContract.js";

// This queue prevents lost updates between callers in this JavaScript process.
// It is not a cross-process/file-system lock; repository coordination remains
// the authority when multiple processes could write the same KGC document.
const PERSISTENCE_PATH_TAILS = new Map();
const TRUSTED_PATH_IDENTITIES = new Map();
const MAX_TRUSTED_PATHS = 256;
const MAX_TRUSTED_PREDECESSORS = 256;

function isInsideRoot(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === "" || (
    relativePath !== ".."
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

function fileIdentity(fileStats) {
  return {
    device: Number(fileStats.dev),
    inode: Number(fileStats.ino),
  };
}

function fileIdentitiesEqual(left, right) {
  return Boolean(
    left
    && right
    && left.device === right.device
    && left.inode === right.inode,
  );
}

function fileIdentityKey(identity) {
  return `${identity.device}:${identity.inode}`;
}

function isTrustedPathIdentity(canonicalPath, expectedIdentity, currentIdentity) {
  const lineage = TRUSTED_PATH_IDENTITIES.get(canonicalPath);
  const expectedKey = fileIdentityKey(expectedIdentity);
  const currentKey = fileIdentityKey(currentIdentity);
  if (!lineage) return expectedKey === currentKey;
  if (lineage.currentKey !== currentKey) return false;
  return expectedKey === currentKey || lineage.predecessors.has(expectedKey);
}

function recordTrustedReplacement(canonicalPath, priorIdentity, replacementIdentity) {
  const priorKey = fileIdentityKey(priorIdentity);
  const replacementKey = fileIdentityKey(replacementIdentity);
  const existing = TRUSTED_PATH_IDENTITIES.get(canonicalPath);
  const predecessors = existing?.currentKey === priorKey
    ? new Set(existing.predecessors)
    : new Set();
  predecessors.add(priorKey);
  while (predecessors.size > MAX_TRUSTED_PREDECESSORS) {
    predecessors.delete(predecessors.values().next().value);
  }
  TRUSTED_PATH_IDENTITIES.delete(canonicalPath);
  TRUSTED_PATH_IDENTITIES.set(canonicalPath, { currentKey: replacementKey, predecessors });
  while (TRUSTED_PATH_IDENTITIES.size > MAX_TRUSTED_PATHS) {
    TRUSTED_PATH_IDENTITIES.delete(TRUSTED_PATH_IDENTITIES.keys().next().value);
  }
}

async function resolveCanonicalPersistencePath(kgcPath, fileSystem, options = {}) {
  const { expectedCanonicalPath, rootDir } = options;
  const lexicalPath = path.resolve(kgcPath);
  if (typeof fileSystem.realpath !== "function") {
    if (rootDir || expectedCanonicalPath) {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_UNREADABLE",
        "safe Decision persistence requires canonical path resolution",
        "kgcPath",
      );
    }
    return { canonicalPath: lexicalPath, fileIdentity: null };
  }
  let canonicalPath;
  try {
    canonicalPath = await fileSystem.realpath(lexicalPath);
  } catch {
    if (rootDir || expectedCanonicalPath) {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_UNREADABLE",
        "the Decision persistence target is no longer readable",
        "kgcPath",
      );
    }
    return { canonicalPath: lexicalPath, fileIdentity: null };
  }
  if (rootDir) {
    const canonicalRoot = await fileSystem.realpath(path.resolve(rootDir));
    if (!isInsideRoot(canonicalRoot, canonicalPath)) {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_OUTSIDE_ROOT",
        "the Decision persistence target resolves outside its repository root",
        "kgcPath",
      );
    }
  }
  if (
    expectedCanonicalPath
    && canonicalPath !== path.resolve(expectedCanonicalPath)
  ) {
    throw new KgcNodeContractError(
      "ECS_KGC_PATH_CHANGED",
      "the Decision persistence target changed after session start",
      "kgcPath",
    );
  }
  if (options.expectedFileIdentity) {
    let fileStats;
    try {
      fileStats = await fileSystem.stat(canonicalPath);
    } catch {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_UNREADABLE",
        "the Decision persistence target is no longer readable",
        "kgcPath",
      );
    }
    const currentIdentity = fileIdentity(fileStats);
    if (
      !fileStats.isFile()
      || !isTrustedPathIdentity(canonicalPath, options.expectedFileIdentity, currentIdentity)
    ) {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_CHANGED",
        "the Decision persistence target changed after session start",
        "kgcPath",
      );
    }
    return { canonicalPath, fileIdentity: currentIdentity };
  }
  return { canonicalPath, fileIdentity: null };
}

async function readBoundPersistenceSource(kgcPath, fileSystem, expectedFileIdentity) {
  if (typeof fileSystem.open !== "function") {
    throw new KgcNodeContractError(
      "ECS_KGC_PATH_UNREADABLE",
      "safe Decision persistence requires file-handle support",
      "kgcPath",
    );
  }
  const noFollow = fileSystemConstants.O_NOFOLLOW ?? 0;
  const handle = await fileSystem.open(kgcPath, fileSystemConstants.O_RDONLY | noFollow);
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile() || !fileIdentitiesEqual(fileIdentity(fileStats), expectedFileIdentity)) {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_CHANGED",
        "the Decision persistence target changed after session start",
        "kgcPath",
      );
    }
    return await handle.readFile({ encoding: "utf8" });
  } finally {
    await handle.close();
  }
}

async function runInPersistenceTurn(canonicalPath, operation) {
  const priorTail = PERSISTENCE_PATH_TAILS.get(canonicalPath) ?? Promise.resolve();
  let releaseTurn;
  const currentTail = new Promise((resolve) => {
    releaseTurn = resolve;
  });
  PERSISTENCE_PATH_TAILS.set(canonicalPath, currentTail);
  await priorTail;
  try {
    return await operation();
  } finally {
    releaseTurn();
    if (PERSISTENCE_PATH_TAILS.get(canonicalPath) === currentTail) {
      PERSISTENCE_PATH_TAILS.delete(canonicalPath);
    }
  }
}

function persistenceFailure(error, retainedDecisions) {
  return {
    ok: false,
    errorCode: error?.code ?? "ECS_DECISION_WRITE_FAILED",
    message: error instanceof Error ? error.message : String(error),
    decisionId: error?.ref ?? null,
    retainedDecisions,
  };
}

async function persistValidatedDecisions(kgcPath, decisions, fileSystem, options) {
  let tempPath = null;
  try {
    const safePersistence = Boolean(options.expectedFileIdentity);
    const original = safePersistence
      ? await readBoundPersistenceSource(kgcPath, fileSystem, options.expectedFileIdentity)
      : await fileSystem.readFile(kgcPath, "utf8");
    const mergeResult = mergeDecisionsIntoKgcMarkdown(original, decisions);
    if (mergeResult.persistedCount === 0) {
      return {
        ok: true,
        persistedCount: 0,
        idempotentCount: mergeResult.idempotentCount,
        ...(safePersistence ? { fileIdentity: options.expectedFileIdentity } : {}),
      };
    }

    const updated = mergeResult.markdown;
    const directory = path.dirname(kgcPath);
    tempPath = path.join(directory, `.${path.basename(kgcPath)}.${randomUUID()}.tmp`);
    if (safePersistence) {
      await resolveCanonicalPersistencePath(kgcPath, fileSystem, options);
    }
    await fileSystem.writeFile(tempPath, updated, { encoding: "utf8", flag: "wx" });
    let replacementIdentity = null;
    if (safePersistence) {
      const replacementStats = await fileSystem.stat(tempPath);
      if (!replacementStats.isFile()) {
        throw new KgcNodeContractError(
          "ECS_DECISION_WRITE_FAILED",
          "the Decision persistence temporary target is not a regular file",
          "kgcPath",
        );
      }
      replacementIdentity = fileIdentity(replacementStats);
      await resolveCanonicalPersistencePath(kgcPath, fileSystem, options);
    }
    await fileSystem.rename(tempPath, kgcPath);
    tempPath = null;
    if (replacementIdentity) {
      recordTrustedReplacement(kgcPath, options.expectedFileIdentity, replacementIdentity);
    }
    return {
      ok: true,
      persistedCount: mergeResult.persistedCount,
      idempotentCount: mergeResult.idempotentCount,
      ...(replacementIdentity ? { fileIdentity: replacementIdentity } : {}),
    };
  } catch (error) {
    if (tempPath !== null) {
      try {
        await fileSystem.unlink(tempPath);
      } catch {
        // Cleanup failure cannot replace the original persistence failure.
      }
    }
    return persistenceFailure(error, decisions);
  }
}

export async function persistDecisions(kgcPath, decisions, options = {}) {
  let batch;
  try {
    if (typeof kgcPath !== "string" || kgcPath.trim() === "") {
      throw new KgcNodeContractError(
        "ECS_KGC_PATH_REQUIRED",
        "kgcPath must be a non-empty string",
        "kgcPath",
      );
    }
    batch = normalizeDecisionBatch(decisions);
  } catch (error) {
    return persistenceFailure(error, Array.isArray(decisions) ? decisions : []);
  }
  if (batch.length === 0) {
    return { ok: true, persistedCount: 0, idempotentCount: 0 };
  }

  const fileSystem = options.fileSystem ?? nodeFileSystem;
  if (options.rootDir || options.expectedCanonicalPath || options.expectedFileIdentity) {
    const queuePath = path.resolve(options.expectedCanonicalPath ?? kgcPath);
    return runInPersistenceTurn(queuePath, async () => {
      let canonicalPath;
      try {
        const resolved = await resolveCanonicalPersistencePath(kgcPath, fileSystem, options);
        canonicalPath = resolved.canonicalPath;
        options = resolved.fileIdentity
          ? { ...options, expectedFileIdentity: resolved.fileIdentity }
          : options;
      } catch (error) {
        return persistenceFailure(error, batch);
      }
      return persistValidatedDecisions(canonicalPath, batch, fileSystem, options);
    });
  }

  let canonicalPath;
  try {
    canonicalPath = (await resolveCanonicalPersistencePath(kgcPath, fileSystem, options)).canonicalPath;
  } catch (error) {
    return persistenceFailure(error, batch);
  }
  return runInPersistenceTurn(canonicalPath, () =>
    persistValidatedDecisions(canonicalPath, batch, fileSystem, options),
  );
}

export async function persistDecision(kgcPath, decisionRecord, options = {}) {
  return persistDecisions(kgcPath, [decisionRecord], options);
}
