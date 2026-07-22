import { compareStableStrings, KnowledgeGraphError } from "./contract.mjs";

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const normalized = (value) => String(value || "").trim().toLowerCase();
const tokenize = (value) => normalized(value).slice(0, 4000).split(/[^\p{L}\p{N}_.$/@-]+/u).filter(Boolean).slice(0, 64);

const boundedInteger = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
};

function clippedJson(value, maxLength = 2000) {
  try { return JSON.stringify(value).slice(0, maxLength); } catch { return ""; }
}

function nodeSearchText(node) {
  return [node.id, node.label, node.type, clippedJson(node.properties), clippedJson(node.metadata, 500)].join(" ").toLowerCase();
}

function edgeSearchText(edge, nodeById) {
  return [
    edge.id,
    edge.label,
    nodeById.get(edge.source)?.label,
    nodeById.get(edge.target)?.label,
    edge.properties?.["evidence:explanation"],
    edge.properties?.["evidence:sourcePath"],
  ].join(" ").toLowerCase();
}

function lexicalScore(text, terms, exactLabel = "") {
  if (!terms.length) return 0;
  let score = 0;
  const normalizedLabel = normalized(exactLabel);
  for (const term of terms) {
    if (normalizedLabel === term) score += 100;
    else if (normalizedLabel.startsWith(term)) score += 30;
    else if (normalizedLabel.includes(term)) score += 15;
    if (text.includes(term)) score += term.length >= 4 ? 5 : 2;
  }
  return score;
}

function graphAccess(artifact) {
  const nodes = Array.isArray(artifact?.nodes) ? artifact.nodes : [];
  const edges = Array.isArray(artifact?.edges) ? artifact.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  return { nodes, edges, nodeById, edgeById };
}

function evidenceForEdge(edge) {
  const properties = asRecord(edge?.properties);
  return {
    edgeId: edge.id,
    sourcePath: String(properties["evidence:sourcePath"] || ""),
    lineStart: Number(properties["evidence:lineStart"] || 1),
    lineEnd: Number(properties["evidence:lineEnd"] || properties["evidence:lineStart"] || 1),
    columnStart: Number(properties["evidence:columnStart"] || 1),
    columnEnd: Number(properties["evidence:columnEnd"] || properties["evidence:columnStart"] || 1),
    excerpt: String(properties["evidence:excerpt"] || ""),
    excerptHash: String(properties["evidence:excerptHash"] || ""),
    kind: String(properties["evidence:kind"] || ""),
    confidence: String(properties["evidence:confidence"] || ""),
    ruleId: String(properties["evidence:ruleId"] || ""),
    explanation: String(properties["evidence:explanation"] || ""),
  };
}

function rankedNodes(access, query, limit) {
  const terms = tokenize(query);
  return access.nodes
    .map((node) => ({ node, score: lexicalScore(nodeSearchText(node), terms, node.label) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || compareStableStrings(left.node.id, right.node.id))
    .slice(0, limit);
}

function rankedEdges(access, query, limit) {
  const terms = tokenize(query);
  return access.edges
    .map((edge) => ({ edge, score: lexicalScore(edgeSearchText(edge, access.nodeById), terms, edge.label) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || compareStableStrings(left.edge.id, right.edge.id))
    .slice(0, limit);
}

function resolveNode(access, selector) {
  const value = String(selector || "").trim().slice(0, 1000);
  if (!value) throw new KnowledgeGraphError("node_selector_required", "A node id or lexical selector is required.");
  const byId = access.nodeById.get(value);
  if (byId) return { node: byId, candidates: [byId.id], basis: "id" };
  const exact = access.nodes
    .filter((node) => normalized(node.label) === normalized(value))
    .sort((left, right) => {
      const leftReference = /Reference$/.test(String(left.type || "")) ? 1 : 0;
      const rightReference = /Reference$/.test(String(right.type || "")) ? 1 : 0;
      return leftReference - rightReference || compareStableStrings(left.id, right.id);
    });
  if (exact.length) return { node: exact[0], candidates: exact.map((node) => node.id), basis: exact.length === 1 ? "exact-label" : "ambiguous-exact-label" };
  const ranked = rankedNodes(access, value, 8);
  if (!ranked.length) throw new KnowledgeGraphError("node_not_found", `No graph node matches ${value}.`);
  return { node: ranked[0].node, candidates: ranked.map((entry) => entry.node.id), basis: "lexical" };
}

function allowedEdge(edge, edgeLabels) {
  return !edgeLabels || edgeLabels.has(String(edge.label || ""));
}

function nextStep(edge, currentNodeId, direction) {
  if ((direction === "outgoing" || direction === "both") && edge.source === currentNodeId) return edge.target;
  if ((direction === "incoming" || direction === "both") && edge.target === currentNodeId) return edge.source;
  return "";
}

function adjacencyFor(access, direction, edgeLabels) {
  const adjacency = new Map();
  for (const edge of access.edges) {
    if (!allowedEdge(edge, edgeLabels)) continue;
    if (direction === "outgoing" || direction === "both") adjacency.set(edge.source, [...(adjacency.get(edge.source) || []), edge]);
    if (direction === "incoming" || direction === "both") adjacency.set(edge.target, [...(adjacency.get(edge.target) || []), edge]);
  }
  for (const list of adjacency.values()) list.sort((left, right) => compareStableStrings(left.id, right.id));
  return adjacency;
}

function shortestPath(access, startNodeId, targetNodeId, { direction, edgeLabels, maxDepth }) {
  const adjacency = adjacencyFor(access, direction, edgeLabels);
  const queue = [{ nodeId: startNodeId, nodeIds: [startNodeId], edgeIds: [] }];
  const visited = new Set([startNodeId]);
  let depthLimited = false;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.nodeId === targetNodeId) return { path: current, depthLimited: false };
    if (current.edgeIds.length >= maxDepth) {
      if ((adjacency.get(current.nodeId) || []).some((edge) => {
        const nextNodeId = nextStep(edge, current.nodeId, direction);
        return nextNodeId && !visited.has(nextNodeId);
      })) depthLimited = true;
      continue;
    }
    for (const edge of adjacency.get(current.nodeId) || []) {
      const nextNodeId = nextStep(edge, current.nodeId, direction);
      if (!nextNodeId || visited.has(nextNodeId)) continue;
      visited.add(nextNodeId);
      queue.push({ nodeId: nextNodeId, nodeIds: [...current.nodeIds, nextNodeId], edgeIds: [...current.edgeIds, edge.id] });
    }
  }
  return { path: null, depthLimited };
}

function traverseNeighborhood(access, startNodeId, { direction, edgeLabels, maxDepth, limit }) {
  const adjacency = adjacencyFor(access, direction, edgeLabels);
  const nodeIds = new Set([startNodeId]);
  const edgeIds = [];
  const seenEdgeIds = new Set();
  const queue = [{ nodeId: startNodeId, depth: 0 }];
  let depthLimited = false;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.depth >= maxDepth) {
      if ((adjacency.get(current.nodeId) || []).some((edge) => !seenEdgeIds.has(edge.id))) depthLimited = true;
      continue;
    }
    for (const edge of adjacency.get(current.nodeId) || []) {
      if (seenEdgeIds.has(edge.id)) continue;
      if (edgeIds.length >= limit) {
        return { nodeIds: [...nodeIds], edgeIds, limitTruncated: true, depthLimited };
      }
      seenEdgeIds.add(edge.id);
      edgeIds.push(edge.id);
      const nextNodeId = nextStep(edge, current.nodeId, direction);
      if (nextNodeId && !nodeIds.has(nextNodeId)) {
        nodeIds.add(nextNodeId);
        queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
      }
    }
  }
  return { nodeIds: [...nodeIds], edgeIds, limitTruncated: false, depthLimited };
}

function baseResult(artifact, mode) {
  return {
    mode,
    digest: artifact.metadata.knowledgeGraph.digest,
    retrieval: { mode: "lexical-graph", vectorStore: false },
    cost: { modelCalls: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
  };
}

function summarize(access, artifact) {
  const countBy = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()].sort(([left], [right]) => compareStableStrings(left, right)));
  const degree = new Map(access.nodes.map((node) => [node.id, 0]));
  for (const edge of access.edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  const connected = access.nodes
    .map((node) => ({ id: node.id, label: node.label, type: node.type, degree: degree.get(node.id) || 0 }))
    .sort((left, right) => right.degree - left.degree || compareStableStrings(left.id, right.id))
    .slice(0, 20);
  return {
    ...baseResult(artifact, "summary"),
    graph: { nodes: access.nodes.length, edges: access.edges.length },
    nodeTypes: countBy(access.nodes.map((node) => String(node.type || "Entity"))),
    edgeLabels: countBy(access.edges.map((edge) => String(edge.label || "relatedTo"))),
    sources: artifact.manifest?.sources?.length || 0,
    parserCoverage: artifact.metadata.knowledgeGraph.parserCoverage || {},
    diagnostics: artifact.diagnostics || [],
    mostConnected: connected,
    completeness: { complete: true, truncated: false, reason: "full_graph_summary" },
  };
}

export function queryKnowledgeGraph(artifact, args = {}) {
  const access = graphAccess(artifact);
  const mode = String(args.mode || "search");
  const limit = boundedInteger(args.limit, 20, 1, 200);
  const maxDepth = boundedInteger(args.maxDepth, 3, 0, 12);
  const edgeLabels = Array.isArray(args.edgeLabels) && args.edgeLabels.length
    ? new Set(args.edgeLabels.slice(0, 64).map((value) => String(value).slice(0, 512)))
    : null;
  if (mode === "summary") return summarize(access, artifact);
  if (mode === "search") {
    const query = String(args.query || "").trim().slice(0, 4000);
    if (!query) throw new KnowledgeGraphError("query_required", "query is required for search mode.");
    const rankedNodeEntries = rankedNodes(access, query, limit + 1);
    const rankedEdgeEntries = rankedEdges(access, query, limit + 1);
    const nodesTruncated = rankedNodeEntries.length > limit;
    const edgesTruncated = rankedEdgeEntries.length > limit;
    const nodes = rankedNodeEntries.slice(0, limit).map(({ node, score }) => ({ score, node }));
    const edges = rankedEdgeEntries.slice(0, limit).map(({ edge, score }) => ({ score, edge, evidence: evidenceForEdge(edge) }));
    const truncated = nodesTruncated || edgesTruncated;
    return {
      ...baseResult(artifact, mode),
      query,
      results: { nodes, edges },
      citations: edges.map((entry) => entry.evidence),
      completeness: {
        complete: !truncated,
        truncated,
        reason: truncated ? "result_limit" : "all_lexical_matches",
        limit,
        nodesTruncated,
        edgesTruncated,
      },
    };
  }
  if (mode === "path") {
    const start = resolveNode(access, args.from);
    const target = resolveNode(access, args.to);
    const direction = ["outgoing", "incoming", "both"].includes(args.direction) ? args.direction : "both";
    const pathSearch = shortestPath(access, start.node.id, target.node.id, { direction, edgeLabels, maxDepth });
    const path = pathSearch.path;
    const edges = (path?.edgeIds || []).map((id) => access.edgeById.get(id)).filter(Boolean);
    return {
      ...baseResult(artifact, mode),
      found: Boolean(path),
      direction,
      resolution: { from: { id: start.node.id, basis: start.basis, candidates: start.candidates }, to: { id: target.node.id, basis: target.basis, candidates: target.candidates } },
      path: path ? { nodeIds: path.nodeIds, edgeIds: path.edgeIds, nodes: path.nodeIds.map((id) => access.nodeById.get(id)), edges } : null,
      citations: edges.map(evidenceForEdge),
      completeness: {
        complete: Boolean(path) || !pathSearch.depthLimited,
        truncated: !path && pathSearch.depthLimited,
        reason: path ? "shortest_path_found" : pathSearch.depthLimited ? "max_depth" : "no_path",
        maxDepth,
      },
    };
  }
  if (mode === "neighbors" || mode === "impact") {
    const start = resolveNode(access, args.nodeId || args.from || args.query);
    const direction = ["outgoing", "incoming", "both"].includes(args.direction)
      ? args.direction
      : mode === "impact" ? "incoming" : "both";
    const traversal = traverseNeighborhood(access, start.node.id, { direction, edgeLabels, maxDepth, limit });
    const edges = traversal.edgeIds.map((id) => access.edgeById.get(id)).filter(Boolean);
    return {
      ...baseResult(artifact, mode),
      direction,
      resolution: { id: start.node.id, basis: start.basis, candidates: start.candidates },
      traversal: { ...traversal, nodes: traversal.nodeIds.map((id) => access.nodeById.get(id)), edges },
      citations: edges.map(evidenceForEdge),
      completeness: {
        complete: !traversal.limitTruncated && !traversal.depthLimited,
        truncated: traversal.limitTruncated || traversal.depthLimited,
        reason: traversal.limitTruncated ? "result_limit" : traversal.depthLimited ? "max_depth" : "full_neighborhood",
        limit,
        maxDepth,
      },
    };
  }
  throw new KnowledgeGraphError("query_mode_invalid", `Unsupported knowledge graph query mode: ${mode}`);
}

export function explainKnowledgeGraphEdgeFromArtifact(artifact, edgeIdRaw) {
  const access = graphAccess(artifact);
  const edgeId = String(edgeIdRaw || "").trim();
  const edge = access.edgeById.get(edgeId);
  if (!edge) throw new KnowledgeGraphError("edge_not_found", `Knowledge graph edge was not found: ${edgeId}`);
  const properties = asRecord(edge.properties);
  return {
    digest: artifact.metadata.knowledgeGraph.digest,
    edge,
    source: access.nodeById.get(edge.source),
    target: access.nodeById.get(edge.target),
    evidence: {
      kind: properties["evidence:kind"],
      ruleId: properties["evidence:ruleId"],
      explanation: properties["evidence:explanation"],
      parserId: properties["evidence:parserId"],
      parserVersion: properties["evidence:parserVersion"],
      sourcePath: properties["evidence:sourcePath"],
      sourceSpan: {
        lineStart: properties["evidence:lineStart"],
        lineEnd: properties["evidence:lineEnd"],
        columnStart: properties["evidence:columnStart"],
        columnEnd: properties["evidence:columnEnd"],
      },
      excerpt: properties["evidence:excerpt"],
      excerptHash: properties["evidence:excerptHash"],
      confidence: properties["evidence:confidence"],
      premiseEdgeIds: properties["evidence:premiseEdgeIds"] || [],
      candidateCount: properties["evidence:candidateCount"] ?? 1,
    },
    retrieval: { mode: "direct-edge-id", vectorStore: false },
    cost: { modelCalls: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
  };
}
