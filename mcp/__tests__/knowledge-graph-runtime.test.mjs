import assert from "node:assert/strict";
import { constants as bufferConstants } from "node:buffer";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compareStableStrings,
  computeKnowledgeGraphArtifactDigestBounded,
  EVIDENCE_FIELDS,
  sha256,
  validateKnowledgeGraphArtifact,
} from "../knowledge-graph/contract.mjs";
import {
  createKnowledgeGraphRuntime,
  KNOWLEDGE_GRAPH_TOOL_NAMES,
} from "../knowledge-graph/runtime.mjs";
import { DEFAULT_MAX_ARTIFACT_BYTES, writeKnowledgeGraphArtifactAtomic } from "../knowledge-graph/store.mjs";
import { parseSqlSource } from "../knowledge-graph/sql-parser.mjs";

async function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
  return target;
}

async function createFixture(t, { withPdfConverter = true } = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "knowgrph-kg-runtime-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const knowgrphRoot = path.join(base, "host");
  const corpusRoot = path.join(base, "corpus");
  const outputRoot = path.join(knowgrphRoot, "outputs");
  await fs.mkdir(knowgrphRoot, { recursive: true });
  await fs.mkdir(corpusRoot, { recursive: true });
  await writeFile(corpusRoot, "src/db.ts", "export function load() { return 1; }\nexport function x() { return 2; }\n");
  await writeFile(corpusRoot, "src/app.ts", [
    'import { load } from "./db";',
    "class Base {}",
    "export class Repo extends Base { run() { return load(); } }",
    "",
  ].join("\n"));
  await writeFile(corpusRoot, "lib.py", [
    "import math",
    "from . import sibling",
    "class Service:",
    "    def run(self):",
    "        return math.sqrt(4)",
    "",
  ].join("\n"));
  await writeFile(corpusRoot, "sql/accounts.sql", [
    "CREATE TABLE accounts (",
    "  id INTEGER PRIMARY KEY",
    ");",
    "",
  ].join("\n"));
  await writeFile(corpusRoot, "sql/users.sql", [
    "CREATE TABLE users (",
    "  id INTEGER PRIMARY KEY,",
    "  account_id INTEGER REFERENCES accounts(id)",
    ");",
    "",
  ].join("\n"));
  await writeFile(corpusRoot, "README.md", "# Corpus\n## Schema\n[Accounts](sql/accounts.sql)\n");
  await writeFile(corpusRoot, "config.json", '{"database":{"host":"local","password":"redacted-at-ingest"},"credentials":{"value":"nested-json-secret"},"databaseUrl":"postgres://alice:unknown-json-secret@db.local/app"}\n');
  await writeFile(corpusRoot, "wrangler.toml", 'name = "fixture"\n[vars]\nMODE = "test"\n[credentials]\nvalue = "nested-toml-secret"\n');
  await writeFile(corpusRoot, ".env", "DATABASE_URL=postgres://alice:unknown-env-secret@db.local/app\n");
  await writeFile(corpusRoot, "Dockerfile", "FROM node:22\nENV SERVICE_URL=https://alice:unknown-docker-secret@example.test\nRUN echo unknown-run-secret\n");
  await writeFile(corpusRoot, "paper.pdf", Buffer.from("%PDF-1.4\nlocal fixture\n%%EOF\n"));
  await writeFile(corpusRoot, "blob.bin", Buffer.from([0, 1, 2, 3]));

  let pdfCalls = 0;
  const pdfConverter = withPdfConverter
    ? async ({ sourcePath, bytes }) => {
      pdfCalls += 1;
      assert.equal(sourcePath, "paper.pdf");
      assert.ok(bytes.length > 0);
      return "# Research\n## Page 1\nDeterministic PDF body sentinel 7f91\n[Schema](sql/accounts.sql)\n";
    }
    : null;
  const runtime = createKnowledgeGraphRuntime({
    knowgrphRoot,
    allowedRoots: [corpusRoot],
    outputRoot,
    pdfConverter,
    pdfConverterVersion: withPdfConverter ? "fixture-v1" : "pending",
  });
  return { base, knowgrphRoot, corpusRoot, outputRoot, runtime, pdfCalls: () => pdfCalls };
}

async function ingestFixture(fixture, outputPath = "graph.json") {
  const result = await fixture.runtime.run(KNOWLEDGE_GRAPH_TOOL_NAMES.ingest, {
    rootPath: fixture.corpusRoot,
    outputPath,
    strict: true,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}

test("deterministic ingest emits auditable GraphData and reuses unchanged fragments", async (t) => {
  const fixture = await createFixture(t);
  const first = await ingestFixture(fixture);
  assert.equal(first.schema, "knowgrph-knowledge-graph-ingest/v1");
  assert.equal(first.operation, "ingest");
  assert.equal(first.retrieval.vectorStore, false);
  assert.equal(first.cost.modelCalls, 0);
  assert.equal(fixture.pdfCalls(), 1);

  const firstRaw = await fs.readFile(first.artifactPath, "utf8");
  const artifact = JSON.parse(firstRaw);
  assert.deepEqual(validateKnowledgeGraphArtifact(artifact), { ok: true, errors: [] });
  assert.deepEqual(artifact.nodes.map(({ id }) => id), artifact.nodes.map(({ id }) => id).sort(compareStableStrings));
  assert.deepEqual(artifact.edges.map(({ id }) => id), artifact.edges.map(({ id }) => id).sort(compareStableStrings));
  assert.equal(artifact.metadata.knowledgeGraph.vectorStore, false);
  assert.equal(artifact.metadata.knowledgeGraph.modelCalls, 0);
  assert.doesNotMatch(firstRaw, /"embeddings?"\s*:/i);
  assert.ok(!firstRaw.includes("redacted-at-ingest"));
  assert.ok(!firstRaw.includes("nested-json-secret"));
  assert.ok(!firstRaw.includes("nested-toml-secret"));
  assert.ok(!firstRaw.includes("unknown-json-secret"));
  assert.ok(!firstRaw.includes("unknown-env-secret"));
  assert.ok(!firstRaw.includes("unknown-docker-secret"));
  assert.ok(!firstRaw.includes("unknown-run-secret"));
  assert.ok(artifact.nodes.some((node) => node.type === "CodeClass"));
  assert.ok(artifact.nodes.some((node) => node.type === "CodeDependency" && node.label === ".sibling"));
  assert.ok(!artifact.nodes.some((node) => node.type === "CodeDependency" && node.label === "..sibling"));
  assert.ok(artifact.nodes.some((node) => node.type === "SqlTable" && node.label === "users"));
  assert.ok(artifact.nodes.some((node) => node.type === "DocumentSection" && node.properties["pdf:page"] === 1));
  assert.ok(artifact.nodes.some((node) => node.type === "DocumentText" && node.label.includes("PDF body sentinel 7f91") && node.properties["pdf:page"] === 1));
  assert.ok(artifact.edges.some((edge) => edge.label === "resolvesToSource"));
  assert.ok(artifact.edges.some((edge) => edge.label === "resolvesTo"));
  const typeScriptSource = artifact.nodes.find((node) => node.type === "SourceFile" && node.label === "src/app.ts");
  const pythonSource = artifact.nodes.find((node) => node.type === "SourceFile" && node.label === "lib.py");
  assert.match(typeScriptSource.properties["corpus:parserVersion"], /\+typescript-[0-9]/);
  assert.match(pythonSource.properties["corpus:parserVersion"], /\.sys-[0-9]+-[0-9]+-[0-9]+-/);
  assert.ok(Array.isArray(pythonSource.properties["code:pythonVersionInfo"]));
  for (const edge of artifact.edges) {
    for (const field of EVIDENCE_FIELDS) assert.notEqual(edge.properties[field], undefined, `${edge.id} ${field}`);
    const excerpt = edge.properties["evidence:excerpt"];
    assert.ok(excerpt.length > 0 && excerpt.length <= 320, edge.id);
    assert.equal(edge.properties["evidence:excerptHash"], sha256(excerpt), edge.id);
  }
  const secretNode = artifact.nodes.find((node) => node.label === "database.password");
  assert.equal(secretNode.properties["config:redacted"], true);
  assert.equal(secretNode.properties["config:value"], undefined);
  assert.ok(artifact.nodes.filter((node) => node.type === "ConfigKey").every((node) => node.properties["config:value"] === undefined));
  for (const sourcePath of ["config.json", "wrangler.toml"]) {
    const nestedSecretNode = artifact.nodes.find((node) => (
      node.label === "credentials.value"
      && node.properties["corpus:sourcePath"] === sourcePath
      && node.properties["config:redacted"] === true
    ));
    assert.ok(nestedSecretNode, `expected redacted nested configuration node in ${sourcePath}`);
  }

  const second = await ingestFixture(fixture);
  assert.equal(second.sources.parsed, 1);
  assert.equal(second.sources.reused, second.sources.total - 1);
  assert.equal(fixture.pdfCalls(), 1);
  assert.equal(await fs.readFile(second.artifactPath, "utf8"), firstRaw);

  await writeFile(fixture.corpusRoot, "config.json", '{"database":{"host":"changed"}}\n');
  await fs.unlink(path.join(fixture.corpusRoot, "README.md"));
  const third = await ingestFixture(fixture);
  assert.equal(third.sources.parsed, 2);
  assert.equal(third.sources.deleted, 1);
  assert.deepEqual(third.sources.deletedPaths, ["README.md"]);
  const updated = JSON.parse(await fs.readFile(third.artifactPath, "utf8"));
  assert.ok(!updated.manifest.sources.some((source) => source.sourcePath === "README.md"));
  assert.ok(!updated.nodes.some((node) => node.properties["corpus:sourcePath"] === "README.md"));
});

test("directed lexical queries, paths, impact, summaries, and edge explanation stay local", async (t) => {
  const fixture = await createFixture(t);
  const ingest = await ingestFixture(fixture);
  const common = { artifactPath: ingest.artifactPath, expectedDigest: ingest.digest };

  const search = await fixture.runtime.query({ ...common, mode: "search", query: "accounts", limit: 10 });
  assert.equal(search.ok, true);
  assert.ok(search.results.nodes.length > 0);
  assert.equal(search.retrieval.vectorStore, false);
  assert.equal(search.cost.modelCalls, 0);

  const singleCharacter = await fixture.runtime.query({ ...common, mode: "search", query: "x", limit: 10 });
  assert.equal(singleCharacter.ok, true);
  assert.ok(singleCharacter.results.nodes.some((entry) => entry.node.label === "x"));
  const limitedSearch = await fixture.runtime.query({ ...common, mode: "search", query: "sourcefile", limit: 1 });
  assert.equal(limitedSearch.completeness.complete, false);
  assert.equal(limitedSearch.completeness.reason, "result_limit");

  const codePath = await fixture.runtime.query({
    ...common,
    mode: "path",
    from: "src/app.ts",
    to: "src/db.ts",
    direction: "outgoing",
    edgeLabels: ["imports", "resolvesToSource"],
    maxDepth: 3,
  });
  assert.equal(codePath.ok, true);
  assert.equal(codePath.found, true);
  assert.deepEqual(codePath.path.edges.map((edge) => edge.label), ["imports", "resolvesToSource"]);
  const shallowPath = await fixture.runtime.query({
    ...common,
    mode: "path",
    from: "src/app.ts",
    to: "src/db.ts",
    direction: "outgoing",
    edgeLabels: ["imports", "resolvesToSource"],
    maxDepth: 1,
  });
  assert.equal(shallowPath.found, false);
  assert.deepEqual(shallowPath.completeness, { complete: false, truncated: true, reason: "max_depth", maxDepth: 1 });

  const sqlPath = await fixture.runtime.query({
    ...common,
    mode: "path",
    from: "users",
    to: "accounts",
    direction: "outgoing",
    edgeLabels: ["hasColumn", "referencesTable", "resolvesTo"],
    maxDepth: 4,
  });
  assert.equal(sqlPath.ok, true);
  assert.equal(sqlPath.found, true, JSON.stringify(sqlPath));

  const impact = await fixture.runtime.query({ ...common, mode: "impact", from: "accounts", direction: "incoming", maxDepth: 4 });
  assert.equal(impact.ok, true);
  assert.ok(impact.traversal.edgeIds.length > 0);
  const summary = await fixture.runtime.query({ ...common, mode: "summary" });
  assert.equal(summary.ok, true);
  assert.ok(summary.graph.nodes > 0 && summary.graph.edges > 0);
  assert.equal(summary.completeness.complete, true);
  const limitedNeighbors = await fixture.runtime.query({ ...common, mode: "neighbors", from: "src/app.ts", direction: "outgoing", maxDepth: 3, limit: 1 });
  assert.equal(limitedNeighbors.completeness.complete, false);
  assert.equal(limitedNeighbors.completeness.reason, "result_limit");

  const artifact = JSON.parse(await fs.readFile(ingest.artifactPath, "utf8"));
  const foreignKey = artifact.edges.find((edge) => edge.label === "referencesTable");
  const explanation = await fixture.runtime.explainEdge({ ...common, edgeId: foreignKey.id });
  assert.equal(explanation.ok, true);
  assert.match(explanation.evidence.explanation, /references table/i);
  assert.ok(explanation.evidence.excerpt.includes("REFERENCES"));
  assert.equal(explanation.evidence.excerptHash, sha256(explanation.evidence.excerpt));

  const stale = await fixture.runtime.query({ ...common, expectedDigest: "0".repeat(64), mode: "summary" });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "stale_artifact_digest");
  const missingDigest = await fixture.runtime.query({ artifactPath: ingest.artifactPath, mode: "summary" });
  assert.equal(missingDigest.ok, false);
  assert.equal(missingDigest.error.code, "expected_digest_required");
});

test("artifact tampering, root escapes, and output escapes are rejected", async (t) => {
  const fixture = await createFixture(t);
  const otherRoot = path.join(fixture.base, "other");
  await fs.mkdir(otherRoot);
  const outsideSource = await writeFile(otherRoot, "outside.ts", "export const outside = 'must-not-be-read';\n");
  await fs.symlink(outsideSource, path.join(fixture.corpusRoot, "linked-outside.ts"));
  const missingRoot = await fixture.runtime.ingest({ outputPath: "missing-root.json" });
  assert.equal(missingRoot.ok, false);
  assert.equal(missingRoot.error.code, "root_path_required");
  const ingest = await ingestFixture(fixture);
  assert.ok(ingest.diagnostics.some((diagnostic) => diagnostic.code === "symlink_skipped" && diagnostic.sourcePath === "linked-outside.ts"));
  assert.ok(!(await fs.readFile(ingest.artifactPath, "utf8")).includes("must-not-be-read"));
  const artifact = JSON.parse(await fs.readFile(ingest.artifactPath, "utf8"));
  artifact.nodes[0].label = "tampered-label";
  const tamperedPath = path.join(fixture.outputRoot, "tampered.json");
  await fs.writeFile(tamperedPath, `${JSON.stringify(artifact)}\n`);
  const tampered = await fixture.runtime.query({ artifactPath: tamperedPath, mode: "summary" });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.error.code, "artifact_invalid");
  assert.ok(tampered.error.details.errors.includes("digest does not match artifact content"));

  const escapedOutput = path.join(fixture.corpusRoot, "escaped.json");
  const outputEscape = await fixture.runtime.ingest({ rootPath: fixture.corpusRoot, outputPath: escapedOutput });
  assert.equal(outputEscape.ok, false);
  assert.equal(outputEscape.error.code, "output_outside_output_root");
  await assert.rejects(fs.access(escapedOutput));

  const linkedOutput = path.join(fixture.outputRoot, "linked-output");
  await fs.symlink(otherRoot, linkedOutput, "dir");
  const linkedOutputEscape = await fixture.runtime.ingest({ rootPath: fixture.corpusRoot, outputPath: "linked-output/escaped.json" });
  assert.equal(linkedOutputEscape.ok, false);
  assert.equal(linkedOutputEscape.error.code, "output_outside_output_root");
  await assert.rejects(fs.access(path.join(otherRoot, "escaped.json")));

  const rootEscape = await fixture.runtime.ingest({ rootPath: otherRoot, outputPath: "other.json" });
  assert.equal(rootEscape.ok, false);
  assert.equal(rootEscape.error.code, "root_outside_allowed_roots");

  const overlappingRuntime = createKnowledgeGraphRuntime({
    knowgrphRoot: fixture.knowgrphRoot,
    allowedRoots: [fixture.corpusRoot],
    outputRoot: fixture.corpusRoot,
  });
  const overlappingOutput = await overlappingRuntime.ingest({ rootPath: fixture.corpusRoot });
  assert.equal(overlappingOutput.ok, false);
  assert.equal(overlappingOutput.error.code, "output_root_matches_input_root");
});

test("atomic artifact writes enforce the matching read-size ceiling before replacement", async (t) => {
  assert.ok(DEFAULT_MAX_ARTIFACT_BYTES < bufferConstants.MAX_STRING_LENGTH - (1024 * 1024));
  assert.throws(
    () => computeKnowledgeGraphArtifactDigestBounded({ graph: "x".repeat(256) }, 64),
    (error) => error?.code === "artifact_too_large" && error?.details?.previousArtifactPreserved === true,
  );
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "knowgrph-kg-artifact-limit-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const artifactPath = path.join(directory, "graph.json");
  await fs.writeFile(artifactPath, "previous-artifact\n");
  await assert.rejects(
    writeKnowledgeGraphArtifactAtomic(artifactPath, { graph: "x".repeat(256) }, { maxBytes: 64 }),
    (error) => error?.code === "artifact_too_large"
      && error?.details?.maxBytes === 64
      && error?.details?.previousArtifactPreserved === true,
  );
  assert.equal(await fs.readFile(artifactPath, "utf8"), "previous-artifact\n");
  assert.deepEqual((await fs.readdir(directory)).sort(), ["graph.json"]);
});

test("malformed CREATE TABLE statements cannot consume a later schema statement", () => {
  const text = "CREATE TABLE broken;\nCREATE TABLE real (id INTEGER PRIMARY KEY);\n";
  const fragment = parseSqlSource({ sourcePath: "schema.sql", text, contentHash: sha256(text), byteSize: Buffer.byteLength(text) });
  assert.equal(fragment.status, "partial");
  assert.ok(fragment.diagnostics.some((diagnostic) => diagnostic.code === "sql_create_table_malformed" && diagnostic.lineStart === 1));
  assert.deepEqual(fragment.nodes.filter((node) => node.type === "SqlTable").map((node) => node.label), ["real"]);
  assert.ok(!fragment.edges.some((edge) => edge.properties?.["evidence:excerpt"]?.includes("broken;\nCREATE TABLE real")));
});

test("strict parser failure preserves the previous artifact and PDF pending is explicit", async (t) => {
  const fixture = await createFixture(t);
  const ingest = await ingestFixture(fixture);
  const before = await fs.readFile(ingest.artifactPath, "utf8");
  await writeFile(fixture.corpusRoot, "lib.py", "def changed(:\n    return 2\n");
  const failed = await fixture.runtime.ingest({ rootPath: fixture.corpusRoot, outputPath: "graph.json", strict: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "strict_ingest_incomplete");
  assert.equal(await fs.readFile(ingest.artifactPath, "utf8"), before);

  await writeFile(fixture.corpusRoot, "lib.py", "import math\nfrom . import sibling\nclass Service:\n    def run(self):\n        return math.sqrt(4)\n");
  await writeFile(fixture.corpusRoot, "sql/malformed.sql", "CREATE TABLE broken;\nCREATE TABLE real (id INTEGER PRIMARY KEY);\n");
  const failedSql = await fixture.runtime.ingest({ rootPath: fixture.corpusRoot, outputPath: "graph.json", strict: true });
  assert.equal(failedSql.ok, false);
  assert.equal(failedSql.error.code, "strict_ingest_incomplete");
  assert.ok(failedSql.error.details.sources.includes("sql/malformed.sql"));
  assert.equal(await fs.readFile(ingest.artifactPath, "utf8"), before);

  const pendingFixture = await createFixture(t, { withPdfConverter: false });
  const pending = await ingestFixture(pendingFixture, "pending.json");
  assert.ok(pending.diagnostics.some((diagnostic) => diagnostic.code === "pdf_converter_pending"));
  const pendingArtifact = JSON.parse(await fs.readFile(pending.artifactPath, "utf8"));
  assert.equal(pendingArtifact.manifest.sources.find((source) => source.sourcePath === "paper.pdf").status, "pending");

  const titleOnlyRuntime = createKnowledgeGraphRuntime({
    knowgrphRoot: fixture.knowgrphRoot,
    allowedRoots: [fixture.corpusRoot],
    outputRoot: fixture.outputRoot,
    pdfConverter: async () => "# paper.pdf\n",
    pdfConverterVersion: "title-only-fixture",
  });
  const titleOnly = await titleOnlyRuntime.ingest({ rootPath: fixture.corpusRoot, outputPath: "title-only.json", strict: true });
  assert.equal(titleOnly.ok, false);
  assert.equal(titleOnly.error.code, "strict_ingest_incomplete");
  await assert.rejects(fs.access(path.join(fixture.outputRoot, "title-only.json")));
});

test("same-artifact ingests are serialized inside the local MCP process", async (t) => {
  const fixture = await createFixture(t, { withPdfConverter: false });
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  const runtime = createKnowledgeGraphRuntime({
    knowgrphRoot: fixture.knowgrphRoot,
    allowedRoots: [fixture.corpusRoot],
    outputRoot: fixture.outputRoot,
    pdfConverterVersion: "serialized-fixture",
    pdfConverter: async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return "# paper.pdf\n## Page 1\nserialized evidence\n";
    },
  });
  const requests = [1, 2].map(() => runtime.ingest({
    rootPath: fixture.corpusRoot,
    outputPath: "serialized.json",
    strict: true,
    useCache: false,
  }));
  const results = await Promise.all(requests);
  assert.ok(results.every((result) => result.ok === true), JSON.stringify(results));
  assert.equal(calls, 2);
  assert.equal(maxActive, 1);
  assert.equal(results[0].digest, results[1].digest);
});
