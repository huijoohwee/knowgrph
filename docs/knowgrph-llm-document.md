# Knowgrph LLM / Chat Integration

Knowgrph’s Chat surface is a thin, metadata-driven client for an OpenAI-compatible Chat Completions endpoint. It does not participate in ingest, parsing, schema derivation, or rendering; it only reads the current UI state (selection + optional markdown) and submits a request.

The Chat UI is consolidated into the Canvas Side Panel (no legacy toolbar chat UI or standalone chat panel components).

## Model target

- Model: `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B` (Hugging Face clone source: https://huggingface.co/deepseek-ai/DeepSeek-R1-0528-Qwen3-8B?clone=true)
- Endpoint shape: OpenAI-compatible `POST /v1/chat/completions`

The client assumes you run the model behind an OpenAI-compatible server (for example vLLM or a compatible gateway) and then point Knowgrph at that endpoint.

### macOS: LM Studio (recommended)

LM Studio can expose an OpenAI-compatible API for locally downloaded models.

MainPanel → Settings → Chat:

- `chatEndpointUrl`: `http://localhost:1234/v1/chat/completions`
- `chatModel`: `lmstudio-community/DeepSeek-R1-0528-Qwen3-8B-MLX-8bit`

One-line “is it up?” check:

```bash
curl -sSf http://localhost:1234/v1/health >/dev/null && echo "OK"
```

If you want a single command that prints the first available `chatModel` value:

```bash
python -c "import json,urllib.request; print(json.load(urllib.request.urlopen('http://localhost:1234/v1/models'))['data'][0]['id'])"
```

### Linux/NVIDIA: vLLM helper server

For a minimal local setup using vLLM:

1. Clone the model repository (already done in `/Users/huijoohwee/Documents/GitHub/DeepSeek-R1-0528-Qwen3-8B`).
2. Install Git LFS and pull model weights inside that directory.
3. Create and activate a Python environment with `vllm` installed.
4. From the model directory, run:

   ```bash
   cd /Users/huijoohwee/Documents/GitHub/DeepSeek-R1-0528-Qwen3-8B
   python serve_vllm_openai.py
   ```

The helper script:

- Uses `vllm.entrypoints.openai.api_server` under the hood.
- Serves an OpenAI-compatible Chat Completions API on `http://0.0.0.0:8000/v1/chat/completions`.
- Registers the served model name as `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B`, which matches the default `chatModel` in Knowgrph.

On startup, it logs:

- A boot message with the resolved model path and `served_model_name`.
- The fact that it is launching a vLLM OpenAI-compatible server, including the host and port.

## Settings

Chat is configured via the Settings panel and persisted in local storage:

- `chatEndpointUrl` (string): OpenAI-compatible chat completions endpoint URL. Default: `http://localhost:1234/v1/chat/completions`.
- `chatModel` (string): model id/name sent in the request body. Default: `lmstudio-community/DeepSeek-R1-0528-Qwen3-8B-MLX-8bit`.
- `chatTemperature` (number): clamped to `[0, 2]` before sending. Default: `0.3`.
- `chatSystemPrompt` (string | null): optional system message prepended to every request.

Implementation references:
- Chat UI + request assembly: [Canvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/pages/Canvas.tsx)
- Settings registry entries: [registry-ui.ui.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/settings/registry-ui.ui.ts)
- Persistence defaults: [uiSlice.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/uiSlice.ts)

## Prompt shaping (neutral + provenance-aware)

Each request is built from:

1. Optional `chatSystemPrompt` (if configured).
2. Selection context (if a node is selected):
   - `id`, `label`, `type`
   - a small, ordered sample of node properties (prefers `title`, `name`, `description`, `summary`, `chunk_text`, `tags`, `url`, etc., then falls back to alphabetic keys)
3. Markdown provenance (if available):
   - if the selected node has `metadata.lineStart/lineEnd` and a markdown document is currently loaded, the client computes a section-aware snippet by expanding the line range to the nearest Markdown heading above (ATX `#`…`######` or Setext) and the next heading boundary of the same-or-higher level (without splitting inside fenced code blocks), then trimming to a safe character budget (~2000 chars).
   - the snippet is annotated with the effective line range and, when present, the resolved section title derived from the heading text.
4. Conversation history (user/assistant turns).

The selection and markdown context are framed as neutral metadata. The assistant is instructed to avoid inventing entities/relationships that are not present in the provided node properties or markdown excerpt.

## Conversation history

- The Side Panel Chat persists conversation history in `localStorage`, keyed per graph (derived from `graphData.metadata` when available, otherwise a lightweight graph signature).
- The persisted history is capped to the last 80 messages.

## Streaming responses

- Requests send `stream: true`.
- If the server responds with `Content-Type: text/event-stream`, the client incrementally applies `choices[0].delta.content` (or `choices[0].message.content` when present) to the in-flight assistant message.
- If streaming is not available, the client falls back to parsing a normal JSON response.
- The Stop button aborts the in-flight request via `AbortController` and leaves any partial assistant text in-place.

## Connectivity and failure modes

The Canvas Chat panel includes a lightweight connectivity indicator based on the last request:

- When the endpoint responds successfully (including non‑200 errors), the panel shows a small “Chat endpoint responded successfully.” status line.
- When the browser cannot reach the endpoint (for example `net::ERR_CONNECTION_REFUSED`, network errors, or a missing local DeepSeek server), the panel surfaces a neutral, metadata‑style error message such as:
  - “Unable to reach chat endpoint at http://localhost:8000/v1/chat/completions. Ensure the DeepSeek server is running and accessible from the browser.”
- The Send button is disabled until both `chatEndpointUrl` and `chatModel` are configured, and the error string clarifies when configuration is missing versus when the endpoint itself is unreachable.

This keeps connectivity feedback visible inside the Chat surface without changing ingest, parsing, or rendering behavior, and it matches the same OpenAI‑compatible assumptions described in the helper server section above.
