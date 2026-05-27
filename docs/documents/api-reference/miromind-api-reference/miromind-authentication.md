# Authentication

Learn how to authenticate your API requests

### Overview

All Workflow APIs require API Key authentication using Bearer token in the Authorization header.

cURL

```
curl https://api.miromind.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## How to Get Started

### 1. Login to Console

Visit the console and sign in with GitHub or Google OAuth.

### 2. Create API Key

Navigate to "API Keys" page and click "Create New Key". Copy and save it immediately.

> ⚠️ Important: The API key is only shown once and cannot be retrieved later!

```
sk_live_1234567890abcdef...
```

### 3. Use API Key in Requests

Add the API key to your HTTP requests in the Authorization header:

```JavaScript
const response = await fetch('https://api.miromind.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MIROMIND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Hello!'
    }]
  })
});
```

```Python
import os
import requests

headers = {
    'Authorization': f'Bearer {os.environ.get("MIROMIND_API_KEY")}',
    'Content-Type': 'application/json',
}

data = {
    'messages': [{
        'role': 'user',
        'content': 'Hello!'
    }]
}

response = requests.post(
    'https://api.miromind.ai/v1/chat/completions',
    headers=headers,
    json=data
)
```

```cURL
curl -X POST https://api.miromind.ai/v1/chat/completions \
  -H "Authorization: Bearer $MIROMIND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Hello!"
    }]
  }'
```

### Security Best Practices

1. Never expose your API key in client-side code or public repositories
2. Rotate your API keys regularly
3. Use environment variables to store API keys
4. Monitor your API usage in the console

### Next Steps

Now that you have an API key, you can start making requests to the Chat Completions API.

View Chat Completions API Reference

---

Source: https://platform.miromind.ai/docs/authentication
Converted: 2026-05-27
