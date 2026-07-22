import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { KNOWLEDGE_GRAPH_INVOCATIONS } from "../knowledge-graph-tool-contract.js";
import { KNOWGRPH_LOCAL_MCP_TOOL_NAMES } from "../local-tool-contract.js";
import { minimalTextPdf } from "./fixtures/minimal-text-pdf.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function writeFixture(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

test("official SDK ingests, queries, and explains one local graph over stdio", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "knowgrph-kg-stdio-"));
  const corpusRoot = path.join(temporaryRoot, "corpus");
  const outputRoot = path.join(temporaryRoot, "artifacts");
  await writeFixture(corpusRoot, "src/value.ts", "export const value = 7;\n");
  await writeFixture(corpusRoot, "src/main.ts", 'import { value } from "./value";\nexport const answer = () => value;\n');
  await writeFixture(corpusRoot, "schema.sql", "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);\n");
  await writeFixture(corpusRoot, "README.md", "# Fixture\n## Notes\n[Schema](schema.sql)\n");
  await writeFixture(corpusRoot, "config.json", '{"mode":"local","apiToken":"must-not-leak"}\n');
  await writeFixture(corpusRoot, "evidence.pdf", minimalTextPdf("Stdio PDF evidence"));

  const client = new Client({ name: "knowgrph-knowledge-graph-e2e", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repoRoot, "mcp", "server.js")],
    cwd: repoRoot,
    env: {
      PATH: String(process.env.PATH || ""),
      HOME: String(process.env.HOME || ""),
      NODE_ENV: "test",
      KNOWGRPH_ROOT: repoRoot,
      KNOWGRPH_KNOWLEDGE_GRAPH_ALLOWED_ROOTS: corpusRoot,
      KNOWGRPH_KNOWLEDGE_GRAPH_OUTPUT_ROOT: outputRoot,
    },
    stderr: "pipe",
  });
  let stderrText = "";
  transport.stderr?.on("data", (chunk) => { stderrText += String(chunk); });

  try {
    await client.connect(transport, { timeout: 10_000 });
    const listed = await client.listTools(undefined, { timeout: 10_000 });
    const names = listed.tools.map((tool) => tool.name);
    for (const name of [
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphIngest,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
      KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphExplainEdge,
    ]) assert.ok(names.includes(name), `${name}; stderr=${stderrText}`);

    const ingestResult = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphIngest,
      arguments: {
        rootPath: corpusRoot,
        outputPath: "stdio.json",
        strict: true,
        invocation: KNOWLEDGE_GRAPH_INVOCATIONS.ingest,
      },
    }, undefined, { timeout: 30_000 });
    assert.equal(ingestResult.isError, false, stderrText);
    const ingest = ingestResult.structuredContent;
    assert.equal(ingest?.ok, true, JSON.stringify(ingest));
    assert.equal(ingest?.retrieval?.vectorStore, false);
    assert.equal(ingest?.cost?.modelCalls, 0);
    assert.ok(ingest?.parserCoverage?.["local-pdf-markdown-adapter"] > 0);

    const artifact = JSON.parse(await fs.readFile(ingest.artifactPath, "utf8"));
    const edge = artifact.edges.find((candidate) => candidate.label === "resolvesToSource") || artifact.edges[0];
    assert.ok(edge?.properties?.["evidence:explanation"]);

    const queryResult = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
      arguments: {
        artifactPath: ingest.artifactPath,
        expectedDigest: ingest.digest,
        mode: "search",
        query: "value",
        invocation: KNOWLEDGE_GRAPH_INVOCATIONS.query,
      },
    }, undefined, { timeout: 10_000 });
    assert.equal(queryResult.isError, false, stderrText);
    assert.equal(queryResult.structuredContent?.ok, true);
    assert.ok(queryResult.structuredContent?.results?.nodes?.length > 0);

    const pdfBodyQueryResult = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
      arguments: {
        artifactPath: ingest.artifactPath,
        expectedDigest: ingest.digest,
        mode: "search",
        query: "Stdio PDF evidence",
        invocation: KNOWLEDGE_GRAPH_INVOCATIONS.query,
      },
    }, undefined, { timeout: 10_000 });
    assert.equal(pdfBodyQueryResult.isError, false, stderrText);
    assert.equal(pdfBodyQueryResult.structuredContent?.ok, true);
    assert.ok(pdfBodyQueryResult.structuredContent?.results?.nodes?.some((entry) => (
      entry.node.type === "DocumentText" && entry.node.label.includes("Stdio PDF evidence")
    )));

    const explainResult = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphExplainEdge,
      arguments: {
        artifactPath: ingest.artifactPath,
        expectedDigest: ingest.digest,
        edgeId: edge.id,
        invocation: KNOWLEDGE_GRAPH_INVOCATIONS.explain,
      },
    }, undefined, { timeout: 10_000 });
    assert.equal(explainResult.isError, false, stderrText);
    assert.equal(explainResult.structuredContent?.ok, true);
    assert.ok(explainResult.structuredContent?.evidence?.excerpt);

    const invalidInvocation = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
      arguments: {
        artifactPath: ingest.artifactPath,
        expectedDigest: ingest.digest,
        mode: "summary",
        invocation: { ...KNOWLEDGE_GRAPH_INVOCATIONS.query, semantics: ["#knowledge-graph"] },
      },
    }, undefined, { timeout: 10_000 });
    assert.equal(invalidInvocation.isError, true);
    assert.equal(invalidInvocation.structuredContent?.error?.code, "invalid_invocation");

    const invalidArguments = await client.callTool({
      name: KNOWGRPH_LOCAL_MCP_TOOL_NAMES.knowledgeGraphQuery,
      arguments: {
        artifactPath: ingest.artifactPath,
        expectedDigest: ingest.digest,
        mode: "summary",
        unexpected: true,
        invocation: KNOWLEDGE_GRAPH_INVOCATIONS.query,
      },
    }, undefined, { timeout: 10_000 });
    assert.equal(invalidArguments.isError, true);
    assert.equal(invalidArguments.structuredContent?.error?.code, "invalid_arguments");
  } finally {
    await client.close().catch(() => undefined);
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
