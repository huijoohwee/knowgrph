// Storyboard shot-plan + KGC storyboard-markdown builders for the video-remix
// Director runtime. Extracted verbatim from `mcp/video-remix-runtime.js`
// (reuse-not-rebuild).

import { REQUIRED_RESEARCH_SOURCE_COUNT } from "./constants.js";

function buildShotPlan({ brief, sourceCount, shotCount }) {
  return Array.from({ length: shotCount }, (_, index) => {
    const shotNumber = index + 1;
    return {
      shotId: `shot-${shotNumber}`,
      label: `Shot ${shotNumber}`,
      type: "video-remix-shot",
      status: sourceCount >= REQUIRED_RESEARCH_SOURCE_COUNT ? "planned" : "blocked_weak_signal",
      prompt: `${brief || "Create a video remix"} - scene ${shotNumber}`,
      durationS: 4,
    };
  });
}

function buildStoryboardMarkdown({ runId, referenceUrl, brief, shots }) {
  const nodeYaml = shots.map((shot) => [
    `    - id: "${shot.shotId}"`,
    `      label: "${shot.label}"`,
    `      type: "${shot.type}"`,
    `      status: "${shot.status}"`,
  ].join("\n")).join("\n");
  const edgeYaml = shots.slice(1).map((shot, index) => [
    `    - id: "edge-${index + 1}"`,
    `      source: "${shots[index].shotId}"`,
    `      target: "${shot.shotId}"`,
  ].join("\n")).join("\n");
  return [
    "---",
    'kgSchema: "kgc-computing-flow/v1"',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    `title: "Video Remix Storyboard - ${runId}"`,
    `referenceUrl: "${referenceUrl}"`,
    "flow:",
    "  nodes:",
    nodeYaml || "    []",
    "  edges:",
    edgeYaml || "    []",
    "---",
    "",
    "# Video Remix Storyboard",
    "",
    brief,
  ].join("\n");
}

// Structured `flow:{nodes[],edges[]}` counterpart to `buildStoryboardMarkdown`.
// Single source of truth for the storyboard graph so the Kgc_Document markdown
// (the YAML frontmatter `flow:` block) and the structured `flow` object the
// harness returns are derived from the SAME shot plan (reuse-not-rebuild). One
// node per shot, in order; edges chain consecutive shots
// (shot[i] -> shot[i+1]). Pure — no schema validation here (that is the
// harness's `validateKgcComputingFlowV1` seam).
function buildStoryboardFlow(shots) {
  const list = Array.isArray(shots) ? shots : [];
  const nodes = list.map((shot) => ({
    id: shot.shotId,
    label: shot.label,
    type: shot.type,
    status: shot.status,
  }));
  const edges = list.slice(1).map((shot, index) => ({
    id: `edge-${index + 1}`,
    source: list[index].shotId,
    target: shot.shotId,
  }));
  return { nodes, edges };
}

export { buildShotPlan, buildStoryboardMarkdown, buildStoryboardFlow };
