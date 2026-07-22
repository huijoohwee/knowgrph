import fs from "node:fs/promises";
import path from "node:path";

import {
  buildEvidence,
  compareStableStrings,
  KnowledgeGraphError,
  knowledgeGraphFailure,
  makeEdge,
  sha256,
  throwIfAborted,
} from "./contract.mjs";
import {
  discoverKnowledgeSources,
  resolveRealDirectory,
} from "./discovery.mjs";
import { parseKnowledgeSource, parserDescriptorForSource } from "./parsers.mjs";
import {
  buildKnowledgeGraphArtifact,
  fragmentFromArtifact,
  readKnowledgeGraphArtifact,
  readKnowledgeGraphArtifactIfPresent,
  writeKnowledgeGraphArtifactAtomic,
} from "./store.mjs";
import { explainKnowledgeGraphEdgeFromArtifact, queryKnowledgeGraph } from "./query.mjs";

export const KNOWLEDGE_GRAPH_TOOL_NAMES = Object.freeze({
  ingest: "knowgrph.knowledge_graph.ingest",
  query: "knowgrph.knowledge_graph.query",
  explainEdge: "knowgrph.knowledge_graph.explain_edge",
});

const RESULT_SCHEMAS = Object.freeze({
  ingest: "knowgrph-knowledge-graph-ingest/v1",
  query: "knowgrph-knowledge-graph-query/v1",
  explain_edge: "knowgrph-knowledge-graph-explain-edge/v1",
});

const RESOLVER_ID = "local-cross-source-resolver";
const RESOLVER_VERSION = "1.0.0";
const artifactIngestTails = new Map();

const success = (operation, payload) => ({ schema: RESULT_SCHEMAS[operation], ok: true, operation, ...payload });
const failure = (operation, error) => ({ schema: RESULT_SCHEMAS[operation], operation, ...knowledgeGraphFailure(error) });

function assertExpectedDigest(args, artifact) {
  const expected = String(args.expectedDigest || "").trim();
  if (!expected) {
    throw new KnowledgeGraphError("expected_digest_required", "expectedDigest is required for knowledge graph reads.");
  }
  const actual = String(artifact?.metadata?.knowledgeGraph?.digest || "");
  if (expected !== actual) {
    throw new KnowledgeGraphError("stale_artifact_digest", "Knowledge graph artifact digest does not match the caller's expected digest.", { expectedDigest: expected, actualDigest: actual });
  }
}

function pathIsInside(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveAllowedRoots(deps) {
  const roots = [deps.knowgrphRoot, ...(Array.isArray(deps.allowedRoots) ? deps.allowedRoots : [])].filter(Boolean);
  const resolved = [];
  for (const root of roots) {
    const real = await resolveRealDirectory(root);
    if (!resolved.includes(real)) resolved.push(real);
  }
  if (!resolved.length) throw new KnowledgeGraphError("allowed_roots_required", "At least one host-owned allowed root is required.");
  return resolved;
}

async function assertExistingPathAllowed(candidatePath, allowedRoots, code = "path_outside_allowed_roots") {
  const real = await fs.realpath(candidatePath).catch(() => null);
  if (!real || !allowedRoots.some((root) => pathIsInside(real, root))) {
    throw new KnowledgeGraphError(code, `Path is outside the host-owned allowed roots: ${candidatePath}`);
  }
  return real;
}

async function resolveThroughExistingAncestor(candidatePath) {
  let current = path.resolve(candidatePath);
  const tail = [];
  while (true) {
    try {
      const stat = await fs.stat(current);
      if (stat.isDirectory() || stat.isFile()) {
        const real = await fs.realpath(current);
        return path.resolve(real, ...tail);
      }
    } catch { /* continue to the parent */ }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(current, ...tail);
    tail.unshift(path.basename(current));
    current = parent;
  }
}

async function resolveHostOutputRoot(deps) {
  const configured = path.resolve(deps.outputRoot || path.join(deps.knowgrphRoot, "data", "outputs", "knowledge-graph"));
  return resolveThroughExistingAncestor(configured);
}

async function assertOutputPathAllowed(outputPath, outputRoot) {
  const resolved = await resolveThroughExistingAncestor(outputPath);
  if (!pathIsInside(resolved, outputRoot)) {
    throw new KnowledgeGraphError("output_outside_output_root", `Output path is outside the host-owned output root: ${resolved}`);
  }
  return resolved;
}

function defaultArtifactPath(outputRoot, rootPath) {
  const rootName = path.basename(rootPath).replace(/[^A-Za-z0-9._-]+/g, "-") || "corpus";
  return path.join(outputRoot, `${rootName}-${sha256(rootPath).slice(0, 12)}.json`);
}

function exactOutputExclusion(rootPath, outputPath) {
  if (!pathIsInside(outputPath, rootPath)) return [];
  const relative = path.relative(rootPath, outputPath).replaceAll("\\", "/");
  return relative ? [relative] : [];
}

async function resolveIngestPaths(args, deps) {
  if (!String(args.rootPath || "").trim()) {
    throw new KnowledgeGraphError("root_path_required", "rootPath is required.");
  }
  const allowedRoots = await resolveAllowedRoots(deps);
  const requestedRoot = path.resolve(String(args.rootPath));
  const rootPath = await assertExistingPathAllowed(requestedRoot, allowedRoots, "root_outside_allowed_roots");
  const outputRoot = await resolveHostOutputRoot(deps);
  if (outputRoot === rootPath) {
    throw new KnowledgeGraphError("output_root_matches_input_root", "The generated-output root must not equal the indexed corpus root.");
  }
  const outputCandidate = args.outputPath
    ? path.isAbsolute(String(args.outputPath))
      ? path.resolve(String(args.outputPath))
      : path.resolve(outputRoot, String(args.outputPath))
    : defaultArtifactPath(outputRoot, rootPath);
  const artifactPath = await assertOutputPathAllowed(outputCandidate, outputRoot);
  return { rootPath, outputRoot, artifactPath };
}

async function serializeArtifactIngest(artifactPath, operation) {
  const previous = artifactIngestTails.get(artifactPath);
  let release;
  const tail = new Promise((resolve) => { release = resolve; });
  artifactIngestTails.set(artifactPath, tail);
  if (previous) await previous;
  try {
    return await operation();
  } finally {
    release();
    if (artifactIngestTails.get(artifactPath) === tail) artifactIngestTails.delete(artifactPath);
  }
}

function normalizedLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/^(?:["`\[])|(?:["`\]])$/g, "");
}

function buildCrossSourceResolutionEdges(fragments) {
  const nodes = [...fragments.values()].flatMap((fragment) => fragment.nodes);
  const edges = [...fragments.values()].flatMap((fragment) => fragment.edges);
  const sourceNodeByPath = new Map(nodes
    .filter((node) => node.type === "SourceFile")
    .map((node) => [String(node.properties?.["corpus:sourcePath"] || ""), node]));
  const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const derived = [];
  for (const dependency of nodes.filter((node) => node.type === "CodeDependency").sort((left, right) => compareStableStrings(left.id, right.id))) {
    const moduleName = String(dependency.properties?.["code:module"] || dependency.label || "");
    if (!moduleName.startsWith(".")) continue;
    const sourcePath = String(dependency.properties?.["corpus:sourcePath"] || "");
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), moduleName));
    if (!base || base === ".." || base.startsWith("../")) continue;
    const hasExtension = Boolean(path.posix.extname(base));
    const candidatePaths = hasExtension
      ? [base]
      : [...codeExtensions.map((extension) => `${base}${extension}`), ...codeExtensions.map((extension) => `${base}/index${extension}`)];
    const candidates = candidatePaths.map((candidatePath) => sourceNodeByPath.get(candidatePath)).filter(Boolean).sort((left, right) => compareStableStrings(left.id, right.id));
    if (!candidates.length) continue;
    const premiseEdges = edges.filter((edge) => edge.target === dependency.id && ["imports", "reexports"].includes(edge.label)).sort((left, right) => compareStableStrings(left.id, right.id));
    const premise = premiseEdges[0];
    const premiseProperties = premise?.properties || {};
    const ambiguous = candidates.length > 1;
    for (const target of candidates) {
      const evidence = buildEvidence({
        sourcePath,
        lineStart: premiseProperties["evidence:lineStart"],
        lineEnd: premiseProperties["evidence:lineEnd"],
        columnStart: premiseProperties["evidence:columnStart"],
        columnEnd: premiseProperties["evidence:columnEnd"],
        excerpt: premiseProperties["evidence:excerpt"] || moduleName,
        ruleId: "resolve.relative-code-import",
        explanation: ambiguous
          ? `Relative module ${moduleName} has ${candidates.length} local source candidates; ${target.label} is one ambiguous candidate.`
          : `Relative module ${moduleName} resolves to local source file ${target.label}.`,
        parserId: RESOLVER_ID,
        parserVersion: RESOLVER_VERSION,
        kind: ambiguous ? "ambiguous" : "inferred",
        confidence: ambiguous ? "low" : "high",
        premiseEdgeIds: premiseEdges.map((edge) => edge.id),
        candidateCount: candidates.length,
      });
      derived.push(makeEdge({ source: dependency.id, target: target.id, label: "resolvesToSource", evidence, anchor: `${dependency.id}:${target.id}` }));
    }
  }
  const tablesByName = new Map();
  for (const node of nodes) {
    if (node.type !== "SqlTable") continue;
    const full = normalizedLabel(node.properties?.["sql:qualifiedName"] || node.label);
    const short = full.split(".").at(-1);
    for (const key of new Set([full, short])) {
      if (!key) continue;
      tablesByName.set(key, [...(tablesByName.get(key) || []), node]);
    }
  }
  for (const candidates of tablesByName.values()) candidates.sort((left, right) => compareStableStrings(left.id, right.id));
  for (const reference of nodes.filter((node) => node.type === "SqlTableReference").sort((left, right) => compareStableStrings(left.id, right.id))) {
    const full = normalizedLabel(reference.properties?.["sql:qualifiedName"] || reference.label);
    const candidates = tablesByName.get(full) || tablesByName.get(full.split(".").at(-1)) || [];
    if (!candidates.length) continue;
    const sourcePath = String(reference.properties?.["corpus:sourcePath"] || "");
    const premiseEdges = edges.filter((edge) => edge.target === reference.id).sort((left, right) => compareStableStrings(left.id, right.id));
    const premiseEdgeIds = premiseEdges.map((edge) => edge.id);
    const premiseProperties = premiseEdges[0]?.properties || {};
    const ambiguous = candidates.length > 1;
    for (const target of candidates) {
      if (target.id === reference.id) continue;
      const evidence = buildEvidence({
        sourcePath,
        lineStart: reference.properties?.["corpus:lineStart"],
        lineEnd: reference.properties?.["corpus:lineEnd"],
        columnStart: reference.properties?.["corpus:columnStart"],
        columnEnd: reference.properties?.["corpus:columnEnd"],
        excerpt: premiseProperties["evidence:excerpt"] || reference.label,
        ruleId: "resolve.sql-table.exact-name",
        explanation: ambiguous
          ? `Reference ${reference.label} has ${candidates.length} exact-name table candidates; ${target.label} is one ambiguous candidate.`
          : `Reference ${reference.label} resolves to the single exact-name table ${target.label}.`,
        parserId: RESOLVER_ID,
        parserVersion: RESOLVER_VERSION,
        kind: ambiguous ? "ambiguous" : "inferred",
        confidence: ambiguous ? "low" : "high",
        premiseEdgeIds,
        candidateCount: candidates.length,
      });
      derived.push(makeEdge({ source: reference.id, target: target.id, label: "resolvesTo", evidence, anchor: `${reference.id}:${target.id}` }));
    }
  }
  return derived.sort((left, right) => compareStableStrings(left.id, right.id));
}

async function ingestOrThrow(args, deps, abortSignal, resolvedPaths = null) {
  throwIfAborted(abortSignal);
  const { rootPath, outputRoot, artifactPath } = resolvedPaths || await resolveIngestPaths(args, deps);
  const strict = args.strict !== false;
  const useCache = args.useCache !== false;
  let previousArtifact = null;
  const runDiagnostics = [];
  if (useCache) {
    try { previousArtifact = await readKnowledgeGraphArtifactIfPresent(artifactPath, { allowedRoot: outputRoot }); } catch (error) {
      if (strict) throw error;
      runDiagnostics.push({ code: "previous_artifact_ignored", sourcePath: "", message: error.message });
    }
  }
  const outputRootExclusion = pathIsInside(outputRoot, rootPath)
    ? `${path.relative(rootPath, outputRoot).replaceAll("\\", "/")}/**`
    : "";
  const discovered = await discoverKnowledgeSources({
    rootPath,
    include: args.include,
    exclude: [...(Array.isArray(args.exclude) ? args.exclude : []), ...(outputRootExclusion ? [outputRootExclusion] : [])],
    exactExcludedPaths: exactOutputExclusion(rootPath, artifactPath),
    maxFiles: args.maxFiles,
    maxFileBytes: args.maxFileBytes,
    maxTotalBytes: args.maxTotalBytes,
    abortSignal,
  });
  const previousEntries = new Map((previousArtifact?.manifest?.sources || []).map((entry) => [entry.sourcePath, entry]));
  const fragments = new Map();
  let reused = 0;
  let parsed = 0;
  for (const source of discovered.sources) {
    throwIfAborted(abortSignal);
    const descriptor = parserDescriptorForSource(source, deps);
    const previousEntry = previousEntries.get(source.relativePath);
    const reusable = useCache
      && source.kind !== "python"
      && previousEntry?.contentHash === source.contentHash
      && previousEntry?.parserId === descriptor.parserId
      && previousEntry?.parserVersion === descriptor.parserVersion
      ? fragmentFromArtifact(previousArtifact, previousEntry)
      : null;
    if (reusable) {
      fragments.set(source.relativePath, reusable);
      reused += 1;
      continue;
    }
    const fragment = await parseKnowledgeSource(source, { ...deps, abortSignal });
    fragments.set(source.relativePath, fragment);
    parsed += 1;
  }
  const fatalFragments = [...fragments.entries()].filter(([, fragment]) => (
    fragment.status === "error"
    || fragment.status === "partial"
    || (fragment.status === "pending" && typeof deps.pdfConverter === "function")
  ));
  if (strict && fatalFragments.length) {
    throw new KnowledgeGraphError("strict_ingest_incomplete", "Strict ingestion stopped before replacing the artifact because one or more parsers failed.", {
      sources: fatalFragments.map(([sourcePath]) => sourcePath).sort(),
      previousArtifactPreserved: Boolean(previousArtifact),
    });
  }
  const derivedEdges = buildCrossSourceResolutionEdges(fragments);
  const artifact = buildKnowledgeGraphArtifact({
    sources: discovered.sources,
    fragments,
    derivedEdges,
    diagnostics: [...discovered.diagnostics, ...runDiagnostics],
  });
  await writeKnowledgeGraphArtifactAtomic(artifactPath, artifact);
  const currentPaths = new Set(discovered.sources.map((source) => source.relativePath));
  const deleted = [...previousEntries.keys()].filter((sourcePath) => !currentPaths.has(sourcePath)).sort();
  return success("ingest", {
    artifactPath,
    digest: artifact.metadata.knowledgeGraph.digest,
    rootContentHash: artifact.metadata.knowledgeGraph.rootContentHash,
    graph: { nodes: artifact.nodes.length, edges: artifact.edges.length },
    sources: { total: discovered.sources.length, parsed, reused, deleted: deleted.length, deletedPaths: deleted },
    diagnostics: artifact.diagnostics,
    parserCoverage: artifact.metadata.knowledgeGraph.parserCoverage,
    retrieval: { mode: "lexical-graph", vectorStore: false },
    cost: { modelCalls: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
  });
}

export async function ingestKnowledgeGraph(args, deps = {}, options = {}) {
  try {
    const normalizedArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    const resolvedPaths = await resolveIngestPaths(normalizedArgs, deps);
    return await serializeArtifactIngest(
      resolvedPaths.artifactPath,
      () => ingestOrThrow(normalizedArgs, deps, options.abortSignal, resolvedPaths),
    );
  } catch (error) { return failure("ingest", error); }
}

export async function queryKnowledgeGraphArtifact(args, deps = {}, options = {}) {
  try {
    throwIfAborted(options.abortSignal);
    const outputRoot = await resolveHostOutputRoot(deps);
    const requestedPath = path.isAbsolute(String(args.artifactPath || ""))
      ? path.resolve(String(args.artifactPath || ""))
      : path.resolve(outputRoot, String(args.artifactPath || ""));
    const artifactPath = await assertExistingPathAllowed(requestedPath, [outputRoot], "artifact_outside_output_root");
    const artifact = await readKnowledgeGraphArtifact(artifactPath, { allowedRoot: outputRoot });
    assertExpectedDigest(args, artifact);
    return success("query", { artifactPath, ...queryKnowledgeGraph(artifact, args) });
  } catch (error) { return failure("query", error); }
}

export async function explainKnowledgeGraphEdge(args, deps = {}, options = {}) {
  try {
    throwIfAborted(options.abortSignal);
    const outputRoot = await resolveHostOutputRoot(deps);
    const requestedPath = path.isAbsolute(String(args.artifactPath || ""))
      ? path.resolve(String(args.artifactPath || ""))
      : path.resolve(outputRoot, String(args.artifactPath || ""));
    const artifactPath = await assertExistingPathAllowed(requestedPath, [outputRoot], "artifact_outside_output_root");
    const artifact = await readKnowledgeGraphArtifact(artifactPath, { allowedRoot: outputRoot });
    assertExpectedDigest(args, artifact);
    return success("explain_edge", { artifactPath, ...explainKnowledgeGraphEdgeFromArtifact(artifact, args.edgeId) });
  } catch (error) { return failure("explain_edge", error); }
}

export function createKnowledgeGraphRuntime({ knowgrphRoot, allowedRoots, outputRoot, pdfConverter = null, pdfConverterVersion = "pending", pythonBin = process.env.KNOWGRPH_PYTHON || "python3" }) {
  const deps = { knowgrphRoot: path.resolve(knowgrphRoot), allowedRoots, outputRoot, pdfConverter, pdfConverterVersion, pythonBin };
  return Object.freeze({
    ingest: (args, options) => ingestKnowledgeGraph(args, deps, options),
    query: (args, options) => queryKnowledgeGraphArtifact(args, deps, options),
    explainEdge: (args, options) => explainKnowledgeGraphEdge(args, deps, options),
    run: async (toolName, args = {}, options = {}) => {
      if (toolName === KNOWLEDGE_GRAPH_TOOL_NAMES.ingest) return ingestKnowledgeGraph(args, deps, options);
      if (toolName === KNOWLEDGE_GRAPH_TOOL_NAMES.query) return queryKnowledgeGraphArtifact(args, deps, options);
      if (toolName === KNOWLEDGE_GRAPH_TOOL_NAMES.explainEdge) return explainKnowledgeGraphEdge(args, deps, options);
      return failure("query", new KnowledgeGraphError("unknown_tool", `Unknown knowledge graph tool: ${String(toolName || "")}`));
    },
  });
}
