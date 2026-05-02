---
source: https://docs.byteplus.com/en/docs/ModelArk/chat-api
source-id: byteplus-modelark-chat-api
provider: BytePlus
api-family: ModelArk Chat API
base-url: https://ark.ap-southeast.bytepluses.com/api/v3
auth: api-key
async-pattern: stream
retrieved: 2026-04-26
fetch-status: fetched
schema: "| endpoint | kind | key | type | value | required | direction | location | scope | pattern | key-description | value-description | module | class | function |"
kind-vocab: "header · path · param · return · enum · error · config"
location-vocab: "path · query · body · header · —"
pattern-vocab: "scalar · union · array<union> · webhook · state-machine · —"
direction-vocab: "in · out"
---

# BytePlus · ModelArk Chat API

---

## Schema Legend

### Column Order & Zone Logic

```
[ANCHOR]       [CLASSIFY]        [IDENTITY]        [CONTRACT]                        [CLASSIFY-2]               [PROSE]                              [BINDING]
endpoint       kind              key · type · val  required · direction               location · scope · pattern key-description · value-description  module · class · function
```

`endpoint` is col 1 because it is the primary grouping key — every other column is subordinate to it. A reader scans endpoint first to locate their context, then reads right into the row.

Zones read left-to-right from most structural (machine-queryable, sparse-friendly) to most discursive (human prose, binding metadata). The four sparsest columns (`module · class · function`, often blank during API reference pass) land at the far right so the informational core stays compact.

---

### Column Definitions

#### `endpoint`
The API operation this row belongs to. Format: `METHOD /path` (relative to `base-url`), e.g. `POST /chat/completions`. Use `ALL` for rows that apply globally across every endpoint (base URL, auth headers). Sort rows by endpoint, then by kind order within each endpoint.

**Kind sort order within an endpoint:** `config → header → path → param → return → enum → error`

---

#### `kind`
Controlled vocabulary. Classifies what type of entity the row describes.

| kind | meaning | typical `direction` | `required` |
|------|---------|-------------------|------------|
| `config` | Operational/environment-level setting not part of the wire format | `in` or `out` | `yes` or `—` |
| `header` | HTTP request or response header | `in` or `out` | `yes` or `no` |
| `path` | URL path segment variable, interpolated before the request is sent | `in` | `yes` |
| `param` | Request body or query string parameter | `in` | `yes`, `no`, or `conditional` |
| `return` | Response body field | `out` | `yes`, `no`, or `conditional` |
| `enum` | Enumerated valid value for a `param` or `return` key | same as parent | `—` |
| `error` | HTTP status code or named error code returned by the server | `out` | `—` |

---

#### `key`
The canonical field name as it appears on the wire. For nested fields use dot-notation: `choices[].message.content`. Bracket notation `[]` indicates array element.

---

#### `type`
Wire-format type: `string`, `integer`, `boolean`, `float`, `array<T>`, `object`, `string (url)`, `string (base64)`, `integer (unix)`, `map`.

---

#### `value`
Fixed, default, or enum value. Use backtick formatting for literals. Leave blank if caller-supplied with no fixed default.

---

#### `required`
`yes` · `no` · `conditional` · `—` (not applicable for enum/error)

---

#### `direction`
`in` = Caller → Server · `out` = Server → Caller

---

#### `location`
`path` · `query` · `body` · `header` · `—`

---

#### `scope`
Applicability constraint (version, tier, mode). `—` = universal. Only populated when genuinely restricted.

---

#### `pattern`
`scalar` · `union` · `array<union>` · `webhook` · `state-machine` · `—`

---

#### `key-description`
`{Actor} → {verb phrase} → {consequence}`

---

#### `value-description`
Structured prose: valid value space, defaults, constraints, behavioural notes.

---

#### `module · class · function`
Codebase binding columns — blank during API reference pass.

---

## Table

| endpoint | kind | key | type | value | required | direction | location | scope | pattern | key-description | value-description | module | class | function |
|----------|------|-----|------|-------|----------|-----------|----------|-------|---------|-----------------|-------------------|--------|-------|----------|
| ALL | config | base_url | string | `https://ark.ap-southeast.bytepluses.com/api/v3` | yes | in | — | — | — | Operator → set regional base URL → scopes all requests to the correct ModelArk inference cluster | Two regions: ap-southeast-1 → `https://ark.ap-southeast.bytepluses.com/api/v3`; eu-west-1 → `https://ark.eu-west.bytepluses.com/api/v3`; no trailing slash; region mismatch causes routing failure | | | |
| ALL | header | Authorization | string | `Bearer <api_key>` | yes | in | header | — | — | Caller → authenticate request → grants access to the ModelArk API | API key authentication; format: `Bearer {api_key}`; access key authentication requires the SDK instead | | | |
| ALL | header | Content-Type | string | `application/json` | yes | in | header | — | — | Caller → declare request body encoding → ensures server parses JSON body correctly | Fixed value; no other encoding accepted | | | |
| POST /chat/completions | param | frequency_penalty | float/null | `0` | no | in | body | — | scalar | Caller → penalise token repetition by frequency → reduces likelihood of repeated phrases | Default: 0; Min: -2.0; Max: 2.0; Positive values penalise based on cumulative frequency; not supported by seed-1.8 and seed-2.0 series | | | |
| POST /chat/completions | param | logit_bias | map/null | | no | in | body | — | — | Caller → bias token log-probabilities → steers model toward or away from specific vocabulary tokens | Keys are token IDs from the tokenization API; values range [-100, 100]; -100 = token forbidden; 100 = token exclusive; actual effect varies by model; not supported by deep reasoning models | | | |
| POST /chat/completions | param | logprobs | boolean/null | `false` | no | in | body | — | scalar | Caller → request per-token log-probability output → enables downstream probability analysis | Default: false; true → logprob returned for each token in message; false → no logprob returned; not supported by deep reasoning models | | | |
| POST /chat/completions | param | max_completion_tokens | integer/null | | no | in | body | deep-reasoning-models | scalar | Caller → cap total output length including chain-of-thought → prevents runaway generation on reasoning models | Range: [0, 65536]; controls combined response + chain-of-thought token budget; when set, model ignores max_tokens default; mutually exclusive with max_tokens; see Deep reasoning docs for supported models | | | |
| POST /chat/completions | param | max_tokens | integer/null | `4096` | no | in | body | — | scalar | Caller → cap response length in tokens → controls cost and latency | Default: 4096; range varies by model (see Model list); limits model response only, excluding chain-of-thought content; also bounded by model context length; mutually exclusive with max_completion_tokens | | | |
| POST /chat/completions | param | messages | array<object (union)> | | yes | in | body | — | array<union> | Caller → supply conversation history → provides context for model response generation | Discriminant: role; Variants: system → instruction message | user → user turn message | assistant → model reply or prefill | tool → tool result; minimum one message required; supported message types (text, image, video) vary by model | | | |
| POST /chat/completions | param | messages[].content | string/object[] | | conditional | in | body | — | union | Caller → provide message payload → carries the actual content the model processes | Required for system, user, and tool role messages; for assistant role, at least one of content or tool_calls must be present; string form = plaintext; object[] form = multimodal (text, image_url, video_url items) | | | |
| POST /chat/completions | param | messages[].content[].image_url | object | | conditional | in | body | — | union | Caller → supply image input → enables visual understanding for the turn | Required when messages[].content[].type = image_url; wraps url and optional detail/image_pixel_limit sub-fields | | | |
| POST /chat/completions | param | messages[].content[].image_url.detail | string/null | | no | in | body | — | scalar | Caller → control image understanding granularity → trades token cost for pixel fidelity | Options: low → lowest granularity; high → high granularity; xhigh → highest granularity; default varies by model; overridden by image_pixel_limit if both are set | | | |
| POST /chat/completions | param | messages[].content[].image_url.image_pixel_limit | object/null | `null` | no | in | body | — | union | Caller → override pixel bounds for image resizing → fine-tunes image scaling independently of detail preset | Default: null; takes precedence over detail when set; image pixel count must remain within [196, 36,000,000] or request fails; unset sub-fields inherit values from the detail preset | | | |
| POST /chat/completions | param | messages[].content[].image_url.image_pixel_limit.max_pixels | integer | | no | in | body | — | scalar | Caller → set maximum pixel ceiling → images exceeding this are proportionally scaled down | For models prior to seed-1.8: (min_pixels, 4014080]; for seed-1.8 and seed-2.0: (min_pixels, 9031680]; if unset, uses max_pixels from detail preset | | | |
| POST /chat/completions | param | messages[].content[].image_url.image_pixel_limit.min_pixels | integer | | no | in | body | — | scalar | Caller → set minimum pixel floor → images below this are proportionally scaled up | For models prior to seed-1.8: [3136, max_pixels); for seed-1.8 and seed-2.0: [1764, max_pixels); if unset, uses min_pixels from detail preset | | | |
| POST /chat/completions | param | messages[].content[].image_url.url | string | | yes | in | body | — | scalar | Caller → supply image source → delivers image data to the model | Accepts image URL or base64-encoded string; see Image input methods docs for supported formats | | | |
| POST /chat/completions | param | messages[].content[].text | string | | conditional | in | body | — | scalar | Caller → supply text payload in multimodal message → provides textual component of a mixed-modality turn | Required when messages[].content[].type = text | | | |
| POST /chat/completions | param | messages[].content[].type | string | | yes | in | body | — | scalar | Caller → declare content modality → determines which sibling fields the server expects | Discriminant for multimodal content object; Options: text → text content object; image_url → image content object; video_url → video content object | | | |
| POST /chat/completions | param | messages[].content[].video_url | object | | conditional | in | body | — | union | Caller → supply video input → enables video understanding for the turn | Required when messages[].content[].type = video_url; audio comprehension for video is not supported | | | |
| POST /chat/completions | param | messages[].content[].video_url.fps | float/null | `1` | no | in | body | — | scalar | Caller → set frame extraction rate → balances video comprehension depth against token cost | Default: 1; Range: [0.2, 5]; higher value → more frames extracted → better temporal understanding, more tokens; lower value → fewer frames → faster and cheaper but less temporal detail | | | |
| POST /chat/completions | param | messages[].content[].video_url.url | string | | yes | in | body | — | scalar | Caller → supply video source → delivers video data to the model | Accepts video URL or base64-encoded string; see Video input methods docs for supported formats | | | |
| POST /chat/completions | param | messages[].encrypted_content | string | | no | in | body | seed-2-0-pro-260328+ | scalar | Caller → pass back encrypted reasoning content → allows model to resume prior chain-of-thought securely | Supported from seed-2-0-pro-260328; takes precedence over reasoning_content if both present; must be valid and untampered — invalid value causes "Invalid signature" error; reasoning_content is ignored when this field is set | | | |
| POST /chat/completions | param | messages[].reasoning_content | string | | no | in | body | deep-reasoning-models | scalar | Caller → pass back chain-of-thought in assistant history → enables multi-turn reasoning continuity | Supported by seed-1.8, seed-2.0, and deepseek-v3.2; overridden by encrypted_content if both are provided | | | |
| POST /chat/completions | param | messages[].role | string | | yes | in | body | — | scalar | Caller → declare message sender role → determines message structure and model behaviour for that turn | Discriminant for the messages union; Options: system → instruction message; user → user turn; assistant → model reply or prefill; tool → tool result message | | | |
| POST /chat/completions | param | messages[].tool_call_id | string | | conditional | in | body | — | scalar | Caller → associate tool result with prior tool invocation → links tool response to the correct model request | Required when messages[].role = tool; must match the id generated by the model when it requested tool calling | | | |
| POST /chat/completions | param | messages[].tool_calls | object[] | | conditional | in | body | — | array<union> | Caller → supply model's prior tool invocations in assistant history → enables multi-turn function calling continuity | For assistant role messages in history: at least one of content or tool_calls must be present; each element describes a tool the model previously called | | | |
| POST /chat/completions | param | messages[].tool_calls[].function | object | | yes | in | body | — | union | Caller → specify function call details → identifies which function and parameters the model used | Required sub-object containing name and arguments | | | |
| POST /chat/completions | param | messages[].tool_calls[].function.arguments | string | | yes | in | body | — | scalar | Caller → provide function arguments as JSON string → passes model-generated parameters back for tool execution | JSON-formatted string; model may generate invalid or extra parameters; caller must validate before execution | | | |
| POST /chat/completions | param | messages[].tool_calls[].function.name | string | | yes | in | body | — | scalar | Caller → identify called function by name → matches invocation to a registered tool definition | Must match a function name in the tools list | | | |
| POST /chat/completions | param | messages[].tool_calls[].id | string | | yes | in | body | — | scalar | Caller → supply tool call identifier → associates this invocation record with the model's tool response | ID generated by the model; must match tool_call_id in the corresponding tool message | | | |
| POST /chat/completions | param | messages[].tool_calls[].type | string | | yes | in | body | — | scalar | Caller → declare tool type → currently always function | Fixed value: function | | | |
| POST /chat/completions | param | model | string | | yes | in | body | — | scalar | Caller → select target model or endpoint → routes request to the correct inference backend | Model ID or endpoint ID; activate a model service before use; endpoint ID enables rate limit queries, billing method selection, and advanced features such as monitoring | | | |
| POST /chat/completions | param | parallel_tool_calls | boolean | `true` | no | in | body | — | scalar | Caller → allow or restrict concurrent tool invocations per response → controls multi-tool response composition | Default: true; true → multiple tools may appear in one response; false → response contains ≤ 1 tool call; false only effective for seed-1.6 and later series | | | |
| POST /chat/completions | param | presence_penalty | float/null | `0` | no | in | body | — | scalar | Caller → penalise token presence across output → encourages the model to introduce new topics | Default: 0; Min: -2.0; Max: 2.0; positive values penalise tokens already present in the output; not supported by seed-1.8 and seed-2.0 series | | | |
| POST /chat/completions | param | reasoning_effort | string/null | `medium` | no | in | body | deep-reasoning-models | scalar | Caller → set chain-of-thought depth → trades response latency for reasoning thoroughness | Default: medium; Options: minimal → no reasoning, immediate response; low → fast, low-effort reasoning; medium → balanced speed and depth; high → deep analysis for complex tasks; see Deep reasoning docs for supported models and interaction with thinking.type | | | |
| POST /chat/completions | param | response_format | object | `{"type":"text"}` | no | in | body | beta | union | Caller → constrain output structure → enforces text, JSON object, or schema-validated JSON | Default: {"type":"text"}; beta feature — use caution in production; discriminant: type; Variants: text → free-form text; json_object → valid JSON object; json_schema → schema-validated JSON | | | |
| POST /chat/completions | param | response_format.json_schema | object | | conditional | in | body | beta | union | Caller → define JSON schema for structured output → ensures model response conforms to a declared schema | Required when response_format.type = json_schema; contains name, optional description, schema, and strict sub-fields | | | |
| POST /chat/completions | param | response_format.json_schema.description | string/null | | no | in | body | beta | scalar | Caller → describe schema purpose → guides model in interpreting how to produce schema-conforming output | Optional free-text description; model uses it to understand response intent | | | |
| POST /chat/completions | param | response_format.json_schema.name | string | | yes | in | body | beta | scalar | Caller → name the JSON schema → identifies the schema definition | User-defined identifier for the schema | | | |
| POST /chat/completions | param | response_format.json_schema.schema | object | | yes | in | body | beta | union | Caller → define the output schema → constrains model response to a declared JSON structure | JSON Schema object describing the required response format | | | |
| POST /chat/completions | param | response_format.json_schema.strict | boolean/null | `false` | no | in | body | beta | scalar | Caller → enable strict schema adherence → controls how rigidly model follows the schema | Default: false; true → model always follows schema exactly; false → model follows schema as closely as possible | | | |
| POST /chat/completions | param | response_format.type | string | | yes | in | body | beta | scalar | Caller → select output format mode → determines whether response is free text, JSON object, or schema-validated JSON | Required when response_format is set; Options: text; json_object; json_schema | | | |
| POST /chat/completions | param | service_tier | string/null | `auto` | no | in | body | — | scalar | Caller → opt in or out of TPM guarantee package quota → controls service tier and associated latency/availability | Default: auto; auto → uses TPM guarantee package if endpoint has quota, otherwise falls back to default tier; default → never uses TPM package quota | | | |
| POST /chat/completions | param | stop | string/string[]/null | `null` | no | in | body | — | scalar | Caller → declare stop sequences → halts generation when any specified string is encountered | Default: null; up to 4 strings; matched strings are excluded from output; not supported by deep reasoning models | | | |
| POST /chat/completions | param | stream | boolean/null | `false` | no | in | body | — | scalar | Caller → enable streaming output → switches between batch and SSE delivery modes | Default: false; false → complete response returned at once; true → content streamed as SSE chunks per SSE protocol, ending with `data: [DONE]`; when true, stream_options may be set | | | |
| POST /chat/completions | param | stream_options | object/null | `null` | no | in | body | stream | union | Caller → configure streaming behaviour → controls auxiliary data emitted alongside streamed content | Only applicable when stream = true; currently exposes include_usage sub-field | | | |
| POST /chat/completions | param | stream_options.include_usage | boolean/null | `false` | no | in | body | stream | scalar | Caller → request token usage in stream → appends a usage summary block before `data: [DONE]` | Default: false; true → extra chunk emitted before [DONE] containing full request usage, choices = []; false → no usage returned during streaming | | | |
| POST /chat/completions | param | temperature | float/null | `1` | no | in | body | — | scalar | Caller → set sampling temperature → controls randomness of model output | Default: 1; Range: [0, 2]; 0 → deterministic (highest logprob token only); higher values increase randomness; lower values increase determinism; do not set alongside top_p | | | |
| POST /chat/completions | param | thinking | object | `{"type":"enabled"}` | no | in | body | deep-reasoning-models | union | Caller → enable or disable chain-of-thought reasoning mode → controls whether model thinks before responding | Default: {"type":"enabled"} for supporting models; default and support vary by model; see Deep reasoning docs | | | |
| POST /chat/completions | param | thinking.type | string | | yes | in | body | deep-reasoning-models | scalar | Caller → select reasoning mode → determines if and when the model applies chain-of-thought | Required when thinking object is present; Options: enabled → model always thinks before answering; disabled → model answers directly; auto → model decides based on question complexity | | | |
| POST /chat/completions | param | tool_choice | string/object | | no | in | body | seed-1.6+ | union | Caller → control tool invocation policy for the request → overrides model's default tool-use decision | Default: none when no tools specified; default: auto when tools are specified; string form selects a named policy; object form forces a specific function; only seed-1.6 and later series support this parameter | | | |
| POST /chat/completions | param | tool_choice.function | object | | conditional | in | body | seed-1.6+ | union | Caller → specify exact function to invoke → forces model to call one particular tool | Required when tool_choice is an object; contains name sub-field | | | |
| POST /chat/completions | param | tool_choice.function.name | string | | conditional | in | body | seed-1.6+ | scalar | Caller → name the function to force-call → identifies the target tool | Required when tool_choice is an object; must match a function name in tools list | | | |
| POST /chat/completions | param | tool_choice.type | string | | conditional | in | body | seed-1.6+ | scalar | Caller → declare tool choice type → currently always function | Required when tool_choice is an object; fixed value: function | | | |
| POST /chat/completions | param | tools | array<object>/null | `null` | no | in | body | — | array<union> | Caller → declare available tools → enables the model to generate tool call responses | Default: null; required for model to call functions; each element defines one tool; see Tool use docs for supported models | | | |
| POST /chat/completions | param | tools[].function | object | | yes | in | body | — | union | Caller → define function specification → provides the model with callable function metadata | Required; contains name, optional description, and optional parameters | | | |
| POST /chat/completions | param | tools[].function.description | string | | no | in | body | — | scalar | Caller → describe function purpose → helps the model decide whether to invoke this function | Free-text description; used by model for tool selection heuristics | | | |
| POST /chat/completions | param | tools[].function.name | string | | yes | in | body | — | scalar | Caller → name the callable function → identifies the tool in model responses and tool_calls | Required; case-sensitive; used as key in tool_calls responses | | | |
| POST /chat/completions | param | tools[].function.parameters | object | | no | in | body | — | union | Caller → declare function parameter schema → constrains and guides model-generated arguments | JSON Schema object; all parameter names are case-sensitive; must be a valid JSON Schema object; model may generate parameters not in spec — caller must validate | | | |
| POST /chat/completions | param | tools[].type | string | | yes | in | body | — | scalar | Caller → declare tool type → currently always function | Fixed value: function | | | |
| POST /chat/completions | param | top_logprobs | integer/null | `0` | no | in | body | — | scalar | Caller → request top-N token candidates per position → exposes alternative token probabilities | Default: 0; Range: [0, 20]; only applicable when logprobs = true; not supported by deep reasoning models | | | |
| POST /chat/completions | param | top_p | float/null | `0.7` | no | in | body | — | scalar | Caller → set nucleus sampling threshold → controls diversity by restricting token candidate pool | Default: 0.7; Range: [0, 1]; 0 → highest-logprob token only; higher values → more diverse output; do not set alongside temperature | | | |
| POST /chat/completions | return | choices | object[] | | yes | out | body | — | array<union> | Server → return model outputs → contains all candidate completions for the request | Array of completion objects; each element corresponds to one model output candidate | | | |
| POST /chat/completions | return | choices[].delta | object | | yes | out | body | stream | union | Server → emit incremental content chunk → carries the partial output for this SSE event | Present only in streaming responses (stream = true); analogous to choices[].message in non-streaming; contains role, content, reasoning_content, encrypted_content, tool_calls sub-fields | | | |
| POST /chat/completions | return | choices[].delta.content | string | | no | out | body | stream | scalar | Server → deliver incremental text output → the partial model response for this chunk | May be empty string during reasoning phase or when encrypted_content is being emitted | | | |
| POST /chat/completions | return | choices[].delta.encrypted_content | string | | no | out | body | seed-2-0-pro-260328+ | scalar | Server → emit encrypted compressed reasoning summary → enables secure reasoning content pass-through | Supported from seed-2-0-pro-260328; emitted in a single chunk after reasoning content finishes and before final response begins; in that chunk, content and reasoning_content are both empty | | | |
| POST /chat/completions | return | choices[].delta.reasoning_content | string/null | | no | out | body | deep-reasoning-models | scalar | Server → stream chain-of-thought content → exposes model's reasoning process incrementally | Supported by deep reasoning models only; starting from seed-2-0-pro-260328, returns a summary of the reasoning content; increase TTFT and TPOT timeouts for long-form or deep reasoning tasks | | | |
| POST /chat/completions | return | choices[].delta.role | string | | no | out | body | stream | scalar | Server → identify content author → always assistant for model-generated streaming chunks | Fixed value: assistant | | | |
| POST /chat/completions | return | choices[].delta.tool_calls | object[]/null | | no | out | body | stream | array<union> | Server → stream tool invocation increments → delivers partial tool call data across chunks | Each element carries incremental id, type, and function sub-fields; accumulate across chunks to reconstruct full tool calls | | | |
| POST /chat/completions | return | choices[].delta.tool_calls[].function | object | | no | out | body | stream | union | Server → stream function call details → carries incremental name and arguments for the invoked function | Contains name and arguments sub-fields | | | |
| POST /chat/completions | return | choices[].delta.tool_calls[].function.arguments | string | | no | out | body | stream | scalar | Server → stream function argument JSON incrementally → caller accumulates chunks to form complete arguments | JSON-formatted string; model may generate invalid or undefined parameters; validate before calling the function | | | |
| POST /chat/completions | return | choices[].delta.tool_calls[].function.name | string | | no | out | body | stream | scalar | Server → identify called function → names the function in the incremental tool call | | | |
| POST /chat/completions | return | choices[].delta.tool_calls[].id | string | | no | out | body | stream | scalar | Server → assign tool call identifier → used to correlate tool result in subsequent turn | | | |
| POST /chat/completions | return | choices[].delta.tool_calls[].type | string | | no | out | body | stream | scalar | Server → declare tool type → fixed value: function | Fixed value: function | | | |
| POST /chat/completions | return | choices[].finish_reason | string | | yes | out | body | — | state-machine | Server → signal generation termination reason → indicates why the model stopped producing tokens | States: stop → stop string detected or natural end; length → token limit reached (max_tokens, max_completion_tokens, or context_window); content_filter → output blocked by content moderation; tool_calls → model invoked a tool; null in streaming chunks until final chunk | | | |
| POST /chat/completions | return | choices[].index | integer | | yes | out | body | — | scalar | Server → index element in choices array → position of this completion candidate | Zero-based index into the choices array | | | |
| POST /chat/completions | return | choices[].logprobs | object/null | | no | out | body | — | union | Server → return log-probability metadata → exposes token-level probability information when requested | Present only when logprobs = true in request; null otherwise | | | |
| POST /chat/completions | return | choices[].logprobs.content | object[]/null | | no | out | body | — | array<union> | Server → return per-token logprob list → one entry per token in the output content | Each element corresponds to one output token | | | |
| POST /chat/completions | return | choices[].logprobs.content[].bytes | integer[]/null | | no | out | body | — | scalar | Server → expose UTF-8 byte values of token → enables decoding of multi-token characters | List of integers representing UTF-8 encoding; empty list if token has no UTF-8 representation | | | |
| POST /chat/completions | return | choices[].logprobs.content[].logprob | float | | yes | out | body | — | scalar | Server → return log-probability of token → quantifies model confidence in this token selection | Natural log probability of the token at this position | | | |
| POST /chat/completions | return | choices[].logprobs.content[].token | string | | yes | out | body | — | scalar | Server → identify the token → the actual token string at this position | The decoded token text | | | |
| POST /chat/completions | return | choices[].logprobs.content[].top_logprobs | object[] | | yes | out | body | — | array<union> | Server → return top-N alternative tokens at this position → exposes competing token candidates | Count may be less than top_logprobs request value in some cases | | | |
| POST /chat/completions | return | choices[].logprobs.content[].top_logprobs[].bytes | integer[]/null | | no | out | body | — | scalar | Server → expose UTF-8 byte values of candidate token → enables decoding of multi-token characters | List of integers; empty if token has no UTF-8 representation | | | |
| POST /chat/completions | return | choices[].logprobs.content[].top_logprobs[].logprob | float | | yes | out | body | — | scalar | Server → return candidate token log-probability → quantifies model's estimated likelihood for this alternative | Natural log probability of this candidate token | | | |
| POST /chat/completions | return | choices[].logprobs.content[].top_logprobs[].token | string | | yes | out | body | — | scalar | Server → identify candidate token → the alternative token text at this position | The decoded candidate token | | | |
| POST /chat/completions | return | choices[].message | object | | yes | out | body | non-stream | union | Server → deliver complete model output → the full response for this completion candidate | Present only in non-streaming responses; analogous to choices[].delta in streaming; contains role, content, reasoning_content, tool_calls sub-fields | | | |
| POST /chat/completions | return | choices[].message.content | string | | yes | out | body | non-stream | scalar | Server → return generated text response → the model's answer to the input | The complete text output of the model for this completion | | | |
| POST /chat/completions | return | choices[].message.reasoning_content | string/null | | no | out | body | deep-reasoning-models | scalar | Server → expose chain-of-thought reasoning → the model's internal problem-solving narrative | Supported by deep reasoning models only; null for standard models | | | |
| POST /chat/completions | return | choices[].message.role | string | | yes | out | body | non-stream | scalar | Server → identify content author → always assistant for model-generated responses | Fixed value: assistant | | | |
| POST /chat/completions | return | choices[].message.tool_calls | object[]/null | | no | out | body | non-stream | array<union> | Server → return tool invocations requested by model → list of functions the model wants to call | Present when finish_reason = tool_calls; null otherwise | | | |
| POST /chat/completions | return | choices[].message.tool_calls[].function | object | | yes | out | body | non-stream | union | Server → describe the called function → name and arguments for the invoked tool | Contains name and arguments sub-fields | | | |
| POST /chat/completions | return | choices[].message.tool_calls[].function.arguments | string | | yes | out | body | non-stream | scalar | Server → return model-generated function arguments → JSON string of parameters for the function call | Model may generate invalid or extra parameters not in spec; caller must validate before execution | | | |
| POST /chat/completions | return | choices[].message.tool_calls[].function.name | string | | yes | out | body | non-stream | scalar | Server → identify function to call → name of the target function | | | |
| POST /chat/completions | return | choices[].message.tool_calls[].id | string | | yes | out | body | non-stream | scalar | Server → assign tool call identifier → must be echoed in tool_call_id of the subsequent tool message | Generated by the model; used to correlate tool results in the next turn | | | |
| POST /chat/completions | return | choices[].message.tool_calls[].type | string | | yes | out | body | non-stream | scalar | Server → declare tool type → fixed value: function | Fixed value: function | | | |
| POST /chat/completions | return | choices[].moderation_hit_type | string/null | | no | out | body | visual-understanding-models | scalar | Server → flag sensitive content in model output → returns risk classification tag if output contains sensitive information | Null when no sensitive content detected; only returned by visual understanding models; requires ModerationStrategy = Basic on endpoint settings or via CreateEndpoint API | | | |
| POST /chat/completions | return | created | integer | | yes | out | body | — | scalar | Server → record request creation timestamp → Unix epoch seconds of when the request was created | Integer Unix timestamp in seconds | | | |
| POST /chat/completions | return | id | string | | yes | out | body | — | scalar | Server → assign unique request identifier → enables request tracing and deduplication | Unique string identifier for this request | | | |
| POST /chat/completions | return | model | string | | yes | out | body | — | scalar | Server → echo model used → identifies which model version processed the request | Full model name and version string | | | |
| POST /chat/completions | return | object | string | | yes | out | body | — | scalar | Server → declare response object type → distinguishes streaming from non-streaming response envelopes | Value: `chat.completion` (non-streaming) or `chat.completion.chunk` (streaming) | | | |
| POST /chat/completions | return | service_tier | string | | yes | out | body | — | scalar | Server → report service tier used → indicates whether TPM guarantee package quota was applied | Values: scale → TPM guarantee package quota used; default → standard tier applied | | | |
| POST /chat/completions | return | usage | object | | conditional | out | body | — | union | Server → report token consumption → provides billing and quota tracking data | Always present in non-streaming responses; null by default in streaming; set stream_options.include_usage = true to receive usage in streaming mode | | | |
| POST /chat/completions | return | usage.completion_tokens | integer | | yes | out | body | — | scalar | Server → count output tokens → number of tokens generated by the model in this response | Excludes chain-of-thought tokens; see completion_tokens_details for breakdown | | | |
| POST /chat/completions | return | usage.completion_tokens_details | object | | yes | out | body | — | union | Server → break down output token usage → sub-categorises completion tokens | Contains reasoning_tokens sub-field | | | |
| POST /chat/completions | return | usage.completion_tokens_details.reasoning_tokens | integer | | no | out | body | deep-reasoning-models | scalar | Server → count reasoning chain tokens → number of tokens consumed by chain-of-thought content | Present for deep reasoning models only; see Deep reasoning docs for supported models | | | |
| POST /chat/completions | return | usage.prompt_tokens | integer | | yes | out | body | — | scalar | Server → count input tokens → number of tokens in the request prompt | Total prompt token count including all messages | | | |
| POST /chat/completions | return | usage.prompt_tokens_details | object | | yes | out | body | — | union | Server → break down prompt token usage → sub-categorises input tokens | Contains cached_tokens sub-field | | | |
| POST /chat/completions | return | usage.prompt_tokens_details.cached_tokens | integer | `0` | yes | out | body | — | scalar | Server → report prompt cache hits → number of tokens served from prompt cache | Currently always 0 | | | |
| POST /chat/completions | return | usage.total_tokens | integer | | yes | out | body | — | scalar | Server → report total token consumption → sum of all prompt and completion tokens for billing | Equals usage.prompt_tokens + usage.completion_tokens | | | |
| POST /chat/completions | enum | messages[].content[].image_url.detail | string | `high` | — | in | — | — | — | Caller → select high-granularity image understanding | High granularity; higher pixel range; more tokens consumed | | | |
| POST /chat/completions | enum | messages[].content[].image_url.detail | string | `low` | — | in | — | — | — | Caller → select low-granularity image understanding | Lowest granularity; reduced pixel range; fewer tokens consumed | | | |
| POST /chat/completions | enum | messages[].content[].image_url.detail | string | `xhigh` | — | in | — | — | — | Caller → select extra-high-granularity image understanding | Highest granularity; maximum pixel range; most tokens consumed | | | |
| POST /chat/completions | enum | messages[].content[].type | string | `image_url` | — | in | — | — | — | Caller → declare image modality → activates image_url sub-object | Content element is an image; image_url field required | | | |
| POST /chat/completions | enum | messages[].content[].type | string | `text` | — | in | — | — | — | Caller → declare text modality → activates text sub-field | Content element is plain text; text field required | | | |
| POST /chat/completions | enum | messages[].content[].type | string | `video_url` | — | in | — | — | — | Caller → declare video modality → activates video_url sub-object | Content element is a video; video_url field required; audio comprehension not supported | | | |
| POST /chat/completions | enum | messages[].role | string | `assistant` | — | in | — | — | — | Caller → mark message as model reply → used for multi-turn history and response prefilling | Model reply or prefill message; at least one of content or tool_calls required | | | |
| POST /chat/completions | enum | messages[].role | string | `system` | — | in | — | — | — | Caller → mark message as system instruction → sets model persona, context, and constraints | System instruction message; content required | | | |
| POST /chat/completions | enum | messages[].role | string | `tool` | — | in | — | — | — | Caller → mark message as tool result → returns function output back to the model | Tool result message; content and tool_call_id required | | | |
| POST /chat/completions | enum | messages[].role | string | `user` | — | in | — | — | — | Caller → mark message as user turn → the human side of the conversation | User message; content required; supports text, image, and video modalities (model-dependent) | | | |
| POST /chat/completions | enum | reasoning_effort | string | `high` | — | in | — | deep-reasoning-models | — | Caller → maximise reasoning depth → suitable for complex multi-step problems | Deep analysis mode; highest latency | | | |
| POST /chat/completions | enum | reasoning_effort | string | `low` | — | in | — | deep-reasoning-models | — | Caller → apply lightweight reasoning → faster response with reduced analysis | Fast response with low-effort reasoning | | | |
| POST /chat/completions | enum | reasoning_effort | string | `medium` | — | in | — | deep-reasoning-models | — | Caller → apply balanced reasoning → default trade-off between speed and depth | Default; balanced speed and reasoning quality | | | |
| POST /chat/completions | enum | reasoning_effort | string | `minimal` | — | in | — | deep-reasoning-models | — | Caller → skip reasoning → immediate response without chain-of-thought | No reasoning; fastest response | | | |
| POST /chat/completions | enum | response_format.type | string | `json_object` | — | in | — | beta | — | Caller → request JSON object output → model response is a valid JSON object | Beta feature; see Supported models docs; model response is structured as a JSON object | | | |
| POST /chat/completions | enum | response_format.type | string | `json_schema` | — | in | — | beta | — | Caller → request schema-validated JSON → model response conforms to caller-defined JSON Schema | Beta feature; requires response_format.json_schema sub-object; see Supported models docs | | | |
| POST /chat/completions | enum | response_format.type | string | `text` | — | in | — | — | — | Caller → request plain text output → default model response format | Default behaviour; no structural constraint on output | | | |
| POST /chat/completions | enum | service_tier | string | `auto` | — | in | — | — | — | Caller → automatically use TPM package if available | Uses TPM guarantee package quota if endpoint has one; falls back to default tier otherwise | | | |
| POST /chat/completions | enum | service_tier | string | `default` | — | in | — | — | — | Caller → force standard service tier → bypasses TPM package quota | Always applies default tier even if endpoint has TPM quota | | | |
| POST /chat/completions | enum | thinking.type | string | `auto` | — | in | — | deep-reasoning-models | — | Caller → let model decide whether to reason → adaptive mode based on question complexity | Model skips thinking for simple questions and applies it for complex ones | | | |
| POST /chat/completions | enum | thinking.type | string | `disabled` | — | in | — | deep-reasoning-models | — | Caller → disable chain-of-thought → model answers directly without prior reasoning | Model responds immediately without internal reasoning step | | | |
| POST /chat/completions | enum | thinking.type | string | `enabled` | — | in | — | deep-reasoning-models | — | Caller → force chain-of-thought reasoning → model always reasons before answering | Model always performs internal reasoning before producing a response | | | |
| POST /chat/completions | enum | tool_choice | string | `auto` | — | in | — | seed-1.6+ | — | Caller → let model decide tool use → model may or may not include tools in response | Default when any tools are specified | | | |
| POST /chat/completions | enum | tool_choice | string | `none` | — | in | — | seed-1.6+ | — | Caller → suppress all tool calls → model will not invoke any tools for this request | Default when no tools are specified | | | |
| POST /chat/completions | enum | tool_choice | string | `required` | — | in | — | seed-1.6+ | — | Caller → mandate tool invocation → model must include a tool call in its response | Ensure suitable tools are available to reduce hallucination | | | |
| POST /chat/completions | enum | tools[].type | string | `function` | — | in | — | — | — | Caller → declare function tool type → the only currently supported tool kind | Fixed value; only function type is supported | | | |
| POST /chat/completions | enum | choices[].finish_reason | string | `content_filter` | — | out | — | — | — | Server → signal content moderation block → output was intercepted | Model output blocked by content moderation policies | | | |
| POST /chat/completions | enum | choices[].finish_reason | string | `length` | — | out | — | — | — | Server → signal token limit reached → generation stopped due to length constraint | Triggered when max_tokens, max_completion_tokens, or context_window limit is hit | | | |
| POST /chat/completions | enum | choices[].finish_reason | string | `stop` | — | out | — | — | — | Server → signal natural or stop-sequence end → generation completed normally | Output ended naturally or a stop string from the stop parameter was encountered | | | |
| POST /chat/completions | enum | choices[].finish_reason | string | `tool_calls` | — | out | — | — | — | Server → signal tool invocation → model has generated one or more tool calls | Response includes tool_calls; caller should execute tools and send results back | | | |
| POST /chat/completions | enum | choices[].moderation_hit_type | string | `severe_violation` | — | out | — | visual-understanding-models | — | Server → flag severe content violation → output involves severe policy violations | Requires ModerationStrategy = Basic on endpoint; only visual understanding models | | | |
| POST /chat/completions | enum | choices[].moderation_hit_type | string | `violence` | — | out | — | visual-understanding-models | — | Server → flag violent content → output involves radical or violent behaviours | Requires ModerationStrategy = Basic on endpoint; only visual understanding models | | | |
| POST /chat/completions | enum | object | string | `chat.completion` | — | out | — | non-stream | — | Server → identify non-streaming response type | Returned in all non-streaming responses | | | |
| POST /chat/completions | enum | object | string | `chat.completion.chunk` | — | out | — | stream | — | Server → identify streaming chunk type | Returned in each SSE chunk during streaming | | | |
| POST /chat/completions | enum | service_tier | string | `default` | — | out | — | — | — | Server → confirm standard tier was applied → no TPM package quota was consumed | Request served at default service tier | | | |
| POST /chat/completions | enum | service_tier | string | `scale` | — | out | — | — | — | Server → confirm TPM package quota was used → higher availability and response speed | Request served using TPM guarantee package quota | | | |

---

*Source: BytePlus ModelArk Chat API · docs ID byteplus-open-ark-chat-api · retrieved 2026-04-26*
*fetch-status: fetched*
*`module · class · function` columns intentionally blank — pending codebase binding pass*