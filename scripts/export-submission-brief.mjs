#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildSubmissionBriefMarkdown } from "./lib/demo-pack-submission-brief.js";

function resolveInputPath() {
  const cliArg = process.argv[2];
  const envValue = process.env.DEMO_PACK_INPUT_PATH;
  const value = typeof cliArg === "string" && cliArg.trim().length > 0
    ? cliArg.trim()
    : typeof envValue === "string" && envValue.trim().length > 0
      ? envValue.trim()
      : "";
  if (!value) {
    console.error("submission:brief refused: provide a demo-pack artifact path as argv[2] or DEMO_PACK_INPUT_PATH.");
    process.exit(1);
  }
  return resolve(value);
}

async function main() {
  const inputPath = resolveInputPath();
  const outputPath = process.env.SUBMISSION_BRIEF_OUTPUT_PATH
    ? resolve(process.env.SUBMISSION_BRIEF_OUTPUT_PATH)
    : null;
  const artifact = JSON.parse(await readFile(inputPath, "utf8"));
  const markdown = buildSubmissionBriefMarkdown(artifact, {
    title: process.env.SUBMISSION_TITLE,
  });

  if (outputPath) {
    await writeFile(outputPath, markdown, "utf8");
  }

  console.log("\n  Submission Brief");
  console.log("  " + "-".repeat(40));
  console.log(`  Input:   ${inputPath}`);
  if (outputPath) {
    console.log(`  Output:  ${outputPath}`);
  }
  console.log("\n  Markdown Preview:\n");
  console.log(markdown);
}

main().catch((err) => {
  console.error("submission:brief unexpected error:", err?.message ?? err);
  process.exit(1);
});
