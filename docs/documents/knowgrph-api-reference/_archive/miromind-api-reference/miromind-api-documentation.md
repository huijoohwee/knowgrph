# API Documentation

Complete reference for MiroMind Chat Completions API

Learn how to integrate AI capabilities into your applications using our OpenAI-compatible Chat Completions API. Build intelligent applications with streaming, reasoning, tool use, and seamless integration.

---

## Quick Start

Get started with the Chat Completions API in just a few minutes.

### 1. Get API Key

Login to the console and create an API key from the API Keys page. Keep it secure!

```
# Your API key will look like this:
sk_live_1234567890abcdef...
```

### 2.Send a Request

Send a POST request to the Chat Completions endpoint. Works with any OpenAI-compatible client.

```
curl -X POST https://api.miromind.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d {"model": "mirothinker-1-7-deepresearch-mini", "messages": [{"role": "user", "content": "Hello!"}]}
```

### 3. Handle the Stream

The response streams as SSE by default. Each line is a JSON chunk with reasoning steps and content.

```
# Stream is the default. Parse SSE lines:
data: {"choices":[{"delta":{"content":"Hello!"}}]}
data: [DONE]
```

---

Source: https://platform.miromind.ai/docs
Converted: 2026-05-27
