import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

import {
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES,
  buildKnowgrphLocalMcpToolDefinitions,
} from "../local-tool-contract.js";
import { KNOWLEDGE_GRAPH_INVOCATIONS } from "../knowledge-graph-tool-contract.js";

const expected = [
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphIngest,
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
  KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphExplainEdge,
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("local MCP exposes one deterministic knowledge-graph tool family", () => {
  const byName = new Map(buildKnowgrphLocalMcpToolDefinitions().map((tool) => [tool.name, tool]));
  for (const name of expected) assert.ok(byName.has(name), `missing ${name}`);

  const ingest = byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphIngest);
  const query = byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery);
  const explain = byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphExplainEdge);
  assert.equal(ingest.annotations.idempotentHint, true);
  assert.equal(ingest.annotations.destructiveHint, true);
  assert.equal(ingest.annotations.openWorldHint, false);
  assert.equal(query.annotations.readOnlyHint, true);
  assert.equal(explain.annotations.readOnlyHint, true);
  assert.deepEqual(ingest.inputSchema.required, ["rootPath"]);
  assert.deepEqual(query.inputSchema.required, ["artifactPath", "expectedDigest", "mode"]);
  assert.deepEqual(explain.inputSchema.required, ["artifactPath", "expectedDigest", "edgeId"]);
});

test("tool descriptions and invocation packets make the zero-vector boundary explicit", () => {
  const definitions = buildKnowgrphLocalMcpToolDefinitions()
    .filter((tool) => expected.includes(tool.name));
  const contractText = JSON.stringify(definitions);
  assert.match(contractText, /no vector store/i);
  assert.match(contractText, /no network access/i);
  assert.equal(KNOWLEDGE_GRAPH_INVOCATIONS.ingest.action, "/knowledge.graph.ingest");
  assert.equal(KNOWLEDGE_GRAPH_INVOCATIONS.query.action, "/knowledge.graph.query");
  assert.equal(KNOWLEDGE_GRAPH_INVOCATIONS.explain.action, "/knowledge.graph.explain");
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.ingest.semantics, ["#knowledge-graph", "#mcp", "#runtime-ready"]);
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.query.semantics, ["#knowledge-graph", "#mcp", "#vcc"]);
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.explain.semantics, ["#knowledge-graph", "#mcp", "#vcc"]);
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.ingest.bindings, ["@working-directory", "@knowledge-graph", "@operator", "@runtime-proof"]);
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.query.bindings, ["@knowledge-graph", "@runtime-proof"]);
  assert.deepEqual(KNOWLEDGE_GRAPH_INVOCATIONS.explain.bindings, ["@knowledge-graph", "@runtime-proof"]);
});

test("schemas require digest fencing, exact invocation tuples, and typed error details", () => {
  const ajv = new Ajv({ strict: false });
  const byName = new Map(buildKnowgrphLocalMcpToolDefinitions().map((tool) => [tool.name, tool]));
  const query = byName.get(KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery);
  const validateInput = ajv.compile(query.inputSchema);
  const validInput = {
    artifactPath: "graph.json",
    expectedDigest: "a".repeat(64),
    mode: "summary",
    invocation: KNOWLEDGE_GRAPH_INVOCATIONS.query,
  };
  assert.equal(validateInput(validInput), true, JSON.stringify(validateInput.errors));
  assert.equal(validateInput({ ...validInput, expectedDigest: undefined }), false);
  assert.equal(validateInput({
    ...validInput,
    invocation: { ...KNOWLEDGE_GRAPH_INVOCATIONS.query, semantics: ["#knowledge-graph"] },
  }), false);

  const validateOutput = ajv.compile(query.outputSchema);
  assert.equal(validateOutput({
    schema: "knowgrph-knowledge-graph-query/v1",
    ok: false,
    operation: "query",
    error: { code: "artifact_invalid", message: "invalid", details: { errors: ["digest mismatch"] } },
  }), true, JSON.stringify(validateOutput.errors));
});

test("package manifests contain no Graphify or vector-store runtime dependency", () => {
  const manifests = ["package.json", "mcp/package.json", "package-lock.json"]
    .map((file) => JSON.parse(readFileSync(path.join(repoRoot, file), "utf8")));
  const names = new Set();
  for (const manifest of manifests) {
    for (const record of [manifest, ...Object.values(manifest.packages || {})]) {
      for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
        for (const name of Object.keys(record?.[field] || {})) names.add(name);
      }
    }
  }
  const forbidden = /(?:graphify|chromadb|pinecone|weaviate|qdrant|milvus|lancedb|pgvector|faiss)/i;
  assert.deepEqual([...names].filter((name) => forbidden.test(name)), []);
});
