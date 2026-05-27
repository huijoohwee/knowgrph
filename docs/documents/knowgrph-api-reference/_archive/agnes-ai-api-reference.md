# Agnes AI API Online Documentation

## Agnes AI API Reference

Leverage Agnes AI’s multimodal models to quickly build applications related to text, image, and video generation, unlocking more creative and development possibilities.

### 1. Overview

The Agnes AI API grants access to Sapiens AI’s cutting-edge multimodal models, with core support for three key capabilities designed to address a wide range of development scenarios:

- Text Generation & Reasoning: Enables high-quality text creation, logical reasoning, content continuation, and other use cases, delivering output that is accurate and aligned with your requirements.
- Image Generation & Editing: Generates high-definition images from text prompts and supports image modification, optimization, and other editing functionalities.
- Synchronized Audio-Video Generation: Produces coherent, high-quality video content with perfectly synchronized audio, eliminating the need for additional post-processing.

Key compatibility note: This API is fully compatible with OpenAI-style interfaces, enabling developers to quickly migrate existing code for seamless integration and significantly reduce development time and costs.

### 2. Base URL

All API requests must be initiated based on the following base URL to ensure the request path is correct:

`https://apihub.agnes-ai.com/v1`

### 3. Authentication

To ensure the security of API usage, all requests must be authenticated using an API Key. The authentication method is as follows:

Carry the following parameter in the request header, replacing YOUR_API_KEY with your valid personal API Key to complete authentication.

`Authorization: Bearer YOUR_API_KEY`

---

## Quickstart
​
Follow these step-by-step instructions to start using the Agnes AI API quickly and efficiently.

### Prerequisites

Before making any API requests, make sure you have the following:

- An active Agnes AI Platform account
- A valid API key (generated in the Agnes AI developer dashboard)
- Sufficient account balance (required for paid API usage; free tiers may provide limited access)

### Step 1: Create an Account

Sign up for a new account, or log in to your existing Agnes AI Platform account. From the developer dashboard, you can manage API keys, billing, and more.

### Step 2: Generate an API Key

To authenticate your API requests, generate a secret API key in the Agnes AI Platform:

Navigate to: `Settings → API Keys → Create new secret key`

Save this key securely. You will use it to authenticate all API requests (as described in the Authentication section):

`Authorization: Bearer YOUR_API_KEY`

### Step 3: Add Billing Balance

To access the full set of API features, ensure your account has enough billing balance:

Navigate to: `Billing → Balance`

Follow the on-screen instructions to add funds to your account. Note: Some free usage tiers may be available for testing.

### Step 4: Make Your First Request

Below is a sample request to create a chat completion using curl (you can also use tools like Postman, Python requests, or other HTTP clients):

```bash
curl https://apihub.agnes-ai.com/v1/chat/completions \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "agnes-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'
```

### Step 5: Next Steps

After your first request, explore these next steps to get more out of the Agnes AI API:

- Review the available models in the Models section of the developer dashboard to find the best fit for your use case.
- Read the documentation for request parameters, response formats, and error handling for each API endpoint.
- Integrate advanced features like streaming responses or tool calling to enhance your application’s functionality.


---

## Models

### Text

#### Agnes-2.0-Flash
​
Agnes-2.0-Flash is a fast and efficient language model developed by Sapiens AI. It is designed for agentic workflows, tool use, coding tasks, reasoning, multi-turn conversations, and high-frequency production applications.

Agnes-2.0-Flash has achieved strong performance on the Claw-Eval benchmark, ranking #9 on the General Leaderboard with a Pass^3 score of 60.9%, demonstrating strong autonomous-agent capability among leading language models.

##### Model Overview

Agnes-2.0-Flash is optimized for fast, reliable, and cost-efficient language generation and agentic task execution.

It supports:

| Capability | Description |
| --- | --- |
| Chat Completion | Generate high-quality responses for conversations and applications |
| Multi-turn Conversation | Maintain context across multiple rounds of interaction |
| Tool Calling | Call external tools and functions for agent workflows |
| Agentic Workflow | Support planning, execution, and multi-step task completion |
| Coding Tasks | Assist with code generation, debugging, explanation, and refactoring |
| Reasoning | Handle structured reasoning, task decomposition, and decision-making |
| Streaming Output | Return responses in real time for better user experience |
| OpenAI-Compatible API | Uses a structure compatible with OpenAI Chat Completions API |

##### API Information

###### Endpoint

| Item | Description |
| --- | --- |
|API Endpoint |https://apihub.agnes-ai.com/v1/chat/completions |
|Request Method | `POST` |
|Content-Type | `application/json` |
|Authentication | Bearer Token |
|Authentication Header | `Authorization: Bearer YOUR_API_KEY` |

###### Request Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Fixed as `agnes-2.0-flash` |
| `messages` | array | Yes | Conversation messages, including system, user, and assistant messages |
| `temperature` | number | No | Controls randomness in the output. Lower values produce more deterministic responses |
| `top_p` | number | No | Controls nucleus sampling. Lower values make the output more focused |
| `max_tokens` | number | No | Maximum number of tokens to generate in the response |
| `stream` | boolean | No | Whether to enable streaming response output |
| `tools` | array | No | Tool definitions for tool-calling workflows |
| `tool_choice` | string / object | No | Controls whether and how the model uses tools |


###### Call Examples

1. Basic Chat Completion Request

Use this request to generate a normal chat completion response.

```
curl https://apihub.agnes-ai.com/v1/chat/completions \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-2.0-flash",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful AI assistant."
      },
      {
        "role": "user",
        "content": "Explain how autonomous agents use tools to complete tasks."
      }
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

2. Streaming Request

Use this request to enable streaming output.

```
curl https://apihub.agnes-ai.com/v1/chat/completions \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Write a short product introduction for an AI assistant app."
      }
    ],
    "stream": true
  }'
```

3. Tool Calling Request

Use this request for agentic workflows that require external tool calling.

```
curl https://apihub.agnes-ai.com/v1/chat/completions \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "What is the weather like in Singapore today?"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and country"
              }
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'
```

###### Response Format

```
{
  "id":"chatcmpl_xxx",
  "object":"chat.completion",
  "created":1774432125,
  "model":"agnes-2.0-flash",
  "choices": [
    {
      "index":0,
      "message": {
        "role":"assistant",
        "content":"Autonomous agents use tools by understanding the user's goal, breaking it into steps, selecting the right tools, executing actions, and using the results to complete the task."
      },
      "finish_reason":"stop"
    }
  ],
  "usage": {
    "prompt_tokens":35,
    "completion_tokens":58,
    "total_tokens":93
  }
}
```

###### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique ID of the completion request |
| `object` | string | Object type, usually `chat.completion` |
| `created` | integer | Request timestamp |
| `model` | string | Model used for the request |
| `choices` | array | Generated response choices |
| `choices[].index` | integer | Index of the response choice |
| `choices[].message` | object | Assistant message object |
| `choices[].message.role` | string | Role of the message sender |
| `choices[].message.content` | string | Generated response content |
| `choices[].finish_reason` | string | Reason why generation stopped |
| `usage` | object | Token usage information |
| `usage.prompt_tokens` | integer | Number of input tokens |
| `usage.completion_tokens` | integer | Number of output tokens |
| `usage.total_tokens` | integer | Total number of tokens used |


##### Features & Compatibility

Agnes-2.0-Flash supports:

- Chat completion
- Multi-turn conversation
- System prompt
- Streaming output
- Tool calling
- Agentic workflow
- Coding tasks
- Reasoning tasks
- JSON-style output
- OpenAI Chat Completions API-compatible request structure
- Best Practices

##### Best Practices

###### Prompt Writing

For better results, provide clear instructions, context, and expected output format.

```
You are a product marketing expert. Write a concise App Store description for an AI assistant app. The tone should be clear, professional, and user-friendly.
```

For coding tasks, include the language, framework, error message, and expected behavior.

```
Help me debug this React component. The issue is that the button state does not update after clicking. Explain the cause and provide the corrected code.
```

For agentic workflows, describe the goal, available tools, and task constraints clearly.

```
You are an autonomous research agent. Search for relevant information, summarize the key findings, and return the result in a structured format with source links.
```

###### Recommended Prompt Structure

```
[Role] + [Task] + [Context] + [Requirements] + [Output Format]
```

Example:

```
You are a senior product manager. Analyze this feature idea for an AI assistant app. Consider user value, i
```

##### Model limitation

- Context: 256K
- Max Output: 65.5K

##### Notes

- Use `agnes-2.0-flash` as the model name.
- For basic chat completion, model and messages are required.
- For streaming responses, set stream to true.
- For tool-calling workflows, provide tools and optionally tool_choice.
- temperature controls randomness. Lower values are better for deterministic tasks, while higher values are better for creative generation.
- Agnes-2.0-Flash is suitable for production applications that require fast response speed, strong task completion, and reliable agentic performance.

---


### Image

#### Agnes-Image-2.0-Flash
​
Agnes-Image-2.0-Flash is a high-performance image editing and image generation model developed by Sapiens AI. It supports image-to-image, and multi-image composition workflows, designed for fast creative production, image refinement, marketing visuals, and professional content generation.

Agnes-Image-2.0-Flash has been listed on the Artificial Analysis Image Editing Leaderboard, achieving an ELO score of 1,184 and ranking in the top 20 range, demonstrating strong image editing capability among leading image models.

##### Model Overview

Agnes-Image-2.0-Flash is optimized for fast, high-quality image generation and editing tasks.

It supports:

| Capability | Description |
| --- | --- |
| Image-to-Image | Edit, transform, or enhance an existing image |
| Multi-Image Input | Combine multiple reference images into a new image |
| Image Editing | Modify composition, style, objects, scenes, and visual details |
| Style Control | Adjust artistic style, lighting, layout, and visual direction |
| Fast Generation | Optimized for speed and cost-efficient production workflows |
| OpenAI-Compatible API | Uses a structure compatible with OpenAI Images API |

##### Applicable Scenarios

Agnes-Image-2.0-Flash is suitable for:

| Scenario | Example Use Cases |
| --- | --- |
| Creative Design | Posters, concept art, social media visuals |
| Marketing Content | Product ads, campaign creatives, banners |
| Image Editing | Object replacement, background changes, style transformation |
| Character Composition | Combine multiple characters or references into one scene |
| Visual Production | Generate assets for apps, websites, games, and videos |
| E-commerce | Product image enhancement and scene generation |
| Social Content | Memes, avatars, thumbnails, lifestyle visuals |

##### API Information

###### Endpoint

| Item | Description |
| --- | --- |
| API Endpoint | `https://apihub.agnes-ai.com/v1/images/generations` |
| Request Method | `POST` |
| Content-Type | `application/json` |
| Authentication | Bearer Token |
| Authentication Header | `Authorization: Bearer YOUR_API_KEY` |

###### Request Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Fixed as `agnes-image-2.0-flash` |
| `prompt` | string | Yes |  Text prompt describing the desired image or edit |
| `size` | string | No | Output image size, such as `1024x768`, `1024x1024`, `768x1024` |
| `seed` | number | No | Random seed for reproducible results |
| `tags` | array | No | Task type, such as ["img2img"] |
| `extra_body.image` | array | No | Input image URLs for image-to-image or multi-image workflows |
| `extra_body.response_format` | string | No | Output format, currently supports `url` |

##### Call Examples

1. Image-to-Image Request

Use this request to edit or transform an existing image.

```
curl https://apihub.agnes-ai.com/v1/images/generations \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-image-2.0-flash",
    "tags": ["img2img"],
    "prompt": "Transform this image into a cinematic cyberpunk style while preserving the main subject and composition",
    "size": "1024x768",
    "extra_body": {
      "image": [
        "https://example.com/input-image.png"
      ],
      "response_format": "url"
    }
  }'
```

2. Multi-Image Composition Request

Use this request to combine multiple input images into a new scene.

```
curl https://apihub.agnes-ai.com/v1/images/generations \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-image-2.0-flash",
    "tags": ["img2img"],
    "prompt": "Combine the two characters into an intense fantasy battle scene, dynamic lighting, detailed background, cinematic composition",
    "size": "1024x768",
    "extra_body": {
      "image": [
        "https://example.com/character-1.png",
        "https://example.com/character-2.png"
      ],
      "response_format": "url"
    }
  }'
```


##### Response Format

```
{
  "created":1774432125,
  "data": [
    {
      "url":"https://..."
    }
  ],
  "usage": {
    "generated_images":1
  }
}
```

###### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `created` | integer | Request timestamp |
| `data` | array | Generated image results |
| `data[].url` | string | URL of the generated image |
| `usage` | object | Usage information |
| `usage.generated_images` | integer |  Number of generated images |


##### Features & Compatibility

Agnes-Image-2.0-Flash supports:

- Image-to-image editing
- Multi-image input and composition
- Prompt-based image transformation
- Consistent style and composition control
- Seed-based reproducibility
- Fast generation for production workflows
- OpenAI Images API-compatible request structure
- Best Practices

##### Prompt Writing

For better results, include clear visual instructions in your prompt:

```
A professional product photo of a wireless headphone on a clean white background, soft studio lighting, sharp details, commercial photography style
```

For editing tasks, describe what should change and what should stay the same:

```
Change the background to a futuristic city at night while keeping the person’s face, outfit, and pose unchanged
```

For multi-image composition, describe the relationship between input images:

```
Place the person from the first image beside the robot from the second image in a cinematic sci-fi background
```

##### Recommended Prompt Structure

```
[Main subject] + [Scene / background] + [Style] + [Lighting] + [Composition] + [Quality requirements]
```

Example:

```
A young explorer standing in an ancient temple, cinematic fantasy style, warm dramatic lighting, wide-angle composition, ultra detailed, high quality
```
##### Notes

- Use agnes-image-2.0-flash as the model name.
- For image-to-image tasks, add tags: ["img2img"] and provide input image URLs in extra_body.image.
- For multi-image editing, provide multiple image URLs in extra_body.image.
- response_format currently supports URL output.

---

### Video

#### Agnes-Video-V2.0
​
Agnes-Video-V2.0 is a next-generation cinematic video generation model designed for high-quality text-to-video, image-to-video, multi-image video generation, and keyframe animation workflows.

It generates high-fidelity videos with strong motion consistency, scene coherence, and visual realism, enabling users to create production-ready video content from text prompts, reference images, or multiple keyframes.

Agnes-Video-V2.0 is suitable for storytelling, marketing videos, product demos, social media content, immersive visual production, and AI-powered creative workflows.

##### Model Overview

Agnes-Video-V2.0 is optimized for high-quality video generation and flexible creative control.

It supports:

| Capability | Description |
| --- | --- |
| Text-to-Video | Generate videos directly from text prompts |
| Image-to-Video | Animate a static image into a dynamic video |
| Multi-Image Video | Use multiple reference images to guide video generation |
| Keyframe Animation | Generate smooth transitions between multiple keyframes |
| Scene Motion Control | Control subject movement, camera motion, and scene dynamics through prompts |
| Visual Consistency | Maintain strong subject, style, and scene coherence across frames |
| Cinematic Output | Create visually polished videos for creative and commercial use |
| Asynchronous API | Submit a task first, then retrieve the result by task ID |

##### Applicable Scenarios

Agnes-Video-V2.0 is suitable for:

| Scenario | Example Use Cases |
| --- | --- |
| Storytelling | Short films, narrative clips, character scenes |
| Marketing Video | Product ads, campaign videos, promotional content |
| Social Media Content | Reels, Shorts, TikTok-style videos, creative posts |
| Image Animation | Animate portraits, products, characters, or scenes |
| Product Demo | Generate product showcase videos from text or images |
| Keyframe Transition | Smoothly transition between different visual states |
| Game / App Assets | Generate dynamic visual materials for digital products |
| Immersive Content | AI-generated cinematic scenes and atmospheric videos |

##### API Information

###### Endpoint

| Item | Description |
| --- | --- |
| API Endpoint - Create Task | `https://apihub.agnes-ai.com/v1/videos` |
| API Endpoint - Retrieve Result | `https://apihub.agnes-ai.com/v1/videos/{task_id}` |
| Request Method - Create Task | `POST` |
| Request Method - Retrieve Result | `GET` |
| Content-Type | `application/json` |
| Authentication Method | Bearer Token |
| Authentication Header | `Authorization: Bearer YOUR_API_KEY` |
| Task Type | Asynchronous video generation task |

##### Workflow

Agnes-Video-V2.0 uses an asynchronous task-based workflow.

Step 1: Create a Video Task

Send a POST request to:

```
https://apihub.agnes-ai.com/v1/videos
```

The API will return a task ID.

Step 2: Retrieve the Video Result

Use the task ID to send a GET request to:

```
https://apihub.agnes-ai.com/v1/videos/{task_id}
```

The result will include task status, progress, and the final video URL when generation is completed.

##### Request Parameters

###### Create Video Task

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Fixed as `agnes-video-v2.0` |
| `prompt` | string | Yes | Text description of the video |
| `image` | string / array | No | Input image URL or image URL array |
| `mode` | string | No | Generation mode, such as `ti2vid` or `keyframes` |
| `height` | integer | No | Video height. Default: 768 |
| `width` | integer | No | Video width. Default: 1152 |
| `num_frames` | integer | No | Frame count. Must be `≤ 441` and satisfy `8n + 1` |
| `num_inference_steps` | integer | No | Number of inference steps |
| `seed` | integer | No | Random seed for reproducible results |
| `frame_rate` | number | No | Video FPS. Supported range: `1–60` |
| `negative_prompt` | string | No | Negative prompt describing what to avoid |
| `extra_body` | object | No | Extra mode setting, such as keyframes |
| `extra_body.image` | array | No | Input image URLs for multi-image video or keyframe mode |
| `extra_body.mode` | string | No | Extra mode setting, such as `keyframes` |

##### Call Examples

1. Text-to-Video Request

Use this request to generate a video directly from a text prompt.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",
    "height": 768,
    "width": 1152,
    "num_frames": 121,
    "frame_rate": 24
  }'
```

2. Image-to-Video Request

Use this request to animate a single image.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "The woman slowly turns around and looks back at the camera, natural facial expression, cinematic camera movement",
    "image": "https://example.com/image.png",
    "num_frames": 121,
    "frame_rate": 24
  }'
```

3. Multi-Image Video Request

Use this request to generate a video guided by multiple input images.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "Create a smooth transformation scene between the two reference images, cinematic lighting, consistent character identity, natural motion",
    "extra_body": {
      "image": [
        "https://example.com/image1.png",
        "https://example.com/image2.png"
      ]
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```

4. Keyframe Animation Request

Use this request to generate smooth interpolation between keyframes.

``` 
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "Generate a smooth cinematic transition between the keyframes, maintaining visual consistency and natural camera movement",
    "extra_body": {
      "image": [
        "https://example.com/keyframe1.png",
        "https://example.com/keyframe2.png"
      ],
      "mode": "keyframes"
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```

5. Retrieve Video Result Request

Use this request to retrieve the task status and final result.

```
curl-X GET https://apihub.agnes-ai.com/v1/videos/{task_id} \
-H"Authorization: Bearer YOUR_API_KEY"
```

##### Response Format

###### Create Task Response

```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"queued",
  "progress":0,
  "created_at":1774344160
}
```

###### Retrieve Video Result Response

```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"completed",
  "progress":100,
  "created_at":1774344160,
  "completed_at":1774344311,
  "video_url":"https://storage.googleapis.com/...",
  "size":"1152x768",
  "seconds":"5.0",
  "usage": {
    "duration_seconds":151
  }
}
```

##### Field Description

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique task ID |
| `object` | string | Object type, fixed as `video` |
| `model` | string | Model used, fixed as `agnes-video-v2.0` |
| `status` | string | Task status |
| `progress` | integer | Task progress percentage, from 0 to 100 |
| `created_at` | integer | Task creation timestamp |
| `completed_at` | integer | Task completion timestamp. null if not completed |
| `video_url` | string | Generated video URL, available when status is completed |
| `size` | string | Video resolution, formatted as width x height |
| `seconds` | string | Video duration in seconds |
| `usage` | object | Usage information, such as duration_seconds |

##### Usage Field Description

| Field | Description |
| --- | --- |
| `duration_seconds` | Total duration of video generation in seconds |

##### Task Status Description

| Status | Description |
| --- | --- |
| `queued` | Task is waiting in queue |
| `in_progress` | Video is being generated |
| `completed` | Video generation is completed |
| `failed` | Video generation failed |

##### Error Codes

| Code | Description |
| --- | --- |
| `400` | Invalid request. Check request parameters |
| `401` | Unauthorized. Check your API key |
| `404` | Task not found |
| `500` | Server error |
| `503` | Service busy. Retry later |

##### Features & Compatibility

Agnes-Video-V2.0 supports:

- Text-to-video generation
- Image-to-video generation
- Multi-image guided video generation
- Keyframe animation and smooth interpolation
- Prompt-based motion and scene control
- Cinematic visual output
- Asynchronous task-based video generation
- Polling-based result retrieval
- Seed-based reproducibility
- OpenAI-style API design with task-based extension

##### Best Practices

###### Text-to-Video Prompt

For text-to-video generation, describe the subject, action, environment, lighting, camera movement, and style.

Recommended structure:

```
[Subject] + [Action] + [Scene] + [Camera Movement] + [Lighting] + [Style]
```

Example:

```
A young astronaut walking across a red desert planet, dust blowing in the wind, slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style
```

###### Image-to-Video Prompt

For image-to-video generation, describe what should move while keeping the key subject stable.

Example:

```
Animate the character with subtle breathing motion, hair moving gently in the wind, background lights flickering softly, while keeping the face and outfit consistent
```

###### Multi-Image Prompt

For multi-image generation, describe how the input images should relate to each other.

Example:

```
Use the first image as the starting scene and the second image as the target scene. Create a smooth transformation with consistent lighting, natural motion, and cinematic pacing
```

###### Keyframe Prompt

For keyframe animation, describe the transition between frames clearly.

Example:

```
Create a smooth transition from the first keyframe to the second keyframe, maintaining character identity, consistent camera angle, and natural motion between scenes
```

##### Parameter Recommendations

| Use Case | Recommended Settings |
| --- | --- |
| Standard video generation | `width: 1152`, `height: 768`, `num_frames: 121`, `frame_rate: 24` |
| Short social video | `num_frames: 81` or `121`, `frame_rate: 24` |
| Smoother motion | Higher `frame_rate`, such as `24` or `30` |
| Reproducible result | Set a fixed `seed` |
| Keyframe transition | Use `extra_body.mode: "keyframes"` |
| Avoid unwanted content | Use `negative_prompt` |

##### Notes

- Use `agnes-video-v2.0` as the model name.
- Video generation is asynchronous. You need to create a task first, then retrieve the result by task ID.
- `video_url` is only available when the task status is `completed`.
- `num_frames` must be less than or equal to `441`.
- `num_frames` must satisfy the format `8n + 1`, such as `81`, `121`, `161`, `241`, or `441`.
- For text-to-video, only `model` and `prompt` are required.
- For image-to-video, provide an image URL using `image`.
- For multi-image video, provide multiple image URLs in `extra_body.image`.
- For keyframe animation, set `extra_body.mode` to `keyframes`.

---

https://agnes-ai.com/doc/overview