type AgentExecutionContext = {
  input: { brief?: unknown; context?: unknown };
  run: { runId: string; agentDefinitionId: string; promptContract: string[] };
  definition: { title: string; fallback: string } | null;
};

const readTextResult = (result: Record<string, unknown>): string => {
  if (typeof result.response === "string") return result.response;
  if (typeof result.result === "string") return result.result;
  const first = Array.isArray(result.choices) ? result.choices[0] : null;
  if (first && typeof first === "object" && "message" in first) {
    const message = first.message;
    if (message && typeof message === "object" && "content" in message && typeof message.content === "string") {
      return message.content;
    }
  }
  return JSON.stringify(result);
};

export function createWorkersAiAgentAdapter(env: Env) {
  return {
    async execute(context: AgentExecutionContext): Promise<Record<string, unknown>> {
      const model = String(env.KNOWGRPH_AGENT_MODEL || "").trim();
      if (!env.AI || !model) {
        throw new Error("Workers AI binding or KNOWGRPH_AGENT_MODEL is not configured.");
      }
      const definition = context.definition;
      const system = [
        `You are the ${definition?.title || context.run.agentDefinitionId}.`,
        ...(context.run.promptContract || []),
        `Fallback: ${definition?.fallback || "Return a structured evidence-gap response."}`,
        "Return source-grounded Markdown. Keep unknowns explicit and never invent citations, prices, policy coverage, or media URLs.",
      ].join("\n");
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: String(context.input.brief || "") },
        ],
        max_tokens: 2048,
      }, {
        tags: ["knowgrph", context.run.agentDefinitionId, context.run.runId].map((tag) => tag.slice(0, 50)),
      });
      return {
        provider: "cloudflare-workers-ai",
        model,
        text: readTextResult(result),
        ...("usage" in result && result.usage && typeof result.usage === "object" ? { usage: result.usage } : {}),
      };
    },
  };
}
