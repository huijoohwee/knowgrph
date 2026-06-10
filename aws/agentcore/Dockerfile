# AgentCore Runtime container for the knowgrph MCP-forwarding adapter.
#
# Spec: knowgrph-acos-mcp-connector, task 13.1 (R11.1, R11.2, R12.2, R14.1;
# decision 13.0 — thin MCP-forwarding adapter, NO model keys, NO paid-model
# invocation). AgentCore Runtime MCP contract: ARM64 image running a stateless
# streamable-HTTP MCP server at 0.0.0.0:8000/mcp.
#
# BUILD CONTEXT: build from `knowgrph/aws/` so this image can reuse the existing
# Section 5 / 12.1 forwarder without duplicating it:
#
#   docker build --platform linux/arm64 \
#     -f agentcore/Dockerfile -t knowgrph-agentcore-mcp:local .
#
# (run from the `knowgrph/aws/` directory). The local smoke test + `agentcore`
# CLI config are task 13.2 / 13.8; the gated ECR push + `agentcore launch` are
# the OPERATOR-GATED task 13.9.
#
# R11 BOUNDARY: no model provider keys are baked into this image, passed as a
# build ARG, or set as an ENV value. The ONLY runtime configuration is the
# control-plane endpoint (MCP_ENDPOINT); when unset the server fails closed
# (HTTP 501) rather than making an accidental live or paid-model call.

# ARM64 per the AgentCore Runtime container contract.
FROM --platform=linux/arm64 node:20-slim AS runtime

# Run as an unprivileged user (the slim image ships a `node` user).
WORKDIR /app

# Reuse the Section 5 / 12.1 forwarder verbatim (the agentcore MCP server
# imports `../../agent-api/src/lib/mcp-forwarder.js`). The forwarder module is
# dependency-free, so only its source is needed — no `npm install` here keeps
# the image keyless and minimal. Preserve the relative directory layout so the
# `../../agent-api/...` import resolves at runtime.
COPY agent-api/src/lib/mcp-forwarder.js ./agent-api/src/lib/mcp-forwarder.js
COPY agentcore/package.json ./agentcore/package.json
COPY agentcore/src ./agentcore/src

WORKDIR /app/agentcore

# AgentCore Runtime MCP contract: stateless streamable-HTTP MCP server on 8000.
ENV HOST=0.0.0.0 \
    PORT=8000 \
    NODE_ENV=production
EXPOSE 8000

# NOTE (R11): MCP_ENDPOINT is intentionally NOT set here. It is provided at
# deploy time (task 13.9). With it unset the server fails closed (HTTP 501).
# No model provider key ARG/ENV is declared anywhere in this image.

USER node

CMD ["node", "src/server.js"]
