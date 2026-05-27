# Responses API

OpenAI Responses-style typed event streaming with reasoning + tool_call output items.

## Overview

The Responses API delivers a richer event vocabulary than Chat Completions. Events are named ( `response.created` , `response.output_text.delta` , `response.completed` , etc.) and arrive as SSE frames in `event: <type>\ndata: <json>\n\n` form, compatible with the OpenAI Python and TypeScript SDKs.

Base URL: `https://api.miromind.ai`

Auth: `Bearer API Key`

Pattern: `Submit + Stream` `Submit + Poll`

---

## Model Support

Each model declares which APIs it supports. Calling an unsupported endpoint returns `400 unsupported_api` .

| Model | /v1/chat/completions | /v1/responses |
| --- | --- | --- |
| `mirothinker-1-7-deepresearch` | ✅ | ✅ |
| `mirothinker-1-7-deepresearch-mini` | ✅ | ✅ |

---

## Endpoints

### Submit Response (`POST /v1/responses`)

Create a response. With stream=true (default) the response body is an SSE event stream; with stream=false the connection blocks until the workflow finishes and returns the full Response JSON. With background=true the call returns immediately and you fetch the result via GET /v1/responses/:id.

#### Headers

| `Authorization` | Required | Your MiroMind API key | `Bearer YOUR_API_KEY` |
| `Content-Type` | Required | Must be application/json | `application/json` |


#### Parameters

| model | `string` | Required | Model ID, e.g. "mirothinker-1-7-deepresearch-mini" |
| input | `string` |`array` | Required | A user prompt as a plain string, or an array of {type, role, content} input items. |
| stream | `boolean` | Optional | Whether to stream events via SSE. Defaults to true. |
| background | `boolean` | Optional | If true, returns the Response object immediately (status="in_progress") without holding a connection. Use GET /v1/responses/:id (or ?stream=true to resume the SSE stream) to fetch the result later. Mutually exclusive with stream=true. |
| max_output_tokens | `integer` | Optional | Maximum number of tokens to generate. |
| temperature | `number` | Optional | Sampling temperature. |
| metadata | `object` | Optional | Free-form key-value metadata stored with the response. |


#### Request

```cURL (streaming)
curl -N -X POST https://api.miromind.ai/v1/responses \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mirothinker-1-7-deepresearch-mini",
    "input": "Summarize the recent advances in fusion energy."
  }'
```

```Python (OpenAI SDK)
import os
from openai import OpenAI

client = OpenAI(
    base_url='https://api.miromind.ai/v1',
    api_key=os.environ['MIROMIND_API_KEY'],
)

with client.responses.stream(
    model='mirothinker-1-7-deepresearch-mini',
    input='Summarize the recent advances in fusion energy.',
) as stream:
    for event in stream:
        # Standard events parse as typed objects.
        print(event.type, event.model_dump())
```

#### Response

```SSE (streaming)
event: response.created
data: {"type":"response.created","sequence_number":1,"response":{"id":"resp_<id>","status":"in_progress",...}}

event: response.in_progress
data: {"type":"response.in_progress","sequence_number":2,...}

event: response.output_item.added
data: {"type":"response.output_item.added","sequence_number":3,"output_index":0,"item":{"id":"rs_<id>","type":"reasoning","summary":[]}}

event: response.reasoning_text.delta
data: {"type":"response.reasoning_text.delta","sequence_number":4,"item_id":"rs_<id>","output_index":0,"content_index":0,"delta":"Thinking about ..."}

... (more reasoning + optional tool_call output items) ...

event: response.output_item.added
data: {"type":"response.output_item.added","sequence_number":N,"output_index":1,"item":{"id":"msg_<id>","type":"message","role":"assistant","content":[]}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","sequence_number":N+1,"item_id":"msg_<id>","output_index":1,"content_index":0,"delta":"Recent advances ..."}

event: response.output_text.done
data: {"type":"response.output_text.done","sequence_number":N+M,...}

event: response.completed
data: {"type":"response.completed","sequence_number":N+M+1,"response":{"id":"resp_<id>","status":"completed","output":[...],"usage":{...}}}
```


```Non-streaming (stream=false)
{
  "id": "resp_<workflow_id>",
  "object": "response",
  "created_at": 1700000000,
  "status": "completed",
  "model": "mirothinker-1-7-deepresearch-mini",
  "output": [
    { "id": "rs_<id>", "type": "reasoning", "summary": [], "content": [...] },
    { "id": "msg_<id>", "type": "message", "role": "assistant",
      "content": [{ "type": "output_text", "text": "Recent advances ..." }] }
  ],
  "usage": {
    "input_tokens": 123,
    "output_tokens": 4567,
    "total_tokens": 4690
  }
}
```

```Background mode (background=true)
{
  "id": "resp_<workflow_id>",
  "object": "response",
  "created_at": 1700000000,
  "status": "in_progress",
  "model": "mirothinker-1-7-deepresearch-mini",
  "output": []
}
```

### Get / Resume Stream (`GET /v1/responses/:id`)

Fetch a Response by id. Default: returns the full Response object snapshot reconstructed from the workflow's event stream. With ?stream=true: opens an SSE stream that replays the entire event history through the translator and continues live until the workflow terminates — clients that lost their connection mid-stream can reconnect with ?stream=true&after=<seq> to skip events they already saw.

#### Headers

| Authorization | Required | Your MiroMind API key | `Bearer YOUR_API_KEY` |

#### Parameters

| stream | `boolean` | Optional | If true, returns SSE event stream (replay + live). If absent or false, returns the JSON snapshot. |
| after | `integer` | Optional | Only meaningful with stream=true. Skip events whose sequence_number is ≤ this value. Use to resume a stream where you left off. |

#### Request

```cURL (snapshot)
curl https://api.miromind.ai/v1/responses/resp_<id> \
  -H "Authorization: Bearer YOUR_API_KEY"
```

```cURL (resume stream)
curl -N "https://api.miromind.ai/v1/responses/resp_<id>?stream=true&after=42" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Response

Snapshot

```
{
  "id": "resp_<workflow_id>",
  "object": "response",
  "status": "completed",
  "model": "mirothinker-1-7-deepresearch-mini",
  "output": [...],
  "usage": {...}
}
```

### List Responses (`GET /v1/responses`)

List the authenticated user's recent responses. Lifecycle metadata only — no output[]; fetch individual responses via GET /v1/responses/:id.

#### Headers

| Authorization | Required | Your MiroMind API key | `Bearer YOUR_API_KEY` |

#### Parameters

| limit | `integer` | Optional | Default 20, max 100. |

#### Request

```cURL
curl https://api.miromind.ai/v1/responses?limit=20 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "resp_<workflow_id>",
      "object": "response",
      "status": "completed",
      "model": "mirothinker-1-7-deepresearch-mini",
      "created_at": 1700000000,
      "started_at": 1700000001,
      "completed_at": 1700000020
    }
  ],
  "has_more": true
}
```

### Cancel Response (`POST /v1/responses/:id/cancel`)

Cancel an in-progress response. Idempotent — cancelling an already-terminal response is a no-op.

#### Headers

| Authorization | Required | Your MiroMind API key | `Bearer YOUR_API_KEY` |

#### Request

```cURL
curl -X POST https://api.miromind.ai/v1/responses/resp_<id>/cancel \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Response

```json
{
  "id": "resp_<workflow_id>",
  "object": "response",
  "status": "cancelled"
}
```

### Streaming Format

SSE frames use OpenAI Responses convention:

```
event: <event_type>
data: <json_payload>
```

Each payload includes `type` (matches the event line) and `sequence_number` (monotonic int starting at 1). Item-scoped events also include `item_id` / `output_index` / `content_index` .

The stream ends with `response.completed` (or `response.failed` ). There is no `[DONE]` sentinel — the named events are self-terminating.

### Output Item Shape

The final `response.output[]` array contains the ordered output items: planning text alternates with tool calls, then a final message:

```
output[0]  reasoning   — first planning turn
output[1]  tool_call   — { name, arguments, result, status: "completed" }
output[2]  reasoning   — continued planning
output[3]  tool_call   — ...
output[k]  message     — final answer text
```

**Reasoning items** ( `type: "reasoning"` ) carry the model's planning narrative. Streamed via `response.reasoning_text.delta` .

**Tool-call items** ( `type: "tool_call"` ) describe an internal tool the agent invoked while researching. Each carries `{ id, type: "tool_call", name, arguments, result, status }` . The tool already ran on the server — the call is informational. Two events fire: `response.output_item.added` at invocation (with `status: "in_progress"` ) and `response.output_item.done` at completion (with `status: "completed"` and the `result` ).

> Important — tool_call vs OpenAI standard function_call:
> We deliberately use `type: "tool_call"`, not OpenAI's `type: "function_call"`.
> Our tools run on the server, so clients should NOT execute them locally or submit a `function_call_output` back. 
> The OpenAI Python and TypeScript SDKs treat `tool_call` as a generic / unknown output item and pass it through unchanged — they do not trigger their function-execution flow. Read `item.result` directly.

**Message item** ( `type: "message"` ) is the final user-visible answer. `content[0].text` holds the text. Streamed via `response.output_text.delta`.

---

Source: https://platform.miromind.ai/docs/responses-api
Converted: 2026-05-27