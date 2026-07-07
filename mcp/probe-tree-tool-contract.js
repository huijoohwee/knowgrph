import {
  PROBE_EVOLVE_INPUT_SCHEMA,
  PROBE_EVOLVE_OUTPUT_SCHEMA,
  PROBE_GENERATE_INPUT_SCHEMA,
  PROBE_GENERATE_OUTPUT_SCHEMA,
  PROBE_SELECT_INPUT_SCHEMA,
  PROBE_SELECT_OUTPUT_SCHEMA,
} from "../canvas/src/features/agent-ready/probeTreeContract.mjs";

export const buildProbeTreeLocalToolDefinitions = ({ toolNames, withDefaults, readOnlyAnnotations, processAnnotations }) => [
  withDefaults({
    name: toolNames.probeGenerate,
    description:
      "Use this when a local MCP host needs a branching probe-tree agent to recall resolved exemplars and return typed candidate next questions without mutating the current graph node.",
    outputSchema: PROBE_GENERATE_OUTPUT_SCHEMA,
    inputSchema: PROBE_GENERATE_INPUT_SCHEMA,
  }, readOnlyAnnotations),
  withDefaults({
    name: toolNames.probeSelect,
    description:
      "Use this when a local MCP host needs to persist a user-selected probe option as a fresh type: probe markdown node plus an embedded branches-to edge and checkpoint fork metadata.",
    outputSchema: PROBE_SELECT_OUTPUT_SCHEMA,
    inputSchema: PROBE_SELECT_INPUT_SCHEMA,
  }, processAnnotations),
  withDefaults({
    name: toolNames.probeEvolve,
    description:
      "Use this when a local MCP host needs to score a resolved probe-tree path and write one reusable exemplar into the scoped memory layer.",
    outputSchema: PROBE_EVOLVE_OUTPUT_SCHEMA,
    inputSchema: PROBE_EVOLVE_INPUT_SCHEMA,
  }, processAnnotations),
];
