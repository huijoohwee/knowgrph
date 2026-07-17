import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const syncScriptPath = path.resolve(repoRoot, "scripts", "sync-pages-knowgrph.mjs");
const syncScript = fs.readFileSync(syncScriptPath, "utf8");

test("publish sync removes stale generated assets from both mirror trees", () => {
  assert.equal(
    syncScript.includes("const isRetainedAssetRelativePath"),
    false,
    "expected publish sync to avoid retaining stale assets by helper guard",
  );
  assert.match(
    syncScript,
    /const isPublicManagedRelativePath = \(rel\) => \{\s+if \(!rel\) return false\s+return rel\.startsWith\('assets\/'\) \|\| publicManagedRootFiles\.has\(rel\)\s+\}/m,
    "expected public-managed publish paths to include hashed asset bundles",
  );
  assert.match(
    syncScript,
    /if \(await existsDir\(targetDir\)\) \{\s+const targetFiles = await listAllFiles\(targetDir\)\s+for \(const rel of targetFiles\) \{\s+if \(isPreservedRelativePath\(rel\)\) continue\s+if \(sourceSet\.has\(rel\)\) continue\s+filesToRemove\.push\(rel\)\s+\}\s+\}/m,
    "expected generated mirror cleanup to remove stale assets from content/knowgrph",
  );
  assert.match(
    syncScript,
    /if \(await existsDir\(publicRouteDir\)\) \{\s+const publicFiles = await listAllFiles\(publicRouteDir\)\s+for \(const rel of publicFiles\) \{\s+if \(!isPublicManagedRelativePath\(rel\)\) continue\s+if \(sourceSet\.has\(rel\)\) continue\s+publicFilesToRemove\.push\(rel\)\s+\}\s+\}/m,
    "expected generated mirror cleanup to remove stale assets from /knowgrph public routes",
  );
});

test("publish sync includes the published agent-ready dependency closure", () => {
  assert.match(syncScript, /'mcpAppsContractText\.mjs'/);
  assert.match(syncScript, /'mcpAppsOnboarding\.mjs'/);
  assert.match(syncScript, /'probeTreeUserInputRelevance\.mjs'/);
  assert.match(syncScript, /cameraMcpContract\.mjs/);
  assert.match(syncScript, /richMediaTextMarkdownContractSource/);
  assert.match(syncScript, /\[richMediaTextMarkdownContractSource, richMediaTextMarkdownContractTarget\]/);
  assert.match(syncScript, /\.map\(filename => \[agentReadyFeatureSource\(filename\), agentReadyFeatureTarget\(filename\)\]\)/);
});

test("publish sync includes the cross-root semantic-key dependency", () => {
  assert.match(syncScript, /semanticKeyContractSource = path\.resolve\(knowgrphRoot, 'contracts', 'semantic-key\.js'\)/);
  assert.match(syncScript, /semanticKeyContractTarget = path\.resolve\(githubRoot, 'huijoohwee', 'contracts', 'semantic-key\.js'\)/);
  assert.match(syncScript, /\[semanticKeyContractSource, semanticKeyContractTarget\]/);
});

test("publish sync includes the XR scene tool contract dependency", () => {
  assert.match(syncScript, /xrSceneMcpContractSource = path\.resolve\(knowgrphRoot, 'canvas', 'src', 'features', 'three', 'xrSceneMcpContract\.mjs'\)/);
  assert.match(syncScript, /xrSceneMcpContractTarget = path\.resolve\(githubRoot, 'huijoohwee', 'canvas', 'src', 'features', 'three', 'xrSceneMcpContract\.mjs'\)/);
  assert.match(syncScript, /\[xrSceneMcpContractSource, xrSceneMcpContractTarget\]/);
});

test("publish sync includes the XR animation tool contract dependency", () => {
  assert.match(syncScript, /xrAnimationMcpContractSource = path\.resolve\(knowgrphRoot, 'canvas', 'src', 'features', 'three', 'xrAnimationMcpContract\.mjs'\)/);
  assert.match(syncScript, /xrAnimationMcpContractTarget = path\.resolve\(githubRoot, 'huijoohwee', 'canvas', 'src', 'features', 'three', 'xrAnimationMcpContract\.mjs'\)/);
  assert.match(syncScript, /\[xrAnimationMcpContractSource, xrAnimationMcpContractTarget\]/);
});

test("publish sync keeps the live canvas hero markdown route in the root-managed file set", () => {
  assert.match(syncScript, /'knowgrph-live-canvas-hero\.md'/);
});
