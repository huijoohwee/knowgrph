# Streaming Guide

How to consume SSE streams from the Chat Completions API

## Overview

When you send a request to POST /v1/chat/completions with stream: true (the default), the response is delivered as Server-Sent Events (SSE). Each event is a line prefixed with "data: " followed by a JSON chunk, and the stream ends with "data: [DONE]".

> This page covers the SSE wire format. For the full API reference (request parameters, response schema, reasoning step types), see the Chat Completions API page.

---

## Stream Lifecycle

A stream goes through several phases in order:

```
1. role chunk        {"delta": {"role": "assistant"}}
2. reasoning chunks  {"delta": {"reasoning_steps": [...]}}  (thinking, tool use)
3. content chunks    {"delta": {"content": "..."}}          (final answer)
4. finish chunk      {"delta": {}, "finish_reason": "stop", "usage": {...}}
5. [DONE] signal     data: [DONE]
```

#### Phase 1: Reasoning

The model emits `reasoning_steps` in the delta — thinking, web search, code execution, tool calls. This phase may take time as the model uses tools.

#### Phase 2: Final Answer

After reasoning completes, the final answer streams via `delta.content` token by token, just like standard OpenAI streaming. The last chunk carries `finish_reason` and usage stats.

---

## Chunk Format

Each SSE line contains a JSON chunk following the OpenAI `chat.completion.chunk` format:

SSE Format

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"mirothinker-1-7-deepresearch-mini","created":1712345678,"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"mirothinker-1-7-deepresearch-mini","created":1712345678,"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":100,"total_tokens":110}}

data: [DONE]
```

### Chunk Fields

| id | Unique identifier for this completion (format: chatcmpl-{workflow_id}) |
| object | Always "chat.completion.chunk" |
| model | The model used for this completion |
| choices[].delta | Incremental content — may contain role, content, or reasoning_steps |
| choices[].finish_reason | null during streaming, then "stop", "error", or "cancelled" in the final chunk |
| usage | Token usage stats — only present in the final chunk (prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, num_search_queries) |

### Delta Types

The delta object in each chunk contains one of the following:

#### Role chunk

```
{"delta": {"role": "assistant"}}
```

#### Thinking chunk

```
{"delta": {"reasoning_steps": [{"type": "thinking", "thought": "Let me analyze..."}]}}
```

#### Web Search chunk

```
{"delta": {"reasoning_steps": [{"type": "web_search", "web_search": {"search_keywords": ["query"], "search_results": [{"title": "...", "url": "...", "snippet": "..."}]}}]}}
```

#### Fetch URL chunk

```
{"delta": {"reasoning_steps": [{"type": "fetch_url_content", "fetch_url_content": {"url": "https://example.com/article", "title": "Article title", "snippet": "Extracted summary..."}}]}}
```

#### Execute Python chunk

```
{"delta": {"reasoning_steps": [{"type": "execute_python", "execute_python": {"code": "import math\nprint(math.pi)", "result": "3.141592653589793\n"}}]}}
```

#### Execute Command chunk

```
{"delta": {"reasoning_steps": [{"type": "execute_command", "execute_command": {"command": "ls -la /tmp", "result": "total 0\ndrwxrwxrwt 2 root root ..."}}]}}
```

#### Content chunk

```
{"delta": {"content": "Here are the results..."}}
```

#### Finish chunk

```
{"delta": {}, "finish_reason": "stop"}
```

### Heartbeat

When no chunk has been emitted for ~15 s (e.g. a long-running tool call), the server sends an SSE comment line as a keep-alive heartbeat to prevent proxy/CDN idle timeouts. Reasoning streams continuously, so heartbeats typically only appear during silent pauses such as tool execution:

```
: heartbeat
```

SSE comments (lines starting with ":") are part of the SSE spec and are automatically ignored by EventSource clients. If you parse SSE manually, skip lines that start with ":".

---

## Complete Example

A complete streaming client that handles reasoning steps, content, finish reason, usage, and heartbeats:

### Standard usage (OpenAI SDK)

Uses the official OpenAI SDK. Returns standard fields: content, finish_reason, usage. The SDK drops unknown fields, so reasoning_steps / citations / search_results are not accessible this way.

```OpenAI SDK (JS)
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.MIROMIND_API_KEY,
  baseURL: 'https://api.miromind.ai/v1',
});

const stream = await client.chat.completions.create({
  model: 'mirothinker-1-7-deepresearch-mini',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  const choice = chunk.choices[0];
  const delta = choice.delta;

  // Final answer (token-by-token)
  if (delta?.content) {
    process.stdout.write(delta.content);
  }

  // Finish + usage (last chunk)
  if (choice.finish_reason) {
    console.log(`\nFinish: ${choice.finish_reason}`);
    if (chunk.usage) console.log('Usage:', chunk.usage);
  }
}
```

```OpenAI SDK (Python)
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ['MIROMIND_API_KEY'],
    base_url='https://api.miromind.ai/v1',
)

stream = client.chat.completions.create(
    model='mirothinker-1-7-deepresearch-mini',
    messages=[{'role': 'user', 'content': 'Hello'}],
    stream=True,
)

for chunk in stream:
    choice = chunk.choices[0]
    delta = choice.delta

    # Final answer (token-by-token)
    if delta.content:
        print(delta.content, end='', flush=True)

    # Finish + usage (last chunk)
    if choice.finish_reason:
        print(f'\nFinish: {choice.finish_reason}')
        if chunk.usage:
            print('Usage:', chunk.usage)
```

### Reading extension fields (raw HTTP)

Parse the SSE stream manually to consume our extensions: reasoning_steps (thinking, web_search, fetch_url_content, execute_python, execute_command), citations, and search_results.

```JavaScript
const API_KEY = process.env.MIROMIND_API_KEY;

async function streamChatCompletion(messages) {
  const response = await fetch('https://api.miromind.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mirothinker-1-7-deepresearch-mini',
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      // Skip SSE comments (heartbeats)
      if (line.startsWith(':')) continue;

      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);

      if (payload === '[DONE]') {
        console.log('\nStream finished');
        return;
      }

      const chunk = JSON.parse(payload);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;

      // Reasoning steps (thinking, tool use)
      if (delta?.reasoning_steps) {
        for (const step of delta.reasoning_steps) {
          if (step.type === 'thinking') {
            console.log('[thinking]', step.thought);
          } else {
            console.log(`[${step.type}]`, JSON.stringify(step));
          }
        }
      }

      // Content tokens (final answer)
      if (delta?.content) {
        process.stdout.write(delta.content);
      }

      // Finish
      if (choice?.finish_reason) {
        console.log(`\nFinish reason: ${choice.finish_reason}`);
        if (chunk.usage) {
          console.log('Usage:', JSON.stringify(chunk.usage));
        }
      }
    }
  }
}
```

```Python
import os
import requests
import json

API_KEY = os.environ.get('MIROMIND_API_KEY')

def stream_chat_completion(messages):
    response = requests.post(
        'https://api.miromind.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'mirothinker-1-7-deepresearch-mini',
            'messages': messages,
            'stream': True,
        },
        stream=True,
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue

        line = line.decode('utf-8')

        # Skip SSE comments (heartbeats)
        if line.startswith(':'):
            continue

        if not line.startswith('data: '):
            continue

        payload = line[6:]
        if payload == '[DONE]':
            print('\nStream finished')
            break

        chunk = json.loads(payload)
        choice = chunk.get('choices', [{}])[0]
        delta = choice.get('delta', {})

        # Reasoning steps
        for step in delta.get('reasoning_steps', []):
            if step['type'] == 'thinking':
                print(f"[thinking] {step.get('thought', '')}")
            else:
                print(f"[{step['type']}]", json.dumps(step, ensure_ascii=False))

        # Content tokens
        content = delta.get('content', '')
        if content:
            print(content, end='', flush=True)

        # Finish
        finish = choice.get('finish_reason')
        if finish:
            print(f'\nFinish reason: {finish}')
            usage = chunk.get('usage')
            if usage:
                print(f'Usage: {json.dumps(usage)}')
```

### Best Practices

- Buffer incomplete lines — SSE data may arrive in partial TCP chunks

- Skip SSE comment lines (starting with ":") — these are heartbeats

- Check finish_reason in each chunk — "error" means the workflow failed, and the chunk includes an error object

- Read usage from the final chunk to track token consumption and costs

- Handle client disconnects gracefully — the server will automatically cancel the workflow if the connection drops

### Next Steps

See the full API reference for request parameters, response schema, and reasoning step types.

Chat Completions API Reference

---

Source: https://platform.miromind.ai/docs/streaming
Converted: 2026-05-27
