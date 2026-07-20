import { randomUUID } from "node:crypto";
import { constants as fileSystemConstants, promises as nodeFileSystem } from "node:fs";
import path from "node:path";
import { JSON_SCHEMA, load as loadYaml } from "js-yaml";

import {
  DECISION_TYPES,
  ECS_DECISION_NODE_TYPE,
  KgcNodeContractError,
  buildDecisionKgcNode,
  compareCanonicalStrings,
  decisionRecordsEqual,
  normalizeDecisionNode,
  normalizeDecisionRecord,
  readKgcNodeState,
  stableStringifyJson,
} from "./kgcNodeContract.js";

export { DECISION_TYPES };

// This queue prevents lost updates between callers in this JavaScript process.
// It is not a cross-process/file-system lock; repository coordination remains
// the authority when multiple processes could write the same KGC document.
const PERSISTENCE_PATH_TAILS = new Map();
const TRUSTED_PATH_IDENTITIES = new Map();
const MAX_TRUSTED_PATHS = 256;
const MAX_TRUSTED_PREDECESSORS = 256;

function quoteYamlString(value) {
  return JSON.stringify(value);
}

export function serializeDecisionNode(decisionRecord) {
  const node = buildDecisionKgcNode(decisionRecord);
  return [
    `    - id: ${quoteYamlString(node.id)}`,
    `      label: ${quoteYamlString(node.label)}`,
    `      type: ${quoteYamlString(node.type)}`,
    `      status: ${quoteYamlString(node.status)}`,
    `      properties: ${stableStringifyJson(node.properties)}`,
  ].join("\n");
}

export function deserializeDecisionNode(input) {
  let node = input;
  if (typeof input === "string") {
    let parsed;
    try {
      parsed = loadYaml(input, { json: false, schema: JSON_SCHEMA });
    } catch (error) {
      throw new KgcNodeContractError(
        "ECS_DECISION_INVALID_YAML",
        `Decision node YAML is invalid: ${error instanceof Error ? error.message : String(error)}`,
        "decision",
      );
    }
    if (Array.isArray(parsed)) [node] = parsed;
    else if (Array.isArray(parsed?.flow?.nodes)) [node] = parsed.flow.nodes;
    else node = parsed;
  }
  if (!node || node.type !== ECS_DECISION_NODE_TYPE) {
    throw new KgcNodeContractError(
      "ECS_DECISION_INVALID_NODE",
      `Decision node type must be ${ECS_DECISION_NODE_TYPE}`,
      "decision.type",
    );
  }
  return normalizeDecisionNode(node);
}

function validateBatch(decisions) {
  if (!Array.isArray(decisions)) {
    throw new KgcNodeContractError(
      "ECS_DECISION_BATCH_REQUIRED",
      "decisions must be an array",
      "decisions",
    );
  }
  const byId = new Map();
  decisions.forEach((decision, index) => {
    const normalized = normalizeDecisionRecord(decision, `decisions[${index}]`);
    const existing = byId.get(normalized.decisionId);
    if (existing) {
      throw new KgcNodeContractError(
        "ECS_DECISION_DUPLICATE_ID",
        `decisionId ${normalized.decisionId} occurs more than once in the batch`,
        normalized.decisionId,
      );
    }
    byId.set(normalized.decisionId, normalized);
  });
  return [...byId.values()].sort((left, right) =>
    compareCanonicalStrings(left.decisionId, right.decisionId),
  );
}

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

function frontmatterLines(markdown) {
  const opening = markdown.match(/^(?:\uFEFF)?---[ \t]*(\r?\n)/);
  if (!opening) {
    throw new KgcNodeContractError(
      "ECS_KGC_FRONTMATTER_REQUIRED",
      "KGC Markdown must begin with YAML frontmatter",
      "frontmatter",
    );
  }
  const contentStart = opening[0].length;
  const remainder = markdown.slice(contentStart);
  const closing = /(^|\r?\n)---[ \t]*(?=\r?\n|$)/.exec(remainder);
  if (!closing) {
    throw new KgcNodeContractError(
      "ECS_KGC_FRONTMATTER_REQUIRED",
      "KGC Markdown frontmatter has no closing fence",
      "frontmatter",
    );
  }
  const contentEnd = contentStart + closing.index + closing[1].length;
  const content = markdown.slice(contentStart, contentEnd);
  const lines = [];
  const linePattern = /([^\r\n]*)(\r\n|\n|$)/g;
  let match;
  while ((match = linePattern.exec(content)) !== null) {
    if (match[0] === "") break;
    lines.push({
      content: match[1],
      end: match.index + match[0].length,
      ending: match[2],
      start: match.index,
    });
  }
  return { content, contentStart, lines, lineEnding: opening[1] };
}

function leadingSpaces(line) {
  if (line.startsWith("\t")) return -1;
  const indentation = line.match(/^ */)?.[0].length ?? 0;
  return indentation;
}

function appendNodesToMarkdown(markdown, serializedNodes) {
  if (serializedNodes.length === 0) return markdown;
  const frontmatter = frontmatterLines(markdown);
  const flowIndex = frontmatter.lines.findIndex((line) => /^\s*flow:\s*$/.test(line.content));
  if (flowIndex < 0) {
    throw new KgcNodeContractError(
      "ECS_KGC_BLOCK_FLOW_REQUIRED",
      "KGC frontmatter must contain block-style flow",
      "flow",
    );
  }
  const flowIndent = leadingSpaces(frontmatter.lines[flowIndex].content);
  let nodesIndex = -1;
  for (let index = flowIndex + 1; index < frontmatter.lines.length; index += 1) {
    const line = frontmatter.lines[index];
    if (line.content.trim() === "") continue;
    const indentation = leadingSpaces(line.content);
    if (indentation <= flowIndent) break;
    if (/^\s*nodes:\s*(?:\[\])?\s*$/.test(line.content)) {
      nodesIndex = index;
      break;
    }
  }
  if (nodesIndex < 0) {
    throw new KgcNodeContractError(
      "ECS_KGC_BLOCK_NODES_REQUIRED",
      "KGC frontmatter must contain block-style flow.nodes",
      "flow.nodes",
    );
  }

  const nodesLine = frontmatter.lines[nodesIndex];
  const nodesIndent = leadingSpaces(nodesLine.content);
  if (nodesIndent <= flowIndent || nodesIndent - flowIndent !== 2) {
    throw new KgcNodeContractError(
      "ECS_KGC_BLOCK_NODES_REQUIRED",
      "flow.nodes must be indented two spaces beneath flow",
      "flow.nodes",
    );
  }
  const block = serializedNodes
    .map((node) => node.replace(/\n/g, frontmatter.lineEnding))
    .join(frontmatter.lineEnding);
  if (/nodes:\s*\[\]\s*$/.test(nodesLine.content)) {
    const replacement = `${" ".repeat(nodesIndent)}nodes:${frontmatter.lineEnding}${block}${frontmatter.lineEnding}`;
    return (
      markdown.slice(0, frontmatter.contentStart + nodesLine.start) +
      replacement +
      markdown.slice(frontmatter.contentStart + nodesLine.end)
    );
  }

  let firstChildIndex = -1;
  for (let index = nodesIndex + 1; index < frontmatter.lines.length; index += 1) {
    const line = frontmatter.lines[index];
    if (line.content.trim() === "") continue;
    if (leadingSpaces(line.content) <= nodesIndent) break;
    firstChildIndex = index;
    break;
  }
  if (
    firstChildIndex >= 0 &&
    frontmatter.lines[firstChildIndex].content.trim() === "[]"
  ) {
    const emptyChild = frontmatter.lines[firstChildIndex];
    return (
      markdown.slice(0, frontmatter.contentStart + emptyChild.start) +
      block +
      frontmatter.lineEnding +
      markdown.slice(frontmatter.contentStart + emptyChild.end)
    );
  }

  let insertionOffset = frontmatter.content.length;
  for (let index = nodesIndex + 1; index < frontmatter.lines.length; index += 1) {
    const line = frontmatter.lines[index];
    if (line.content.trim() === "") continue;
    if (leadingSpaces(line.content) <= nodesIndent) {
      insertionOffset = line.start;
      break;
    }
  }
  return (
    markdown.slice(0, frontmatter.contentStart + insertionOffset) +
    block +
    frontmatter.lineEnding +
    markdown.slice(frontmatter.contentStart + insertionOffset)
  );
}

function existingDecisionIndex(nodes) {
  const decisions = new Map();
  const nodeIds = new Set();
  nodes.forEach((node, nodeIndex) => {
    if (typeof node?.id === "string" && node.id !== "") nodeIds.add(node.id);
    if (node?.type !== ECS_DECISION_NODE_TYPE) return;
    const decision = normalizeDecisionNode(node, nodeIndex);
    const existing = decisions.get(decision.decisionId);
    if (existing) {
      throw new KgcNodeContractError(
        "ECS_DECISION_DUPLICATE_ID",
        `source KGC contains duplicate decisionId ${decision.decisionId}`,
        decision.decisionId,
      );
    }
    decisions.set(decision.decisionId, decision);
  });
  return { decisions, nodeIds };
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
    const { nodes } = readKgcNodeState(original);
    const existing = existingDecisionIndex(nodes);
    const additions = [];
    let idempotentCount = 0;
    for (const decision of decisions) {
      const prior = existing.decisions.get(decision.decisionId);
      if (prior) {
        if (!decisionRecordsEqual(prior, decision)) {
          throw new KgcNodeContractError(
            "ECS_DECISION_ID_CONFLICT",
            `decisionId ${decision.decisionId} already exists with different content`,
            decision.decisionId,
          );
        }
        idempotentCount += 1;
        continue;
      }
      const node = buildDecisionKgcNode(decision);
      if (existing.nodeIds.has(node.id)) {
        throw new KgcNodeContractError(
          "ECS_DECISION_NODE_ID_CONFLICT",
          `KGC node id ${node.id} is already in use`,
          decision.decisionId,
        );
      }
      additions.push(decision);
    }
    if (additions.length === 0) {
      return {
        ok: true,
        persistedCount: 0,
        idempotentCount,
        ...(safePersistence ? { fileIdentity: options.expectedFileIdentity } : {}),
      };
    }

    const updated = appendNodesToMarkdown(original, additions.map(serializeDecisionNode));
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
      persistedCount: additions.length,
      idempotentCount,
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
    batch = validateBatch(decisions);
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
