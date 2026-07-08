import { KNOWGRPH_AGENT_READY_TOOL_IDS } from "./knowgrphAgentReadyToolContract.mjs";
import { KNOWGRPH_PROBE_TREE_TOOL_NAMES } from "./probeTreeContract.mjs";

export const KNOWGRPH_OS_STATUS_TOOL_NAME = "knowgrph.os.status";

export const KNOWGRPH_LOCAL_MCP_TOOL_NAMES = Object.freeze({
  search: KNOWGRPH_AGENT_READY_TOOL_IDS.search,
  fetch: KNOWGRPH_AGENT_READY_TOOL_IDS.fetch,
  uiLaunch: "knowgrph.ui.launch",
  uiStop: "knowgrph.ui.stop",
  pipeline: "knowgrph.pipeline",
  graphragPipeline: "knowgrph.graphrag_pipeline",
  superagentRun: "knowgrph.superagent.run",
  videoRemixRun: "knowgrph.video_remix.run",
  browserApiRun: "knowgrph.browser_api.run",
  sealionDetectLanguageVariant: "sealion.detect_language_variant",
  sealionTranslateLocalize: "sealion.translate_localize",
  sealionSafetyCheck: "sealion.safety_check",
  htmlVideoRender: "knowgrph.html_video.render",
  annotateImage: "knowgrph.annotate.image",
  annotateVideoFrame: "knowgrph.annotate.video_frame",
  memoryAdd: "knowgrph.memory.add",
  memorySearch: "knowgrph.memory.search",
  memoryAssemblePrompt: "knowgrph.memory.assemble_prompt",
  probeGenerate: KNOWGRPH_PROBE_TREE_TOOL_NAMES.generate,
  probeSelect: KNOWGRPH_PROBE_TREE_TOOL_NAMES.select,
  probeEvolve: KNOWGRPH_PROBE_TREE_TOOL_NAMES.evolve,
  showrunnerStartRun: "knowgrph.showrunner.start_run",
  showrunnerRunStatus: "knowgrph.showrunner.run_status",
  showrunnerPostChoice: "knowgrph.showrunner.post_choice",
  showrunnerSubmitCritique: "knowgrph.showrunner.submit_critique",
  showrunnerApproveStage: "knowgrph.showrunner.approve_stage",
  showrunnerGetArtifact: "knowgrph.showrunner.get_artifact",
  osStatus: KNOWGRPH_OS_STATUS_TOOL_NAME,
  vdeoxplnList: "knowgrph.vdeoxpln.list",
});

export const buildKnowgrphLocalMcpToolNameList = () => Object.values(KNOWGRPH_LOCAL_MCP_TOOL_NAMES);
