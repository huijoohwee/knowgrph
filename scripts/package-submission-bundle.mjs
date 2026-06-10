#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { buildBundleIndexMarkdown, buildBundleSummaryHtml } from "./lib/submission-bundle.js";

function resolveRequiredPath(envName, cliArg, fallbackEnvName) {
  const cliValue = typeof cliArg === "string" && cliArg.trim().length > 0 ? cliArg.trim() : "";
  const envValue = process.env[envName];
  const fallbackValue = fallbackEnvName ? process.env[fallbackEnvName] : "";
  const value = cliValue || (typeof envValue === "string" && envValue.trim().length > 0 ? envValue.trim() : "") ||
    (typeof fallbackValue === "string" && fallbackValue.trim().length > 0 ? fallbackValue.trim() : "");
  if (!value) {
    console.error(`submission:bundle refused: ${envName} is required.`);
    process.exit(1);
  }
  return resolve(value);
}

function resolveBundleDir() {
  const value = process.env.SUBMISSION_BUNDLE_DIR || "./artifacts/submission-bundle";
  return resolve(value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const proofPath = resolveRequiredPath("PROOF_INPUT_PATH", process.argv[2], "BUNDLE_PROOF_INPUT_PATH");
  const demoPackPath = resolveRequiredPath("DEMO_PACK_INPUT_PATH", process.argv[3], "BUNDLE_DEMO_PACK_INPUT_PATH");
  const briefPath = resolveRequiredPath("SUBMISSION_BRIEF_INPUT_PATH", process.argv[4], "SUBMISSION_BRIEF_OUTPUT_PATH");
  const bundleDir = resolveBundleDir();

  const demoPackArtifact = await readJson(demoPackPath);
  await mkdir(bundleDir, { recursive: true });

  const proofFileName = basename(proofPath);
  const demoPackFileName = basename(demoPackPath);
  const briefFileName = basename(briefPath);

  await Promise.all([
    cp(proofPath, resolve(bundleDir, proofFileName)),
    cp(demoPackPath, resolve(bundleDir, demoPackFileName)),
    cp(briefPath, resolve(bundleDir, briefFileName)),
  ]);

  const bundle = {
    proofFileName,
    demoPackFileName,
    briefFileName,
    demoPackArtifact,
  };

  const indexMarkdown = buildBundleIndexMarkdown(bundle);
  const summaryHtml = buildBundleSummaryHtml(bundle);
  const manifestJson = {
    bundleVersion: "1",
    generatedAt: new Date().toISOString(),
    runId: demoPackArtifact?.runId ?? null,
    files: {
      proof: proofFileName,
      demoPack: demoPackFileName,
      submissionBrief: briefFileName,
      index: "index.md",
      summaryPage: "summary.html",
    },
  };

  await Promise.all([
    writeFile(resolve(bundleDir, "index.md"), indexMarkdown, "utf8"),
    writeFile(resolve(bundleDir, "summary.html"), summaryHtml, "utf8"),
    writeFile(resolve(bundleDir, "bundle-manifest.json"), `${JSON.stringify(manifestJson, null, 2)}\n`, "utf8"),
  ]);

  console.log("\n  Submission Bundle");
  console.log("  " + "-".repeat(40));
  console.log(`  Bundle dir: ${bundleDir}`);
  console.log(`  Proof:      ${proofFileName}`);
  console.log(`  Demo pack:  ${demoPackFileName}`);
  console.log(`  Brief:      ${briefFileName}`);
  console.log("  Generated:  index.md, summary.html, bundle-manifest.json");
}

main().catch((err) => {
  console.error("submission:bundle unexpected error:", err?.message ?? err);
  process.exit(1);
});
