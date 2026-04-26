---
source: https://docs.byteplus.com/en/docs/ModelArk/1666945
source-id: "1666945"
provider: BytePlus
api-family: Ark Image Generation API
base-url: https://ark.ap-southeast.bytepluses.com/api/v3
auth: API Key (Bearer)
async-pattern: stream
retrieved: 2026-04-26
fetch-status: scraped-raw
schema: "| endpoint | kind | key | type | value | required | direction | location | scope | pattern | key-description | value-description | module | class | function |"
kind-vocab: "header · path · param · return · enum · error · config"
location-vocab: "path · query · body · header · —"
pattern-vocab: "scalar · union · array<union> · webhook · state-machine · —"
direction-vocab: "in · out"
---

# BytePlus · Ark Image Generation API

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
The API operation this row belongs to. Format: `METHOD /path` (relative to `base-url`), e.g. `POST /api/v3/images/generations`. Use `ALL` for rows that apply globally across every endpoint (base URL, auth headers). Sort rows by endpoint, then by kind order within each endpoint.

**Kind sort order within an endpoint:** `config → header → path → param → return → enum → error`
This mirrors the natural implementation read order: setup → request → response → reference → errors.

---

#### `kind`
Controlled vocabulary. Classifies what type of entity the row describes. Determines which other columns are applicable (see sparsity rules below).

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
The canonical field name as it appears on the wire (API param name, header name, response field, error code key). For nested fields use dot-notation: `data[].url`, `error.code`. For codebase binding rows, use the internal symbol name and cross-reference via `key-description`.

**Key sort order:** a→z within each `kind` group within each `endpoint`, except `enum` rows which sort a→z by `value`.

---

#### `type`
Data type of the field. Use wire-format types: `string`, `integer`, `boolean`, `float`, `array<T>`, `object`, `string (url)`, `string (base64)`, `integer (unix)`. For enums, repeat the parent type (usually `string`). For discriminated union arrays, use `array<object (union)>`.

---

#### `value`
The fixed, default, or example value for this field. Use backtick formatting for literal values: `` `application/json` ``. Leave blank if the value is caller-supplied and has no fixed default. For `enum` rows, this column carries the specific enum value being documented.

---

#### `required`
Whether the field must be present. Controlled vocabulary:

| value | meaning |
|-------|---------|
| `yes` | Always required |
| `no` | Optional |
| `conditional` | Required only under specific conditions (explain in `value-description`) |
| `—` | Not applicable (used for `enum` and `error` rows) |

---

#### `direction`
Data flow relative to the caller.

| value | meaning |
|--------|---------|
| `in` | Caller → Server (request) |
| `out` | Server → Caller (response) |

---

#### `location`
Where on the wire this field lives. Disambiguates `param` rows and is always populated for `path`, `header`, `param`, and `return` kinds. Use `—` for `config`, `enum`, and `error` rows.

| value | meaning |
|--------|---------|
| `path` | Interpolated into the URL path, e.g. `/tasks/{id}` |
| `query` | Appended to the URL as a query string, e.g. `?limit=10` |
| `body` | Sent in the HTTP request or response body (JSON unless noted) |
| `header` | Transmitted in an HTTP header |
| `—` | Not applicable (`config`, `enum`, `error`) |

---

#### `scope`
Applicability constraint for this row — which versions, plans, tiers, or named variants the field applies to. Leave blank (populate with `—`) when the field applies universally to all variants of this endpoint.

**Format:** a pipe-separated list of named applicability tokens, e.g. `seedream-5-0-lite \| seedream-4-5`.

Use the API's own version/model/plan naming conventions verbatim. Do not invent abbreviations.

**Sparsity rule:** populate only when the field is genuinely restricted. A field available in all variants must carry `—`, not a list of every variant. Use `scope` to flag **exclusions**, not to repeat the universal case.

---

#### `pattern`
Structural pattern of this field's value shape. Enables tooling to select the correct parsing and validation strategy without reading prose.

| value | meaning |
|--------|---------|
| `scalar` | Single atomic value (string, integer, boolean, float) |
| `union` | Object whose shape is determined by a discriminant field (`type`, `kind`, etc.) |
| `array<union>` | Array where each element is a discriminated union object |
| `webhook` | String field that, when set, causes the server to POST responses to the supplied URL rather than (or in addition to) returning them inline |
| `state-machine` | Enumerable field whose values represent discrete lifecycle states with defined legal transitions |
| `—` | Not applicable or pattern is trivially scalar (use for `header`, `path`, `enum`, `error`, `config`) |

**Sparsity rule:** use `scalar` only when the distinction matters (i.e. the field is in a context where non-scalar patterns also appear). For `header`, `path`, `enum`, `error`, and most `config` rows, populate with `—`.

---

#### `key-description`
**Pattern: role → action → outcome**
Who uses this field → what it does mechanically → why it matters / what it affects downstream.

Format: `{Actor} → {verb phrase} → {consequence}`

- Actor is typically `Caller`, `Server`, or `Operator`
- Each clause is load-bearing; omit decorative clauses
- Do not describe the value range here (that belongs in `value-description`)

---

#### `value-description`
**Pattern: structured prose with `{{placeholders}}`**
Describes the valid value space, defaults, constraints, and behavioural notes for the field.

Omit inapplicable sub-clauses. Conditions under which a `conditional` field is required must be stated here.

---

#### `module · class · function`
Codebase binding columns. Leave blank during the API reference pass. Populated in a separate binding pass via static analysis or manual mapping.

---

### Categorisation Decisions

**`kind = config` vs `kind = param`**
`config` is for environment-level or operational settings not part of the wire request body (base URL, polling interval, TTL constants). `param` is for per-request fields sent in the HTTP body or query string.

**`kind = enum` rows**
Each valid value for a constrained field gets its own `enum` row. The `key` column repeats the parent param key. The `value` column carries the specific enum value. `required = —`. This makes each option independently queryable and annotatable without embedding all options in a single `value-description` cell.

**`required = conditional`**
Use when a field is required only in certain configurations. Always state the triggering condition in `value-description`.

**`endpoint = ALL`**
Use only for rows that are literally universal — apply to every endpoint in this document regardless of method or path. Typically: `base_url` config, `Authorization` header, `Content-Type` header.

**`key` for nested fields**
Use dot-notation for response object fields: `data[].url`, `data[].b64_json`, `error.code`. Bracket notation `[]` indicates array element. Keep nesting explicit so rows are independently parseable without reading surrounding context.

**Async / Streaming**
`async-pattern: stream` — when `stream=true` is passed, the server pushes SSE events. Streaming event objects are documented as `return` rows under a conceptual `sse_event` parent with `scope: stream=true`. Non-streaming response fields carry `scope: stream=false` where ambiguity exists; fields present in both contexts carry `scope: —`.

---

## Table

| endpoint | kind | key | type | value | required | direction | location | scope | pattern | key-description | value-description | module | class | function |
|----------|------|-----|------|-------|----------|-----------|----------|-------|---------|-----------------|-------------------|--------|-------|----------|
| ALL | config | base_url | string | `https://ark.ap-southeast.bytepluses.com/api/v3` | yes | in | — | — | — | Operator → set regional base URL → scopes all requests to the correct inference cluster | Two regions supported; ap-southeast-1: `https://ark.ap-southeast.bytepluses.com/api/v3`; eu-west-1: `https://ark.eu-west.bytepluses.com/api/v3`; region mismatch causes 401 or 404; no trailing slash | | | |
| ALL | header | Authorization | string | `Bearer <API_KEY>` | yes | in | header | — | — | Caller → authenticate request → grants access to Ark inference endpoints | API Key only; obtain long-term key from the API Key management console page; format: `Bearer <key>` | | | |
| ALL | header | Content-Type | string | `application/json` | yes | in | header | — | — | Caller → declare request body encoding → ensures server parses JSON body correctly | Fixed value; no other encoding accepted | | | |
| POST /api/v3/images/generations | param | guidance_scale | float | | no | in | body | seedream-3-0-t2i \| seededit-3-0-i2i | scalar | Caller → control prompt adherence strength → trades creative freedom for fidelity to prompt text | Default: 2.5 (seedream-3-0-t2i), 5.5 (seededit-3-0-i2i); Min: 1; Max: 10; Higher values reduce model creative freedom and increase prompt adherence; not supported on seedream-5-0-lite, seedream-4-5, seedream-4-0 | | | |
| POST /api/v3/images/generations | param | image | string \| array<string> | | no | in | body | — | scalar | Caller → supply reference image(s) → conditions generation on visual input for editing or style transfer | Accepts Base64 string or accessible URL; Base64 format must be `data:image/<format>;base64,<data>` where format is lowercase; seedream-5-0-lite, seedream-4-5, seedream-4-0 accept 1–14 images; seededit-3-0-i2i accepts single image only; not supported by seedream-3-0-t2i; Formats: JPEG, PNG (seedream-5-0-lite/4-5/4-0 also support WEBP, BMP, TIFF, GIF); AR range [1/16, 16] for seedream-5-0-lite/4-5/4-0, [1/3, 3] for seededit-3-0-i2i; Min dimension: 14px per side; Max size: 10 MB per image; Max total pixels: 6000×6000 = 36,000,000 per image | | | |
| POST /api/v3/images/generations | param | model | string | | yes | in | body | — | scalar | Caller → specify target model or endpoint → determines generation capability, image limits, and supported parameters | Accepts a Model ID (see Model List docs) or a custom Inference Endpoint ID; choice of model gates which other parameters are valid | | | |
| POST /api/v3/images/generations | param | optimize_prompt_options | object | | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Caller → configure prompt optimisation behaviour → controls quality vs speed tradeoff of pre-generation prompt rewriting | Container object; effective only when prompt optimisation is active; seedream-4-5 supports standard mode only | | | |
| POST /api/v3/images/generations | param | optimize_prompt_options.mode | string | `standard` | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Caller → select prompt optimisation mode → governs latency and output quality of the optimisation step | Default: standard; Options: standard → higher quality, longer generation time \| fast → lower latency, average quality; seedream-4-5 supports standard only | | | |
| POST /api/v3/images/generations | param | output_format | string | `jpeg` | no | in | body | seedream-5-0-lite | scalar | Caller → specify output image file format → controls encoded format of returned image bytes | Default: jpeg; Options: jpeg \| png; seedream-4-5, seedream-4-0, seededit-3-0-i2i, and seedream-3-0-t2i always output jpeg and do not support this parameter | | | |
| POST /api/v3/images/generations | param | prompt | string | | yes | in | body | — | scalar | Caller → supply text description → drives the model's image synthesis process | Max recommended: 600 English words; excessively long prompts scatter semantic focus causing missing details; see Seedream 4.0–4.5 and Seedream 3.0 prompt guides in docs | | | |
| POST /api/v3/images/generations | param | response_format | string | `url` | no | in | body | — | scalar | Caller → select image delivery mechanism → determines whether images are returned as expiring URLs or inline Base64 data | Default: url; Options: url → time-limited HTTPS download link (expires 24 h after generation; save before expiry) \| b64_json → image data embedded as Base64 string in JSON response body | | | |
| POST /api/v3/images/generations | param | seed | integer | `-1` | no | in | body | seedream-3-0-t2i \| seededit-3-0-i2i | scalar | Caller → fix random seed → enables reproducible or deliberately varied outputs across calls | Default: -1 (random); Range: [-1, 2147483647]; same seed on same request produces similar but not guaranteed identical output; different seed values always yield different outputs; not supported on seedream-5-0-lite, seedream-4-5, seedream-4-0 | | | |
| POST /api/v3/images/generations | param | sequential_image_generation | string | `disabled` | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Caller → enable or disable batch image generation → controls whether the model returns one image or a thematically related set | Default: disabled; Options: auto → model determines output count based on prompt \| disabled → exactly one image generated; when auto, pair with sequential_image_generation_options to cap count | | | |
| POST /api/v3/images/generations | param | sequential_image_generation_options | object | | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Caller → configure batch generation constraints → sets upper bound on images produced in a single call | Effective only when sequential_image_generation = auto; container object; see child field max_images | | | |
| POST /api/v3/images/generations | param | sequential_image_generation_options.max_images | integer | `15` | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Caller → cap batch image count → prevents over-generation and controls billing exposure | Default: 15; Min: 1; Max: 15; Constraint: number_of_input_images + max_images ≤ 15; actual output count jointly determined by this value and input reference image count | | | |
| POST /api/v3/images/generations | param | size | string | `2048x2048` | no | in | body | — | scalar | Caller → specify output image dimensions → sets resolution and aspect ratio of generated image | Two mutually exclusive methods; Method 1 (named resolution): pass a named tier string and describe aspect ratio in prompt — valid values are model-scoped (see enum rows); Method 2 (pixel dimensions): pass `<width>x<height>` — default 2048×2048; both total-pixel range and aspect-ratio range must be satisfied simultaneously; see per-model constraints in value-description of enum rows and docs | | | |
| POST /api/v3/images/generations | param | stream | boolean | `false` | no | in | body | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Caller → enable Server-Sent Events streaming → delivers each image immediately after generation rather than waiting for all images | Default: false; true → SSE stream; each generated image pushed as an event as soon as ready; applies to both single and batch generation; false → all images returned in one response | | | |
| POST /api/v3/images/generations | param | watermark | boolean | `true` | no | in | body | — | scalar | Caller → control AI watermark visibility → adds or suppresses the "AI generated" watermark on output images | Default: true; true → "AI generated" watermark applied to bottom-right corner of each output image \| false → no watermark | | | |
| POST /api/v3/images/generations | return | created | integer (unix) | | yes | out | body | — | scalar | Server → record request creation timestamp → allows caller to correlate responses and measure latency | Unix timestamp in seconds; present in both streaming (per-event) and non-streaming responses | | | |
| POST /api/v3/images/generations | return | data | array<object (union)> | | yes | out | body | stream=false | array<union> | Server → return array of image results → delivers all generated images and any per-image errors in a single payload | Each element is either a success object (url or b64_json + size) or a failure object (error); when batch generation is used and one image fails due to content filter, remaining images are still attempted; if failure is due to internal error (500), subsequent batch images are not attempted | | | |
| POST /api/v3/images/generations | return | data[].b64_json | string (base64) | | conditional | out | body | stream=false | scalar | Server → deliver image as inline Base64 string → enables callers that cannot follow redirects or store URLs | Required when response_format = b64_json; absent when response_format = url; mutually exclusive with data[].url | | | |
| POST /api/v3/images/generations | return | data[].error | object | | no | out | body | stream=false | — | Server → report per-image generation failure → isolates errors to individual images so other results are still usable | Present only when the specific image failed to generate; contains error.code and error.message; see Error Codes docs for full code list | | | |
| POST /api/v3/images/generations | return | data[].error.code | string | | no | out | body | stream=false | — | Server → identify failure reason for a specific image → allows caller to distinguish content-filter rejections from service errors | See Error Codes reference; example: OutputImageSensitiveContentDetected | | | |
| POST /api/v3/images/generations | return | data[].error.message | string | | no | out | body | stream=false | — | Server → provide human-readable failure description for a specific image → aids debugging | Plain text; present alongside data[].error.code | | | |
| POST /api/v3/images/generations | return | data[].size | string | | no | out | body | stream=false \| seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Server → report actual pixel dimensions of generated image → lets caller confirm output resolution without decoding the image | Format: `<width>×<height>` e.g. `2048×2048`; not returned by seedream-3-0-t2i or seededit-3-0-i2i | | | |
| POST /api/v3/images/generations | return | data[].url | string (url) | | conditional | out | body | stream=false | scalar | Server → deliver image as expiring HTTPS download link → standard delivery mode for URL-based workflows | Required when response_format = url; absent when response_format = b64_json; expires 24 h after generation; save or re-download before expiry | | | |
| POST /api/v3/images/generations | return | error | object | | no | out | body | — | — | Server → signal request-level failure → indicates the entire request failed, not an individual image failure | Present only when the request itself fails; contains error.code and error.message; distinct from data[].error which is per-image | | | |
| POST /api/v3/images/generations | return | error.code | string | | no | out | body | — | — | Server → identify request-level failure type → maps to documented error code taxonomy | See Error Codes reference; example: BadRequest | | | |
| POST /api/v3/images/generations | return | error.message | string | | no | out | body | — | — | Server → provide human-readable request-level failure description → aids debugging and end-user messaging | Plain text; includes Request ID in some error messages | | | |
| POST /api/v3/images/generations | return | model | string | | yes | out | body | — | scalar | Server → echo resolved model identifier → confirms which model version processed the request | Format: `<model_name>-<version>` e.g. `seedream-5-0-260128`; present in both streaming (per-event) and non-streaming responses | | | |
| POST /api/v3/images/generations | return | sse_event | object | | no | out | body | stream=true | union | Server → push individual SSE event → delivers real-time per-image generation result or final completion signal during streaming | Conceptual parent for Server-Sent Events stream objects; each event is a standalone JSON object; discriminant field: `type`; three variants: image_generation.partial_succeeded, image_generation.partial_failed, image_generation.completed; stream closes after image_generation.completed | | | |
| POST /api/v3/images/generations | return | sse_event.b64_json | string (base64) | | conditional | out | body | stream=true | scalar | Server → deliver streamed image as inline Base64 data → enables callers that cannot store URLs to receive image bytes in the event payload | Present in image_generation.partial_succeeded events only when response_format = b64_json; absent when response_format = url | | | |
| POST /api/v3/images/generations | return | sse_event.created | integer (unix) | | yes | out | body | stream=true | scalar | Server → timestamp each SSE event → allows caller to order events and measure streaming latency | Unix timestamp in seconds; same value appears in all events for a given request | | | |
| POST /api/v3/images/generations | return | sse_event.error | object | | no | out | body | stream=true | — | Server → report per-image failure in stream → isolates failed image within a batch without terminating the stream | Present in image_generation.partial_failed events only; contains error.code and error.message sub-fields; if failure is content-filter rejection, next image task still proceeds; if failure is internal error (500), subsequent images are not attempted | | | |
| POST /api/v3/images/generations | return | sse_event.error.code | string | | no | out | body | stream=true | — | Server → identify streaming image failure reason → distinguishes content-filter rejections from service errors | See Error Codes reference; present in image_generation.partial_failed events only | | | |
| POST /api/v3/images/generations | return | sse_event.error.message | string | | no | out | body | stream=true | — | Server → provide human-readable failure description in stream → aids debugging of per-image failures during batch streaming | Plain text; present in image_generation.partial_failed events only | | | |
| POST /api/v3/images/generations | return | sse_event.image_index | integer | | yes | out | body | stream=true | scalar | Server → assign sequential index to each image event → allows caller to correlate partial events to original batch order | Starts at 0; auto-increments by 1 for every image_generation.partial_succeeded and image_generation.partial_failed event regardless of success/failure; present in partial_succeeded and partial_failed events; absent from image_generation.completed | | | |
| POST /api/v3/images/generations | return | sse_event.model | string | | yes | out | body | stream=true | scalar | Server → echo resolved model identifier in each SSE event → confirms processing model per event | Format: `<model_name>-<version>`; same value in all events for a given request | | | |
| POST /api/v3/images/generations | return | sse_event.size | string | | yes | out | body | stream=true \| seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | scalar | Server → report actual pixel dimensions of streamed image → lets caller determine output resolution without decoding the image | Format: `<width>×<height>` e.g. `2048×2048`; present in image_generation.partial_succeeded events only | | | |
| POST /api/v3/images/generations | return | sse_event.type | string | | yes | out | body | stream=true | union | Server → identify SSE event variant → drives caller's branching logic for processing stream events | Discriminant field; Options: image_generation.partial_succeeded → one image successfully generated \| image_generation.partial_failed → one image failed \| image_generation.completed → all images processed, stream closing | | | |
| POST /api/v3/images/generations | return | sse_event.url | string (url) | | conditional | out | body | stream=true | scalar | Server → deliver streamed image as expiring download URL → standard streaming delivery for URL-based workflows | Present in image_generation.partial_succeeded events only when response_format = url; expires 24 h after generation; save before expiry | | | |
| POST /api/v3/images/generations | return | sse_event.usage | object | | yes | out | body | stream=true | — | Server → report final token and image consumption in stream → enables billing reconciliation after streaming completes | Present in image_generation.completed event only; container for generated_images, output_tokens, total_tokens | | | |
| POST /api/v3/images/generations | return | sse_event.usage.generated_images | integer | | yes | out | body | stream=true | scalar | Server → report count of successfully generated images in stream → billing basis (failed images not counted) | Present in image_generation.completed event only; excludes images that failed to generate | | | |
| POST /api/v3/images/generations | return | sse_event.usage.output_tokens | integer | | yes | out | body | stream=true | scalar | Server → report token consumption for generated images in stream → enables per-request cost attribution | Present in image_generation.completed event only; calculated as round(sum(width × height) / 256) across all successful images | | | |
| POST /api/v3/images/generations | return | sse_event.usage.total_tokens | integer | | yes | out | body | stream=true | scalar | Server → report total tokens consumed in streaming request → equals output_tokens as input tokens are not billed | Present in image_generation.completed event only; same value as sse_event.usage.output_tokens; input tokens currently not calculated | | | |
| POST /api/v3/images/generations | return | usage | object | | yes | out | body | stream=false | — | Server → report request-level token and image consumption → enables billing reconciliation for non-streaming calls | Container object; present in non-streaming response; contains generated_images, output_tokens, total_tokens | | | |
| POST /api/v3/images/generations | return | usage.generated_images | integer | | yes | out | body | stream=false | scalar | Server → report count of successfully generated images → billing basis for the request | Only successfully generated images counted; failed images excluded; billing applied per successfully generated image | | | |
| POST /api/v3/images/generations | return | usage.output_tokens | integer | | yes | out | body | stream=false | scalar | Server → report token consumption for generated images → enables per-request cost attribution | Calculated as round(sum(image_width × image_height) / 256) across all successful images | | | |
| POST /api/v3/images/generations | return | usage.total_tokens | integer | | yes | out | body | stream=false | scalar | Server → report total tokens consumed by request → equals output_tokens as input tokens are not currently billed | Same value as usage.output_tokens; input tokens not calculated at this time | | | |
| POST /api/v3/images/generations | enum | optimize_prompt_options.mode | string | `fast` | — | in | — | seedream-5-0-lite \| seedream-4-0 | — | Lower-latency prompt optimisation at average quality; not available for seedream-4-5 | — | | | |
| POST /api/v3/images/generations | enum | optimize_prompt_options.mode | string | `standard` | — | in | — | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Higher quality prompt optimisation; longer generation time; only mode available for seedream-4-5 | — | | | |
| POST /api/v3/images/generations | enum | output_format | string | `jpeg` | — | in | — | seedream-5-0-lite | — | JPEG output; default; smaller file size; lossy compression | — | | | |
| POST /api/v3/images/generations | enum | output_format | string | `png` | — | in | — | seedream-5-0-lite | — | PNG output; lossless; larger file size | — | | | |
| POST /api/v3/images/generations | enum | response_format | string | `b64_json` | — | in | — | — | — | Image returned as Base64-encoded string inline in JSON response body; use when downstream cannot follow HTTP redirects or store expiring URLs | — | | | |
| POST /api/v3/images/generations | enum | response_format | string | `url` | — | in | — | — | — | Image returned as expiring HTTPS download URL; default; link valid for 24 h after generation; caller must save image before expiry | — | | | |
| POST /api/v3/images/generations | enum | sequential_image_generation | string | `auto` | — | in | — | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Model determines output image count and whether to generate a batch; use sequential_image_generation_options.max_images to cap the maximum | — | | | |
| POST /api/v3/images/generations | enum | sequential_image_generation | string | `disabled` | — | in | — | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Exactly one image generated regardless of prompt content; default behaviour | — | | | |
| POST /api/v3/images/generations | enum | size | string | `1K` | — | in | — | seedream-4-0 | — | Named resolution tier; model selects width/height; describe aspect ratio in prompt; 1K reference: 1024×1024 (1:1) | — | | | |
| POST /api/v3/images/generations | enum | size | string | `2K` | — | in | — | seedream-5-0-lite \| seedream-4-5 \| seedream-4-0 | — | Named resolution tier; model selects width/height; describe aspect ratio in prompt; 2K reference: 2048×2048 (1:1) | — | | | |
| POST /api/v3/images/generations | enum | size | string | `3K` | — | in | — | seedream-5-0-lite | — | Named resolution tier; model selects width/height; describe aspect ratio in prompt; 3K reference: 3072×3072 (1:1); total pixel range [3,686,400, 10,404,496] | — | | | |
| POST /api/v3/images/generations | enum | size | string | `4K` | — | in | — | seedream-4-5 \| seedream-4-0 | — | Named resolution tier; model selects width/height; describe aspect ratio in prompt; 4K reference: 4096×4096 (1:1); total pixel range [3,686,400, 16,777,216] | — | | | |
| POST /api/v3/images/generations | enum | size | string | `adaptive` | — | in | — | seededit-3-0-i2i | — | Output dimensions auto-selected by comparing input image aspect ratio to nearest preset in lookup table; only supported mode for seededit-3-0-i2i | — | | | |
| POST /api/v3/images/generations | enum | sse_event.type | string | `image_generation.completed` | — | out | — | stream=true | — | Final SSE event; emitted after all image generation tasks (successful and failed) have been processed; stream closes after this event; carries usage statistics | — | | | |
| POST /api/v3/images/generations | enum | sse_event.type | string | `image_generation.partial_failed` | — | out | — | stream=true | — | SSE event emitted when a single image fails to generate; carries image_index and error details; does not terminate the stream for content-filter failures | — | | | |
| POST /api/v3/images/generations | enum | sse_event.type | string | `image_generation.partial_succeeded` | — | out | — | stream=true | — | SSE event emitted immediately when a single image is successfully generated; carries image_index, url or b64_json, and size | — | | | |
| POST /api/v3/images/generations | error | error.code | string | `BadRequest` | — | out | — | — | — | Missing or malformed required parameters | Request rejected before generation; check required fields model and prompt; Request ID included in error.message | | | |
| POST /api/v3/images/generations | error | error.code | string | `OutputImageSensitiveContentDetected` | — | out | — | — | — | Generated image rejected by content safety filter | Occurs at image level (data[].error.code) in batch; in streaming, next image task still proceeds; at request level triggers full request failure | | | |

---

*Source: BytePlus Ark Image Generation API · docs ID 1666945 · retrieved 2026-04-26*
*fetch-status: scraped-raw*
*`module · class · function` columns intentionally blank — pending codebase binding pass*