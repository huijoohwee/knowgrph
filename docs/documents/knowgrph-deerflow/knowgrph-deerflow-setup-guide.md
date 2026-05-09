# Knowgrph DeerFlow Setup Guide — From 0 to 1

**Document Version**: 4.0.0
**Date**: 2026-05-09
**Status**: Active
**Companion To**: `knowgrph-deerflow-prd-tad.md`, `knowgrph-deerflow-prd-tad-integration-contracts-and-patterns.md`, `knowgrph-deerflow-prd-tad-delivery-validation.md`

---

## Document Purpose

**Context**: DeerFlow is a super-agent harness that orchestrates rich media content generation (text, image, video) through research, skills, and sandbox execution. Knowgrph Canvas Flow Editor delegates generation to DeerFlow's agent runtime instead of calling provider APIs directly.
**Intent**: Provide a step-by-step guide to go from zero to a working DeerFlow-powered rich media generation pipeline on Canvas, covering both Dev (local Vite) and Prod (Cloudflare Pages) environments.
**Directive**: All configuration is declarative and fixture-driven; no hardcoded paths or provider constants in source.

---

## DeerFlow Is Optional

DeerFlow is a **first-class optional provider**, not a required dependency. Knowgrph works fully without DeerFlow installed or running.

| Feature | Without DeerFlow | With DeerFlow |
|---------|-----------------|---------------|
| Canvas Flow Editor | Full | Full |
| Text generation (OpenAI) | Full (default provider) | Full |
| Text generation (BytePlus) | Full | Full |
| Image generation | Full (BytePlus) | Full |
| Video generation | Full (BytePlus) | Full |
| MainPanel Integrations | Full (all sections visible) | Full |
| Side panel chat | Full | Full |
| Text generation (DeerFlow agent) | N/A | Full |
| `npm run dev` | Full | Full |
| `npm run dev:all` | Full (prints warning, skips DeerFlow) | Full |
| Prod (`airvio.co`) | Full | Full |

Knowgrph's default experience is **OpenAI-powered**. DeerFlow only activates when explicitly selected as `chatProvider = 'deerflow'` in Integrations settings. No DeerFlow gateway running = no impact on any other feature. The `dev:all` script gracefully skips DeerFlow startup if the repo is not found.

---

## Prerequisites

| Requirement | Minimum | Required? |
|-------------|---------|-----------|
| Node.js | >= 18 | Yes |
| Knowgrph dev server | `npm -C canvas run dev` | Yes |
| DeerFlow gateway | Running at `http://localhost:8001` (default) | Only for DeerFlow provider |
| DeerFlow skills installed | `deep-research`, `image-generation`, `video-generation` | Only for DeerFlow provider |
| Workspace docs root | Env var `VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT` pointing to docs folder containing `knowgrph-video-demo.md` | Only for demo fixture |
| Cloudflare Pages project | `airvio.co/knowgrph` with env vars configured (see Step 1.5) | Only for prod deployment |

---

## Architecture Overview

```mermaid
flowchart LR
    A[Flow Markdown] --> B[Parser + Normalizer]
    B --> C[Graph Build]
    C --> D[Generation Dispatcher]
    D --> E{Provider}
    E -->|deerflow| F[DeerFlow Gateway]
    F --> G[Agent Runtime]
    G --> H[Skills + Sandbox]
    H --> I[Artifact Normalizer]
    I --> J[Canvas 2D Renderer]
```

### Data Flow Summary

| Stage | Component | Input | Output |
|-------|-----------|-------|--------|
| 1. Ingest | Parser | Markdown frontmatter | Raw node config |
| 2. Normalize | Provider Metadata Normalizer | Raw node config | `ParsedProviderMetadata` |
| 3. Build | Graph Compiler | Normalized metadata | Compiled graph |
| 4. Dispatch | Generation Dispatcher | `RunGenerationRequest` | Adapter call |
| 5. Execute | DeerFlow Adapter | HTTP payload | Raw provider response |
| 6. Normalize | Artifact Normalizer | Raw response | `CanonicalArtifact` |
| 7. Render | Canvas 2D Renderer | `CanonicalArtifact` | Text/Image/Video in Canvas |

---

## Step 0: Start DeerFlow Gateway

DeerFlow runs as a local gateway that proxies to underlying model providers. It must be running somewhere accessible to the Knowgrph proxy (Vite middleware in dev, Cloudflare Pages Function in prod).

### Dev Mode: Run DeerFlow Locally

#### Option A: One-command startup (Knowgrph + DeerFlow)

```bash
# Starts both Vite dev server AND DeerFlow gateway in one terminal
npm run dev:all
```

The `dev:all` script:
- Checks if DeerFlow gateway is already running on port 8001 (skips if so)
- Starts DeerFlow gateway from `../deer-flow` (or `DEERFLOW_REPO_PATH`)
- Starts the Knowgrph Vite dev server
- Kills DeerFlow gateway on exit (Ctrl+C)

**Environment variables**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEERFLOW_PORT` | `8001` | DeerFlow gateway port |
| `DEERFLOW_REPO_PATH` | `../deer-flow` | Path to deer-flow repo |

#### Option B: Start DeerFlow gateway separately

```bash
# Terminal 1: Start DeerFlow gateway (default port 8001)
cd /path/to/deer-flow
python -m deer_flow.server --port 8001

# Terminal 2: Start Knowgrph dev server
npm run dev
```

### Prod Mode: Run DeerFlow via Cloudflare Tunnel (Free)

Cloudflare Tunnel exposes your local DeerFlow gateway to the internet with a public HTTPS URL — no VPS or cloud server needed. The tunnel runs from your machine.

#### Step 0.1: Install Cloudflare Tunnel

```bash
# Install cloudflared (macOS)
brew install cloudflared

# Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

#### Step 0.2: Start DeerFlow + Tunnel

```bash
# Terminal 1: Start DeerFlow gateway locally
cd /path/to/deer-flow
python -m deer_flow.server --port 8001

# Terminal 2: Expose via Cloudflare Tunnel
cloudflared tunnel --url http://localhost:8001
```

Cloudflared outputs a public URL like:

```
https://abcxyz-trycloudflare-com.trycloudflare.com
```

This URL is your **production DeerFlow endpoint**.

#### Step 0.3: Configure Knowgrph endpoint for Prod

In Knowgrph Integrations, set the DeerFlow endpoint URL to the tunnel URL:

```ts
store.chatEndpointUrl = 'https://abcxyz-trycloudflare-com.trycloudflare.com/api/llm/chat/completions'
```

Or configure it in the Cloudflare Pages Function so all prod users get it by default:

1. Go to **Cloudflare Dashboard > Pages > joohwee > Settings > Production > Variables**
2. Add: `KNOWGRPH_CHAT_PROXY_UPSTREAM` = `https://abcxyz-trycloudflare-com.trycloudflare.com`

#### Step 0.4: (Optional) Run tunnel as a named tunnel for a stable URL

Quick tunnels generate a random URL each time. For a stable URL, create a named tunnel:

```bash
# Login first (one-time)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create knowgrph-deerflow

# Route your domain to the tunnel
cloudflared tunnel route dns knowgrph-deerflow deerflow.yourdomain.com

# Run the tunnel
cloudflared tunnel run knowgrph-deerflow --url http://localhost:8001
```

Now your DeerFlow endpoint is permanently `https://deerflow.yourdomain.com`.

#### Step 0.5: Keep tunnel alive

Cloudflare Tunnel must stay running for DeerFlow to be reachable. Options:

| Method | How | Persistence |
|--------|-----|-------------|
| **Screen/tmux** | `tmux new -s deerflow && cloudflared tunnel run ...` | Survives terminal close, dies on reboot |
| **LaunchAgent** (macOS) | Create `~/Library/LaunchAgents/com.knowgrph.deerflow.plist` | Auto-starts on login |
| **systemd** (Linux) | Create `/etc/systemd/system/deerflow-tunnel.service` | Auto-starts on boot |

**macOS LaunchAgent example** (`~/Library/LaunchAgents/com.knowgrph.deerflow.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.knowgrph.deerflow</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/cloudflared</string>
    <string>tunnel</string>
    <string>run</string>
    <string>knowgrph-deerflow</string>
    <string>--url</string>
    <string>http://localhost:8001</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

```bash
# Load the LaunchAgent
launchctl load ~/Library/LaunchAgents/com.knowgrph.deerflow.plist
```

### Verify the gateway is reachable

```bash
# Dev
curl -s http://localhost:8001/api/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"ping"}]}' \
  | head -c 200

# Prod (replace with your tunnel URL)
curl -s https://abcxyz-trycloudflare-com.trycloudflare.com/api/llm/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"ping"}]}' \
  | head -c 200
```

Expected: a JSON response (even if it returns an error about model config, the gateway is alive).

---

## Step 1: Configure Provider Settings and API Key Management

### 1.1 Auth Modes

Knowgrph supports two authentication modes. The mode is shared globally across all providers (BytePlus, OpenAI, DeerFlow).

| Mode | Behavior | API Key Required? |
|------|----------|-------------------|
| **`serverManaged`** (default) | The proxy server injects its own API key from environment bindings. The browser never sends a key. | **No** (server provides it) |
| **`byok`** (Bring Your Own Key) | The browser sends your personal API key via `X-KG-Chat-Api-Key` header on every request. | **Yes** (user provides it) |

**Auto-switching rules**:
- Typing an API key while in `serverManaged` mode automatically switches to `byok`
- Switching to `serverManaged` automatically clears the stored API key
- The `auth_mode` and `api_key` fields in every provider section (BytePlus, OpenAI, DeerFlow) read/write the same global state

### 1.2 Open Integrations

1. Launch the Knowgrph Canvas dev server: `npm -C canvas run dev`
2. Open the application in your browser
3. Navigate to **MainPanel** -> **Integrations** tab

### 1.3 Set DeerFlow as Active Provider

In the Integrations view, locate the **DeerFlow Gateway API** section. The SSOT rows are derived from OpenAI-compatible schema with DeerFlow-specific defaults:

| Row Key | Default Value | Description |
|---------|--------------|-------------|
| `deerflowApi.provider` | `deerflow` | Provider routing identifier |
| `deerflowApi.endpoint_url` | `http://localhost:8001/api/llm/chat/completions` | DeerFlow Gateway OpenAI-compatible endpoint |
| `deerflowApi.model` | (from global settings) | Text generation model |
| `deerflowApi.chatModel` | (from global settings) | Chat model selector |
| `deerflowApi.auth_mode` | `serverManaged` | Auth mode (shared global) |
| `deerflowApi.api_key` | (empty in serverManaged) | API key (shared global) |

### 1.4 Configure via Settings Store

The provider settings are persisted in IndexedDB via the settings store. Key fields:

```ts
store.chatProvider = 'deerflow'
store.chatEndpointUrl = 'http://localhost:8001/api/llm/chat/completions'
store.chatModel = 'seed-2-0-lite-260228'
store.chatAuthMode = 'serverManaged'
```

### 1.5 API Key Management: Dev vs Prod

The client uses the **same `/__chat_proxy` path** in both environments. The difference is which server-side handler processes the request and where it reads API keys from.

#### Dev Mode (Local Vite Dev Server)

The Vite dev server middleware in `vite.config.ts` intercepts `/__chat_proxy/*` requests. API keys come from your local shell environment.

Set these in your shell or a `.env` file before starting the dev server:

```bash
# OpenAI provider (used by DeerFlow LLM surface at /api/llm/*)
export KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY="sk-..."
# or fallback
export OPENAI_API_KEY="sk-..."

# BytePlus provider (used for image/video generation)
export KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY="..."
# or fallback
export BYTEPLUS_API_KEY="..."

# DeerFlow local gateway upstream (optional, client header takes priority)
export KNOWGRPH_CHAT_PROXY_UPSTREAM="http://localhost:8001"

# Proxy timeout (optional, 5000-180000 ms, default 90000)
export KNOWGRPH_CHAT_PROXY_TIMEOUT_MS="120000"
```

#### Prod Mode (Cloudflare Pages at `airvio.co/knowgrph`)

The production proxy is a **Cloudflare Pages Function** at `functions/__chat_proxy/[[path]].js` in the `huijoohwee` repo. API keys come from Cloudflare Pages environment bindings.

Configure these at **Cloudflare Dashboard > Pages > joohwee > Settings > Production > Variables and Secrets**:

| Variable | Type | Purpose | Required? |
|----------|------|---------|-----------|
| `KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY` | **Secret** | OpenAI key for `serverManaged` mode | Yes (if using OpenAI/DeerFlow LLM) |
| `OPENAI_API_KEY` | **Secret** | Fallback OpenAI key | Fallback |
| `KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY` | **Secret** | BytePlus ModelArk key for `serverManaged` mode | Yes (if using BytePlus image/video) |
| `BYTEPLUS_API_KEY` | **Secret** | Fallback BytePlus key | Fallback |
| `KNOWGRPH_CHAT_PROXY_UPSTREAM` | Variable | Default upstream URL fallback | Optional |
| `KNOWGRPH_CHAT_PROXY_TIMEOUT_MS` | Variable | Proxy timeout (5,000-180,000; default 90,000) | Optional |
| `KNOWGRPH_INTEGRATION_ALLOWED_HOSTS` | Variable | CSV of allowed upstream hostnames | Optional |

**Key fallback chain** (identical in both environments):

```javascript
const envOpenAiApiKey = env.KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY || env.OPENAI_API_KEY || ''
const envBytePlusApiKey = env.KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY || env.BYTEPLUS_API_KEY || ''
```

Provider-specific key takes priority; generic key is the fallback.

#### DeerFlow-Specific Key Behavior

For the DeerFlow provider (`providerHeader === 'deerflow'`), the proxy treats it as a **local gateway**:

- `requiresOpenAiKey` = **false** (provider is not `'openai'`)
- `requiresBytePlusKey` = **false** (provider is not `'byteplus-modelark'`)
- **No `Authorization` header is attached** by the proxy
- The DeerFlow gateway itself handles authentication internally via its own `config.yaml` or env vars

This means: in `serverManaged` mode, **no API key is needed for DeerFlow** at the Knowgrph level. The DeerFlow gateway manages its own credentials for upstream LLM providers.

### 1.6 Recommended: Use the Production Proxy Everywhere

The production Cloudflare Pages Function and the Vite dev server middleware implement **identical proxy logic** with the same `/__chat_proxy` path. You can simplify your setup by using the production proxy for both environments:

**Option A: Dev server points to production proxy**

Configure the Vite dev server to forward `/__chat_proxy` to the Cloudflare Pages Function:

```bash
# In your local .env or shell
export KNOWGRPH_CHAT_PROXY_UPSTREAM="https://airvio.co"
```

Then all requests from your local dev server route through the production proxy, using the Cloudflare env vars you already configured. No local API keys needed.

**Option B: Keep separate (current default)**

- Dev: Vite middleware reads `process.env` from your local shell
- Prod: Cloudflare Pages Function reads from Cloudflare env bindings
- Same client code, same `/__chat_proxy` path, different server-side handlers

### 1.7 Verify Provider Configuration

The DeerFlow section is discoverable via MainPanel search. Deep-link anchors follow the pattern `deerflow-api-row-{normalized-key}` and are stable across surfaces.

---

## Step 2: Load the Canonical Demo Fixture

The canonical fixture `knowgrph-video-demo.md` is a path-agnostic workspace seed. It defines a 3-node DAG pipeline (Text -> Image -> Video) that exercises the full DeerFlow harness.

### 2.1 Set Workspace Docs Root

```bash
export VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT=/path/to/your/docs
```

The docs folder must contain `knowgrph-video-demo.md` (or `workspace-seeds/knowgrph-video-demo.md`).

### 2.2 Open the Fixture in Canvas

1. In the Knowgrph Workspace, open the file browser
2. Navigate to `knowgrph-video-demo.md`
3. The parser reads the YAML frontmatter and builds the flow graph

### 2.3 Verify Graph Topology

After parsing, the Canvas should display a DAG with these nodes:

| Node ID | Type | Label |
|---------|------|-------|
| `w-text-script` | TextGeneration | Text Script Widget |
| `p-text-script` | RichMediaPanel | Rich Media Panel - Text (Script) |
| `w-img-scene` | ImageGeneration | Image Widget - Scene Reference |
| `p-img-scene` | RichMediaPanel | Rich Media Panel - Image (Scene) |
| `w-video-scene` | VideoGeneration | Video Widget - Scene |
| `p-video-scene` | RichMediaPanel | Rich Media Panel - Video (Scene) |

Edges connect: `w-text-script -> p-text-script`, `w-img-scene -> p-img-scene`, `w-img-scene -> w-video-scene`, `w-video-scene -> p-video-scene`.

---

## Step 3: Run Text Generation (W01)

### 3.1 What Happens

When you click **Run** on the Text Script Widget (`w-text-script`):

1. **Dispatcher** reads `chatProvider = 'deerflow'` from the store
2. **Provider normalization** resolves `deerflow` via `normalizeChatProviderId()`
3. **Endpoint resolution** uses `store.chatEndpointUrl` or falls back to `getChatDefaultEndpointUrlForProvider('deerflow')` which returns `http://localhost:8001/api/llm/chat/completions`
4. **Client builds proxy headers**: `X-KG-Chat-Provider: deerflow`, `X-KG-Chat-Upstream: http://localhost:8001`, **no** `X-KG-Chat-Api-Key` (serverManaged mode)
5. **Client rewrites** the absolute endpoint URL to `/__chat_proxy/api/llm/chat/completions` (same-origin proxy path)
6. **Proxy handler** (Vite middleware in dev, Cloudflare Function in prod) receives the request, sees `provider = 'deerflow'`, attaches no Authorization header, forwards to `http://localhost:8001/api/llm/chat/completions`
7. **DeerFlow agent** invokes the `deep-research` skill, performs web search for locale context, and returns structured prompt JSON
8. **Response** is written to `w-text-script.properties.output` and `w-text-script.properties.outputSrcDoc`

### 3.2 User Action

1. Select the `w-text-script` node on the Canvas
2. Click the **Run** button in the node overlay or toolbar
3. Wait for the loading state to complete
4. The Rich Media Panel (`p-text-script`) displays the generated markdown output

### 3.3 Data Flow

```
Canvas Run -> useFlowEditorWorkflowActions.ts
  -> normalizeChatProviderId(store.chatProvider) = 'deerflow'
  -> runEndpointUrl = store.chatEndpointUrl || getChatDefaultEndpointUrlForProvider('deerflow')
  -> buildChatProxyHeaders({ provider: 'deerflow', apiKey: null })  // serverManaged
  -> resolveChatEndpointForRequest() rewrites to /__chat_proxy/api/llm/chat/completions
  -> POST /__chat_proxy/api/llm/chat/completions
     Headers: X-KG-Chat-Provider: deerflow, X-KG-Chat-Upstream: http://localhost:8001
  -> [Proxy: Vite middleware (dev) OR Cloudflare Function (prod)]
     -> No Authorization header (DeerFlow = local gateway)
     -> Forwards to http://localhost:8001/api/llm/chat/completions
  -> DeerFlow agent -> deep-research skill -> structured prompt
  -> Write node.properties.output + node.properties.outputSrcDoc
```

### 3.4 Dev vs Prod Request Flow Comparison

```
DEV MODE:
  Browser -> POST localhost:5173/__chat_proxy/api/llm/chat/completions
          -> Vite middleware -> forwards to localhost:8001
          -> DeerFlow gateway -> upstream LLM

PROD MODE (Cloudflare Tunnel):
  Browser -> POST airvio.co/__chat_proxy/api/llm/chat/completions
          -> Cloudflare Pages Function -> forwards to tunnel URL
          -> Cloudflare Tunnel -> localhost:8001
          -> DeerFlow gateway -> upstream LLM
```

---

## Step 4: Run Image Generation (W02)

### 4.1 What Happens

When you click **Run** on the Image Widget (`w-img-scene`):

1. **Dispatcher** resolves the active provider (`deerflow` or `byteplus-modelark`) for image generation
2. **Request builder** (`buildRichMediaWidgetRunRequest`) assembles the prompt from node properties, connected values, and workspace context
3. **Adapter routing**:
   - DeerFlow provider -> DeerFlow runs endpoint (`/api/runs/stream`) with artifact normalization
   - BytePlus provider -> BytePlus image generation endpoint
4. **Proxy auth behavior**:
   - DeerFlow provider: no Authorization header injected (gateway handles upstream auth)
   - BytePlus provider: injects `Authorization: Bearer <env-byteplus-key>`
5. **Response** is normalized and written as `imageUrl` to the node properties
6. **Rich Media Panel** (`p-img-scene`) renders the generated image

### 4.2 User Action

1. Select the `w-img-scene` node
2. Click **Run**
3. The generated scene reference image appears in the connected Rich Media Panel

### 4.3 Data Flow

```
Canvas Run -> useFlowEditorWorkflowActions.ts
  -> resolveRichMediaWidgetKind(node) = 'image'
  -> runRichMediaWidgetGeneration(node, connectedValues, markdownText, config)
  -> buildRichMediaWidgetRunRequest(node, connectedValues, markdownText)
  -> runGenerationWithProvider(kind='image')
  -> deerflow: POST /__chat_proxy/api/runs/stream -> artifact URL -> GET /__chat_proxy/api/threads/{id}/artifacts/*
     or byteplus-modelark: POST /__chat_proxy/api/v3/image/generation
  -> proxy auth per provider policy
  -> normalized image URL
  -> Write node.properties.imageUrl
```

---

## Step 5: Run Video Generation (W03)

### 5.1 What Happens

When you click **Run** on the Video Widget (`w-video-scene`):

1. **Dispatcher** resolves the active provider (`deerflow` or `byteplus-modelark`)
2. **Request builder** assembles the video prompt, including the reference image from `w-img-scene` via the connected edge
3. **Adapter routing**:
   - DeerFlow provider -> DeerFlow runs endpoint (`/api/runs/stream`) with artifact normalization
   - BytePlus provider -> BytePlus video task create/poll endpoints
4. **Proxy auth behavior** follows provider policy (DeerFlow no injected auth; BytePlus server-managed injects key)
5. **Response** is normalized and written as `videoUrl` to the node properties
6. **Rich Media Panel** (`p-video-scene`) renders the generated video

### 5.2 User Action

1. Ensure `w-img-scene` has a generated `imageUrl` (from Step 4)
2. Select the `w-video-scene` node
3. Click **Run**
4. The generated video clip appears in the connected Rich Media Panel

### 5.3 Data Flow

```
Canvas Run -> useFlowEditorWorkflowActions.ts
  -> resolveRichMediaWidgetKind(node) = 'video'
  -> runRichMediaWidgetGeneration(node, connectedValues, markdownText, config)
  -> buildRichMediaWidgetRunRequest(node, connectedValues, markdownText)
  -> runGenerationWithProvider(kind='video')
  -> deerflow: POST /__chat_proxy/api/runs/stream -> artifact URL -> GET /__chat_proxy/api/threads/{id}/artifacts/*
     or byteplus-modelark: POST /__chat_proxy/api/v3/contents/generations/tasks -> poll task status
  -> proxy auth per provider policy
  -> normalized video URL
  -> Write node.properties.videoUrl
```

---

## Step 6: End-to-End Pipeline Execution

### 6.1 Full DAG Run

Run all nodes in sequence:

1. **W01** (Text) -> generates structured prompts for all locales
2. **W02** (Image) -> generates scene reference image from the text output
3. **W03** (Video) -> generates video clip using the reference image

The DAG topology ensures correct execution order: text feeds image, image feeds video.

### 6.2 Multi-Locale Parallel Execution (DeerFlow Agent)

When DeerFlow's agent runtime is fully wired, all three locales (US Wild West, Caribbean Tempest, SG RoboTown) execute concurrently via sub-agents:

```mermaid
flowchart TD
    BRIEF["Markdown Brief"] --> AGENT["DeerFlow Lead Agent"]
    AGENT -->|"sub-agent 1"| US["US Wild West\nresearch -> prompt -> image -> video"]
    AGENT -->|"sub-agent 2"| CAR["Caribbean Tempest\nresearch -> prompt -> image -> video"]
    AGENT -->|"sub-agent 3"| SG["SG RoboTown\nresearch -> prompt -> image -> video"]
    US --> ART["Artifact Normalizer"]
    CAR --> ART
    SG --> ART
    ART --> CANVAS["Canvas DAG\n3 parallel branches"]
```

---

## Step 7: Verify and Validate

### 7.1 Hardcode-Forbid Verification

The canonical fixture `knowgrph-video-demo.md` must never be referenced by absolute filesystem path in source code. Validation:

```bash
# Must return zero matches in tracked source
git grep -n "/Users/" -- canvas/src/ \
  ':(exclude)canvas/node_modules/**' \
  ':(exclude)canvas/dist/**'
```

The fixture is loaded via the docs-SSOT helper:

```ts
import { readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'
const text = readDocsSsotFixtureText('knowgrph-video-demo.md')
```

### 7.2 Focused Test Suite

Run the DeerFlow-specific validation tests:

```bash
# MainPanel Integrations DeerFlow surface checks
node --import tsx src/__tests__/mainPanelIntegrations.test.ts

# Video demo renderer isolation (fixture-driven)
node --import tsx src/__tests__/workspaceImportVideoDemoRendererIsolation.test.tsx

# Flow Editor registry DeerFlow seed
node --import tsx src/__tests__/flowEditorManagerRegistry.test.ts

# Rich media runtime dispatch
node --import tsx src/__tests__/flowWidgetOutputRichMediaReuse.test.ts
```

### 7.3 Contract Verification

| Contract | What to Verify | How |
|----------|---------------|-----|
| DFI-C001 | DeerFlow SSOT rows visible in Integrations | Search "deerflow" in MainPanel |
| DFI-C002 | Anchor deep-links resolve | Click anchor from Flow Manager |
| DFI-C003 | Frontmatter metadata parsed | Open `knowgrph-video-demo.md` and check graph nodes |
| DFI-C004 | Provider dispatch uses active provider | Run text generation with `chatProvider = 'deerflow'` |
| DFI-C007 | Artifacts render in Rich Media Panel | Run W01/W02/W03 and check panel output |

---

## Troubleshooting

### DeerFlow Gateway Unreachable

**Symptom**: Text generation returns network error
**Check**: `curl http://localhost:8001/api/llm/chat/completions`
**Fix**: Ensure DeerFlow gateway is running on port 8001

### Provider Not Routing to DeerFlow

**Symptom**: Requests go to BytePlus instead of DeerFlow
**Check**: `store.chatProvider` in browser console
**Fix**: Set `chatProvider = 'deerflow'` in Integrations settings

### Image/Video Generation Fails with DeerFlow Provider

**Symptom**: Image or video run returns error when provider is `deerflow`
**Check**: DeerFlow gateway exposes `/api/runs/stream` and returns artifact references resolvable from the active upstream
**Fix**: Validate DeerFlow runtime config for image/video skills and ensure artifact URLs are reachable through the proxy path

### API Key Not Working in Prod

**Symptom**: Requests fail with auth error on `airvio.co` but work locally
**Check**: Cloudflare Pages > Settings > Production > Variables and Secrets
**Fix**: Ensure `KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY` (or `OPENAI_API_KEY`) and `KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY` (or `BYTEPLUS_API_KEY`) are set as **Secrets** (not plain Variables)

### Fixture Not Found

**Symptom**: `knowgrph-video-demo.md` not loaded as workspace seed
**Check**: `VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT` env var points to folder containing the fixture
**Fix**: Set the env var before starting the dev server

---

## Proxy Architecture Reference

### Request Flow: Dev vs Prod

```
DEV MODE (Vite Dev Server):
  Browser -> POST localhost:5173/__chat_proxy/*
          -> vite.config.ts middleware (createChatProxyHandler)
          -> reads process.env for API keys
          -> forwards to localhost:8001 (DeerFlow / BytePlus / OpenAI)

PROD MODE (Cloudflare Pages + Tunnel):
  Browser -> POST airvio.co/__chat_proxy/*
          -> functions/__chat_proxy/[[path]].js (Pages Function)
          -> reads env bindings for API keys
          -> forwards to Cloudflare Tunnel URL
          -> tunnel -> localhost:8001 (DeerFlow gateway on your machine)
          -> DeerFlow gateway -> upstream LLM
```

### Proxy Key Resolution Matrix

| Provider | `requiresOpenAiKey` | `requiresBytePlusKey` | Auth Header | Key Source |
|----------|--------------------|-----------------------|-------------|------------|
| `deerflow` | false | false | **None** | DeerFlow gateway handles own auth |
| `openai` | true | false | `Bearer <openai-key>` | `KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY` or `OPENAI_API_KEY` |
| `byteplus-modelark` | false | true | `Bearer <byteplus-key>` | `KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY` or `BYTEPLUS_API_KEY` |
| `lm-studio` | false | false | **None** | Local gateway (same as DeerFlow) |

### Environment Variable Summary

| Variable | Dev Source | Prod Source | Used By |
|----------|-----------|-------------|---------|
| `KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY` | `process.env` | Cloudflare Secret | OpenAI provider auth |
| `OPENAI_API_KEY` | `process.env` | Cloudflare Secret | Fallback OpenAI key |
| `KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY` | `process.env` | Cloudflare Secret | BytePlus provider auth |
| `BYTEPLUS_API_KEY` | `process.env` | Cloudflare Secret | Fallback BytePlus key |
| `KNOWGRPH_CHAT_PROXY_UPSTREAM` | `process.env` | Cloudflare Variable | Default upstream URL |
| `KNOWGRPH_CHAT_PROXY_TIMEOUT_MS` | `process.env` | Cloudflare Variable | Proxy timeout |
| `KNOWGRPH_INTEGRATION_ALLOWED_HOSTS` | `process.env` | Cloudflare Variable | Allowed upstream hosts |

---

## Source File Reference

| File | Role |
|------|------|
| `canvas/src/lib/chatEndpoint.ts` | Provider constants, endpoint URLs, normalization, proxy header builder |
| `canvas/src/features/panels/views/deerflowApiDocs.ts` | DeerFlow SSOT integration rows |
| `canvas/src/features/panels/views/useSettingsView.ts` | Integrations tab composition with DeerFlow area |
| `canvas/src/features/flow-editor-manager/registryTemplates.ts` | Provider-family inference and widget normalization |
| `canvas/src/components/FlowEditorCanvas/runtime/useFlowEditorWorkflowActions.ts` | Runtime dispatch for text/image/video generation |
| `canvas/src/features/chat/richMediaRun.ts` | Rich media request builder and BytePlus adapters |
| `canvas/src/features/chat/byteplusRunGeneration.ts` | Provider execution functions |
| `canvas/src/hooks/store/uiSliceChat.ts` | Auth mode state, auto-switching, API key sanitization |
| `canvas/src/tests/lib/docsSsotFixture.ts` | Canonical fixture loading helper |
| `canvas/vite.config.ts` | Dev-mode chat proxy middleware (`createChatProxyHandler`) |
| `huijoohwee/functions/__chat_proxy/[[path]].js` | Prod-mode Cloudflare Pages Function proxy |
| `huijoohwee/functions/api/_integrationHub.js` | Shared proxy utilities (allowed hosts, CORS, upstream resolution) |
| `huijoohwee/functions/api/llm/chat/completions.js` | DeerFlow LLM surface (stricter model allowlist) |

---

## Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 4.0.0 | 2026-05-09 | joohwee | Added "DeerFlow Is Optional" section with feature matrix, updated prerequisites with Required? column |
| 3.0.0 | 2026-05-09 | joohwee | Added Prod Mode DeerFlow via Cloudflare Tunnel (free, local machine), named tunnel for stable URL, LaunchAgent/systemd persistence, updated data flow diagrams |
| 2.0.0 | 2026-05-09 | joohwee | Added Dev/Prod proxy architecture, API key management, production proxy everywhere strategy, proxy key resolution matrix |
| 1.0.0 | 2026-05-09 | joohwee | Initial from-0-to-1 setup guide with user journey, workflow, and data flow |
