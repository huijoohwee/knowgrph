# Chat Completions API

OpenAI-compatible chat completions with built-in reasoning, tool use, and streaming.

## Overview

The Chat Completions API is the primary interface for interacting with MiroMind models. It follows the OpenAI Chat Completions format, so you can use the OpenAI SDK or any compatible client. The API is served by the **frontier gateway** .

Base URL: `https://api.miromind.ai`

Auth: `Bearer API Key`

Format: `OpenAI-compatible`

---

## Models

Pass the model `id` below in the `model` parameter when creating a chat completion.

#### MiroThinker 1.7 Deep Research

`mirothinker-1-7-deepresearch`

Flagship deep research model. Stronger reasoning depth and broader tool use.

Context window: 256k tokens

Max completion: 16k tokens

#### MiroThinker 1.7 Deep Research Mini

`mirothinker-1-7-deepresearch-mini`

Faster, lower-cost variant of the flagship. Same context window with reduced reasoning depth.

Context window: 256k tokens

Max completion: 16k tokens

#### List via API

The same data is available programmatically — useful for clients that want to enumerate or check model capabilities at runtime.

`GET /v1/models`

##### Response

```
{
  "object": "list",
  "data": [
    {
      "id": "mirothinker-1-7-deepresearch",
      "object": "model",
      "created": 1700000000,
      "owned_by": "miromind",
      "context_length": 262144,
      "max_completion_tokens": 16384
    },
    {
      "id": "mirothinker-1-7-deepresearch-mini",
      "object": "model",
      "created": 1700000000,
      "owned_by": "miromind",
      "context_length": 262144,
      "max_completion_tokens": 16384
    }
  ]
}
```

##### Example

```
curl https://api.miromind.ai/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

`POST /v1/chat/completions`

### Create Chat Completion

Send a conversation to the model and receive a completion. Supports streaming (SSE) and non-streaming modes.

#### Headers

| Header | Required | Description | Example |
| --- | --- | --- | --- |
| `Authorization` | Required | Your MiroMind API key | Bearer YOUR_API_KEY |
| `Content-Type` | Required | Must be application/json | application/json |

#### Parameters

| Parameter | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `model` | `string` | Required | Model ID to use, e.g. "mirothinker-1-7-deepresearch-mini" |
| `messages` | `array` | Required | Array of message objects with "role" (system/user/assistant) and "content" fields |
| `stream` | `boolean` | Optional | Whether to stream the response via SSE. Defaults to true. |
| `max_tokens` | `integer` | Optional | Maximum number of tokens to generate in the completion |
| `mcp_servers` | `array` | Optional | Array of MCP server configs ({name, url, headers?, access_token?, oauth?}) for external tool access |

#### Request

```cURL
curl -X POST https://api.miromind.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mirothinker-1-7-deepresearch-mini",
    "messages": [
      {
        "role": "user",
        "content": "What are the latest trends in AI?"
      }
    ],
    "stream": true
  }'
```

```JavaScript
const response = await fetch('https://api.miromind.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MIROMIND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'mirothinker-1-7-deepresearch-mini',
    messages: [
      { role: 'user', content: 'What are the latest trends in AI?' }
    ],
    stream: true
  })
});

// Read SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  console.log(chunk);
}
```

```Python
import os
import requests

response = requests.post(
    'https://api.miromind.ai/v1/chat/completions',
    headers={
        'Authorization': f'Bearer {os.environ["MIROMIND_API_KEY"]}',
        'Content-Type': 'application/json',
    },
    json={
        'model': 'mirothinker-1-7-deepresearch-mini',
        'messages': [
            {'role': 'user', 'content': 'What are the latest trends in AI?'}
        ],
        'stream': True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        print(line.decode())
```

#### Response

Non-Streaming

```
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1712345678,
  "model": "mirothinker-1-7-deepresearch-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here are the latest trends in AI..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 256,
    "total_tokens": 268
  }
}
```

---

## Streaming Response

When `stream: true` (the default), the response is delivered as Server-Sent Events (SSE). Each line is prefixed with `data: ` followed by a JSON chunk. The stream ends with `data: [DONE]` . The stream has two phases:

#### Phase 1: Reasoning

The model emits reasoning steps via `delta.reasoning_steps` . Each step has a `type` (e.g. thinking, web_search) and a `content` field with the step details.

#### Phase 2: Final Answer

After reasoning completes, the final answer streams via `delta.content` , token by token, just like standard OpenAI streaming.

#### SSE Stream Example

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"reasoning_steps":[{"type":"thinking","thought":"Let me analyze this question..."}]}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"reasoning_steps":[{"type":"web_search","web_search":{"search_keywords":["latest AI trends 2026"]}}]}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Here are"}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" the latest"}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" trends..."}}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":256,"total_tokens":268,"completion_tokens_details":{"reasoning_tokens":45},"num_search_queries":1}}

data: [DONE]
```

### Non-Streaming Response

Set `stream: false` to receive the full response as a single JSON object. The response waits until the model finishes generating before returning.

```
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1712345678,
  "model": "mirothinker-1-7-deepresearch-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here are the latest trends in AI...",
        "reasoning_steps": [
          {
            "type": "thinking",
            "thought": "Let me analyze this question..."
          },
          {
            "type": "web_search",
            "web_search": {
              "search_keywords": ["latest AI trends 2026"],
              "search_results": [{"title": "...", "url": "...", "snippet": "..."}]
            }
          }
        ]
      },
      "finish_reason": "stop"
    }
  ],
  "search_results": [{"title": "...", "url": "...", "snippet": "..."}],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 256,
    "total_tokens": 268,
    "completion_tokens_details": {
      "reasoning_tokens": 45
    },
    "num_search_queries": 1
  }
}
```

## Finish Reason & Usage

The final chunk (streaming) or the response (non-streaming) includes a `finish_reason` and a `usage` object.

| finish_reason | Description |
| --- | --- |
| `stop` | The model completed normally |
| `error` | The workflow failed due to an internal error. An `error` object is included in the chunk. |
| `cancelled` | The request was cancelled (client disconnect or explicit cancel) |

| usage field | Description |
| --- | --- |
| `prompt_tokens` | Tokens in the input prompt |
| `completion_tokens` | Tokens generated in the completion |
| `total_tokens` | Sum of prompt + completion tokens |
| `completion_tokens_details.reasoning_tokens` | Hidden reasoning tokens used by the model to produce the answer. Counted as part of `completion_tokens` and billed as output. OpenAI-compatible nested shape. |
| `num_search_queries` | Number of billed `fetch_url_content` invocations during reasoning. Omitted when zero. |

---

## Reasoning Step Types

During the reasoning phase, the model can emit the following step types:

| Type | Description |
| --- | --- |
| `thinking` | Internal reasoning and analysis |
| `web_search` | Searching the web for information |
| `fetch_url_content` | Fetching and reading content from a URL |
| `execute_python` | Executing Python code in a sandboxed environment |
| `execute_command` | Running a shell command |
| `tool_call` | Calling an MCP tool or external function |

---

## Capabilities & Limits

| Capability | Status |
| --- | --- |
| Context window | 256k tokens per request, shared between input and output. |
| External tool use (MCP) | Supported via the `mcp_servers` request parameter; currently in private beta. Contact us for access. |
| Custom function calling | OpenAI-style `tools` / `tool_choice` are not supported. Use `mcp_servers` for external tools. |
| Structured output | `response_format` / `json_schema` are not supported. |
| Prompt caching | `cache_control` is not supported. |
| Multimodal input | Image and document inputs are supported on the platform but not yet exposed via the public API. Coming soon. |

---

## OpenAI SDK Compatibility

Point any OpenAI SDK at the MiroMind base URL and use your MiroMind API key. The API is fully compatible with the OpenAI Chat Completions format.

### Python (openai SDK)

```
from openai import OpenAI

client = OpenAI(
    base_url="https://api.miromind.ai/v1",
    api_key="YOUR_API_KEY",
)

stream = client.chat.completions.create(
    model="mirothinker-1-7-deepresearch-mini",
    messages=[
        {"role": "user", "content": "What are the latest trends in AI?"}
    ],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta
    if delta.content:
        print(delta.content, end="", flush=True)
```

### Node.js (openai SDK)

```
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.miromind.ai/v1',
  apiKey: 'YOUR_API_KEY',
});

const stream = await client.chat.completions.create({
  model: 'mirothinker-1-7-deepresearch-mini',
  messages: [
    { role: 'user', content: 'What are the latest trends in AI?' }
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

---

## Error Responses

The API returns standard HTTP error codes with a JSON error body.

| Status | Code | Description |
| --- | --- | --- |
| 400 | bad_request | Invalid request body or missing required fields |
| 401 | unauthorized | Missing or invalid API key |
| 402 | insufficient_balance | Account balance is too low to process the request |
| 429 | rate_limited | Too many requests. Retry after the Retry-After header value. |
| 503 | service_unavailable | The service is temporarily overloaded or down for maintenance |

#### Error Response Format

```
{
  "error": {
    "code": "unauthorized",
    "message": "Invalid API key provided.",
    "type": "authentication_error"
  }
}
```

### Next Steps

For long-running tasks that should survive disconnects, use the Responses API.

Responses API

Streaming Guide

---

Source: https://platform.miromind.ai/docs/chat-completions
Converted: 2026-05-27
