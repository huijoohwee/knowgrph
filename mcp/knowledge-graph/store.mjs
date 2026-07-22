import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  KnowledgeGraphError,
  KNOWLEDGE_GRAPH_CONTRACT_VERSION,
  KNOWLEDGE_GRAPH_SCHEMA_VERSION,
  compareStableStrings,
  computeKnowledgeGraphArtifactDigestBounded,
  sha256,
  sortGraphData,
  stableStringify,
  validateKnowledgeGraphArtifact,
} from "./contract.mjs";

export const DEFAULT_MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;
const ARTIFACT_DIGEST_RESERVE_BYTES = 1024;

const boundedArtifactMaxBytes = (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return DEFAULT_MAX_ARTIFACT_BYTES;
  return Math.min(number, DEFAULT_MAX_ARTIFACT_BYTES);
};

function pathIsInside(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const sameFileIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;

async function readStableArtifactText(artifactPath, { allowedRoot, maxBytes = DEFAULT_MAX_ARTIFACT_BYTES } = {}) {
  const artifactMaxBytes = boundedArtifactMaxBytes(maxBytes);
  let handle;
  try {
    handle = await fs.open(artifactPath, fsConstants.O_RDONLY | Number(fsConstants.O_NOFOLLOW || 0));
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) throw new KnowledgeGraphError("artifact_not_file", `Knowledge graph artifact is not a regular file: ${artifactPath}`);
    if (openedStat.size > artifactMaxBytes) throw new KnowledgeGraphError("artifact_too_large", `Knowledge graph artifact exceeds ${artifactMaxBytes} bytes.`);
    const realPath = await fs.realpath(artifactPath);
    const pathStat = await fs.stat(realPath);
    if ((allowedRoot && !pathIsInside(realPath, allowedRoot)) || !sameFileIdentity(openedStat, pathStat)) {
      throw new KnowledgeGraphError("artifact_path_unstable", "Knowledge graph artifact changed or escaped while it was opened.");
    }
    const bytes = Buffer.alloc(openedStat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!chunk.bytesRead) break;
      offset += chunk.bytesRead;
    }
    const extra = Buffer.alloc(1);
    const extraRead = await handle.read(extra, 0, 1, openedStat.size);
    const closedStat = await handle.stat();
    if (offset !== bytes.length || extraRead.bytesRead || !sameFileIdentity(openedStat, closedStat)
      || openedStat.size !== closedStat.size || openedStat.mtimeMs !== closedStat.mtimeMs) {
      throw new KnowledgeGraphError("artifact_changed_during_read", "Knowledge graph artifact changed while it was being read.");
    }
    return bytes.toString("utf8");
  } catch (error) {
    if (error instanceof KnowledgeGraphError) throw error;
    if (error?.code === "ENOENT") throw new KnowledgeGraphError("artifact_not_found", `Knowledge graph artifact was not found: ${artifactPath}`);
    throw new KnowledgeGraphError("artifact_read_failed", "Knowledge graph artifact could not be read safely.", { causeCode: String(error?.code || "read_failed") });
  } finally {
    await handle?.close().catch(() => {});
  }
}

function sortDiagnostics(diagnostics) {
  const seen = new Set();
  return (diagnostics || [])
    .filter((diagnostic) => diagnostic && typeof diagnostic === "object")
    .map((diagnostic) => ({
      code: String(diagnostic.code || "diagnostic"),
      sourcePath: String(diagnostic.sourcePath || ""),
      message: String(diagnostic.message || ""),
      ...(Number.isInteger(diagnostic.lineStart) ? { lineStart: diagnostic.lineStart } : {}),
      ...(Number.isInteger(diagnostic.columnStart) ? { columnStart: diagnostic.columnStart } : {}),
    }))
    .sort((left, right) => compareStableStrings(`${left.sourcePath}\0${left.code}\0${left.message}`, `${right.sourcePath}\0${right.code}\0${right.message}`))
    .filter((diagnostic) => {
      const key = JSON.stringify(diagnostic);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function fragmentFromArtifact(artifact, manifestEntry) {
  if (!artifact || !manifestEntry) return null;
  const nodeById = new Map((artifact.nodes || []).map((node) => [node.id, node]));
  const edgeById = new Map((artifact.edges || []).map((edge) => [edge.id, edge]));
  const nodes = (manifestEntry.nodeIds || []).map((id) => nodeById.get(id)).filter(Boolean);
  const edges = (manifestEntry.edgeIds || []).map((id) => edgeById.get(id)).filter(Boolean);
  if (nodes.length !== (manifestEntry.nodeIds || []).length || edges.length !== (manifestEntry.edgeIds || []).length) return null;
  return {
    parserId: manifestEntry.parserId,
    parserVersion: manifestEntry.parserVersion,
    nodes,
    edges,
    diagnostics: manifestEntry.diagnostics || [],
    status: manifestEntry.status,
  };
}

export function buildKnowledgeGraphArtifact({ sources, fragments, derivedEdges = [], diagnostics = [] }) {
  const allNodes = [];
  const allEdges = [];
  const sourceEntries = [];
  const parserCoverage = new Map();
  for (const source of sources) {
    const fragment = fragments.get(source.relativePath);
    if (!fragment) continue;
    allNodes.push(...fragment.nodes);
    allEdges.push(...fragment.edges);
    parserCoverage.set(fragment.parserId, (parserCoverage.get(fragment.parserId) || 0) + 1);
    sourceEntries.push({
      sourcePath: source.relativePath,
      contentHash: source.contentHash,
      byteSize: source.byteSize,
      kind: source.kind,
      status: fragment.status,
      parserId: fragment.parserId,
      parserVersion: fragment.parserVersion,
      nodeIds: fragment.nodes.map((node) => node.id).sort(),
      edgeIds: fragment.edges.map((edge) => edge.id).sort(),
      diagnostics: sortDiagnostics(fragment.diagnostics),
    });
  }
  allEdges.push(...derivedEdges);
  sourceEntries.sort((left, right) => compareStableStrings(left.sourcePath, right.sourcePath));
  const graph = sortGraphData({
    context: "knowgrph-knowledge-graph",
    type: "Graph",
    nodes: allNodes,
    edges: allEdges,
  });
  const rootContentHash = sha256(sourceEntries.map((entry) => `${entry.sourcePath}\0${entry.contentHash}\0${entry.parserId}\0${entry.parserVersion}`).join("\n"));
  const knowledgeGraphMetadata = {
    schemaVersion: KNOWLEDGE_GRAPH_SCHEMA_VERSION,
    contractVersion: KNOWLEDGE_GRAPH_CONTRACT_VERSION,
    retrievalMode: "lexical-graph",
    vectorStore: false,
    modelCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: 0,
    rootContentHash,
    parserCoverage: Object.fromEntries([...parserCoverage.entries()].sort(([left], [right]) => compareStableStrings(left, right))),
  };
  const artifactWithoutDigest = {
    ...graph,
    metadata: { knowledgeGraph: knowledgeGraphMetadata },
    manifest: { version: 1, sources: sourceEntries },
    diagnostics: sortDiagnostics([...diagnostics, ...sourceEntries.flatMap((entry) => entry.diagnostics)]),
  };
  const { digest } = computeKnowledgeGraphArtifactDigestBounded(
    artifactWithoutDigest,
    DEFAULT_MAX_ARTIFACT_BYTES - ARTIFACT_DIGEST_RESERVE_BYTES,
  );
  const artifact = {
    ...artifactWithoutDigest,
    metadata: { knowledgeGraph: { ...knowledgeGraphMetadata, digest } },
  };
  const validation = validateKnowledgeGraphArtifact(artifact);
  if (!validation.ok) {
    throw new KnowledgeGraphError("artifact_validation_failed", "Knowledge graph artifact validation failed.", { errors: validation.errors });
  }
  return artifact;
}

export async function readKnowledgeGraphArtifact(artifactPath, options = {}) {
  const raw = await readStableArtifactText(artifactPath, options);
  let artifact;
  try { artifact = JSON.parse(raw); } catch { throw new KnowledgeGraphError("artifact_invalid_json", `Knowledge graph artifact is not valid JSON: ${artifactPath}`); }
  const validation = validateKnowledgeGraphArtifact(artifact);
  if (!validation.ok) throw new KnowledgeGraphError("artifact_invalid", `Knowledge graph artifact failed validation: ${artifactPath}`, { errors: validation.errors });
  return artifact;
}

export async function readKnowledgeGraphArtifactIfPresent(artifactPath, options = {}) {
  try { return await readKnowledgeGraphArtifact(artifactPath, options); } catch (error) {
    if (error instanceof KnowledgeGraphError && error.code === "artifact_not_found") return null;
    throw error;
  }
}

export async function writeKnowledgeGraphArtifactAtomic(artifactPath, artifact, { maxBytes = DEFAULT_MAX_ARTIFACT_BYTES } = {}) {
  const artifactMaxBytes = boundedArtifactMaxBytes(maxBytes);
  const serialized = stableStringify(artifact);
  const artifactBytes = Buffer.byteLength(serialized, "utf8");
  if (artifactBytes > artifactMaxBytes) {
    throw new KnowledgeGraphError("artifact_too_large", `Knowledge graph artifact exceeds ${artifactMaxBytes} bytes.`, {
      actualBytes: artifactBytes,
      maxBytes: artifactMaxBytes,
      previousArtifactPreserved: true,
    });
  }
  const directory = path.dirname(artifactPath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(directory, `.${path.basename(artifactPath)}.${process.pid}.${sha256(`${artifactPath}:${process.hrtime.bigint()}`).slice(0, 12)}.tmp`);
  try {
    await fs.writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await fs.rename(temporaryPath, artifactPath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
