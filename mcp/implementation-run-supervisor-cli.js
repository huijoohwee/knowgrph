#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import { createImplementationRunSupervisor } from "./implementation-run-supervisor.js";

const readOption = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "") : "";
};
const rootDir = path.resolve(readOption("root"));
const runId = readOption("run");
const token = readOption("token");
if (!rootDir || !/^ir_[a-f0-9]{24}$/.test(runId) || !/^[a-f0-9-]{36}$/.test(token)) {
  process.stderr.write("Invalid implementation-run supervisor invocation.\n");
  process.exit(2);
}

createImplementationRunSupervisor({ rootDir, runId, token }).run().catch((error) => {
  process.stderr.write(`implementation-run supervisor failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
