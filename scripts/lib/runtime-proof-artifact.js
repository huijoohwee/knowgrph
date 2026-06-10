import { buildDemoPackFromManifest } from "../../mcp/video-remix/demo-pack-template.js";
import { validateDemoPack } from "../../contracts/demo-pack.schema.js";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function joinUrl(base, path) {
  return cleanString(base) ? `${String(base).replace(/\/+$/, "")}${path}` : "";
}

export function extractManifestFromProof(proof) {
  const readbackManifest = proof?.readback?.manifest;
  if (isPlainObject(readbackManifest)) return readbackManifest;
  const readbackBodyManifest = proof?.readback?.responseBody?.manifest;
  if (isPlainObject(readbackBodyManifest)) return readbackBodyManifest;
  const runManifest = proof?.runSubmission?.manifest;
  if (isPlainObject(runManifest)) return runManifest;
  const runBodyManifest = proof?.runSubmission?.responseBody?.result?.structuredContent;
  if (isPlainObject(runBodyManifest)) return runBodyManifest;
  return null;
}

export function buildReachabilityFromProof(proof) {
  const results = {};
  const frontendUrl = cleanString(proof?.frontendUrl);
  const agentApiUrl = cleanString(proof?.agentApiUrl);
  const readbackUrl = cleanString(proof?.demoPackUrls?.find?.((entry) => entry?.kind === "agent_api_run_readback")?.url);
  const demoPackUrls = Array.isArray(proof?.demoPackUrls) ? proof.demoPackUrls : [];

  for (const entry of demoPackUrls) {
    const url = cleanString(entry?.url);
    if (!url) continue;
    results[url] = { status: 200 };
  }
  if (frontendUrl) results[frontendUrl] = { status: 200 };
  if (agentApiUrl) {
    results[agentApiUrl] = { status: 200 };
    results[joinUrl(agentApiUrl, "/health")] = { status: 200 };
  }
  if (readbackUrl) results[readbackUrl] = { status: 200 };
  return results;
}

export function buildHostedDemoPackArtifact(proof, options = {}) {
  const manifest = extractManifestFromProof(proof);
  if (!isPlainObject(manifest)) {
    throw new Error("runtime-proof artifact requires a manifest-bearing proof file");
  }

  const frontendUrl = cleanString(options.frontendUrl || proof?.frontendUrl);
  const agentApiUrl = cleanString(options.agentApiUrl || proof?.agentApiUrl);
  const backendHealthUrl = cleanString(options.backendHealthUrl || joinUrl(agentApiUrl, "/health"));
  const reachability = options.reachability ?? buildReachabilityFromProof(proof);

  const demoPack = buildDemoPackFromManifest(manifest, {
    frontendUrl,
    agentApiUrl,
    backendHealthUrl,
    reachability,
  });
  const validation = validateDemoPack(demoPack);

  return {
    artifactVersion: "1",
    generatedAt: new Date().toISOString(),
    sourceProofVersion: proof?.proofVersion ?? null,
    runId: cleanString(manifest.runId),
    manifestState: cleanString(manifest.state),
    manifestMode: cleanString(manifest.mode),
    proofSummary: {
      agentApiUrl: agentApiUrl || null,
      frontendUrl: frontendUrl || null,
      mcpEndpoint: cleanString(proof?.mcpEndpoint) || null,
      authSessionStatus: proof?.authSession?.status ?? null,
      runSubmissionStatus: proof?.runSubmission?.status ?? null,
      readbackStatus: proof?.readback?.status ?? null,
      persistedAt: cleanString(proof?.readback?.persistedAt) || null,
      sameRunId: proof?.readback?.sameRunId ?? null,
      sameState: proof?.readback?.sameState ?? null,
      sameMode: proof?.readback?.sameMode ?? null,
    },
    demoPack,
    demoPackValidation: validation,
    manifest,
    supplementalUrls: Array.isArray(proof?.demoPackUrls) ? proof.demoPackUrls : [],
  };
}
