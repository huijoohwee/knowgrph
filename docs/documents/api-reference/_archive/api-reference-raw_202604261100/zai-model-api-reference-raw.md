> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Introduction

<Info>
  The API reference describes the RESTful APIs you can use to interact with the Z.AI platform.
</Info>

Z.AI provides standard HTTP API interfaces that support multiple programming languages and development environments, with [SDKs](/guides/develop/python/introduction) also available.

## API Endpoint

Z.ai Platform's general API endpoint is as follows:

```
https://api.z.ai/api/paas/v4
```

<Warning>
  Note: When using the [GLM Coding Plan](/devpack/overview), you need to configure the dedicated \
  Coding endpoint - [https://api.z.ai/api/coding/paas/v4](https://api.z.ai/api/coding/paas/v4) \
  instead of the general endpoint - [https://api.z.ai/api/paas/v4](https://api.z.ai/api/paas/v4) \
  Note: - The GLM Coding Plan API endpoint is intended for [supported tools](https://docs.z.ai/devpack/tool/others#step-1-supported-tools) only. For other use cases, we recommend using the general API endpoint.
</Warning>

## Authentication

The Z.AI API uses the standard **HTTP Bearer** for authentication.
An API key is required, which you can create or manage on the [API Keys Page](https://z.ai/manage-apikey/apikey-list).

API keys should be provided via HTTP Bearer Authentication in HTTP Request Headers.

```
Authorization: Bearer ZAI_API_KEY
```

## Playground

The API Playground allows developers to quickly try out API calls. Simply click **Try it** on the API details page to get started.

* On the API details page, there are many interactive options, such as **switching input types**, **switching tabs**, and **adding new content**.
* You can click **Add an item** or **Add new property** to add more properties the API need.
* **Note** that when switching the tabs, the previous properties value you need re-input or re-switch.

## Call Examples

<Tabs>
  <Tab title="cURL">
    ```bash theme={null}
    curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Accept-Language: en-US,en" \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -d '{
        "model": "glm-5.1",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful AI assistant."
            },
            {
                "role": "user",
                "content": "Hello, please introduce yourself."
            }
        ],
        "temperature": 1.0,
        "stream": true
    }'
    ```
  </Tab>

  <Tab title="Official Python SDK">
    **Install SDK**

    ```bash theme={null}
    # Install latest version
    pip install zai-sdk

    # Or specify version
    pip install zai-sdk==0.2.2
    ```

    **Verify Installation**

    ```python theme={null}
    import zai
    print(zai.__version__)
    ```

    **Usage Example**

    ```python theme={null}
    from zai import ZaiClient

    # Initialize client
    client = ZaiClient(api_key="YOUR_API_KEY")

    # Create chat completion request
    response = client.chat.completions.create(
        model="glm-5.1",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful AI assistant."
            },
            {
                "role": "user",
                "content": "Hello, please introduce yourself."
            }
        ]
    )

    # Get response
    print(response.choices[0].message.content)
    ```
  </Tab>

  <Tab title="Official Java SDK">
    **Install SDK**

    **Maven**

    ```xml theme={null}
    <dependency>
        <groupId>ai.z.openapi</groupId>
        <artifactId>zai-sdk</artifactId>
        <version>0.3.3</version>
    </dependency>
    ```

    **Gradle (Groovy)**

    ```groovy theme={null}
    implementation 'ai.z.openapi:zai-sdk:0.3.3'
    ```

    **Usage Example**

    ```java theme={null}
    import ai.z.openapi.ZaiClient;
    import ai.z.openapi.service.model.*;
    import java.util.Arrays;

    public class QuickStart {
        public static void main(String[] args) {
            // Initialize client
            ZaiClient client = ZaiClient.builder().ofZAI()
                .apiKey("YOUR_API_KEY")
                .build();

            // Create chat completion request
            ChatCompletionCreateParams request = ChatCompletionCreateParams.builder()
                .model("glm-5.1")
                .messages(Arrays.asList(
                    ChatMessage.builder()
                        .role(ChatMessageRole.USER.value())
                        .content("Hello, who are you?")
                        .build()
                ))
                .stream(false)
                .build();

            // Send request
            ChatCompletionResponse response = client.chat().createChatCompletion(request);

            // Get response
            System.out.println(response.getData().getChoices().get(0).getMessage().getContent());
        }
    }
    ```
  </Tab>

  <Tab title="OpenAI Python SDK">
    **Install SDK**

    ```bash theme={null}
    # Install or upgrade to latest version
    pip install --upgrade 'openai>=1.0'
    ```

    **Verify Installation**

    ```python theme={null}
    python -c "import openai; print(openai.__version__)"
    ```

    **Usage Example**

    ```python theme={null}
    from openai import OpenAI

    client = OpenAI(
        api_key="your-Z.AI-api-key",
        base_url="https://api.z.ai/api/paas/v4/"
    )

    completion = client.chat.completions.create(
        model="glm-5.1",
        messages=[
            {"role": "system", "content": "You are a smart and creative novelist"},
            {"role": "user", "content": "Please write a short fairy tale story as a fairy tale master"}
        ]
    )

    print(completion.choices[0].message.content)
    ```
  </Tab>

  <Tab title="OpenAI NodeJs SDK">
    **Install SDK**

    ```bash theme={null}
    # Install or upgrade to latest version
    npm install openai

    # Or using yarn
    yarn add openai
    ```

    **Usage Example**

    ```javascript theme={null}
    import OpenAI from "openai";

    const client = new OpenAI({
        apiKey: "your-Z.AI-api-key",
        baseURL: "https://api.z.ai/api/paas/v4/"
    });

    async function main() {
        const completion = await client.chat.completions.create({
            model: "glm-5.1",
            messages: [
                { role: "system", content: "You are a helpful AI assistant." },
                { role: "user", content: "Hello, please introduce yourself." }
            ]
        });

        console.log(completion.choices[0].message.content);
    }

    main();
    ```
  </Tab>

  <Tab title="OpenAI Java SDK">
    **Install SDK**

    **Maven**

    ```xml theme={null}
    <dependency>
        <groupId>com.openai</groupId>
        <artifactId>openai-java</artifactId>
        <version>2.20.1</version>
    </dependency>
    ```

    **Gradle (Groovy)**

    ```groovy theme={null}
    implementation 'com.openai:openai-java:2.20.1'
    ```

    **Usage Example**

    ```java theme={null}
    import com.openai.client.OpenAIClient;
    import com.openai.client.okhttp.OpenAIOkHttpClient;
    import com.openai.models.chat.completions.ChatCompletion;
    import com.openai.models.chat.completions.ChatCompletionCreateParams;

    public class QuickStart {
        public static void main(String[] args) {
            // Initialize client
            OpenAIClient client = OpenAIOkHttpClient.builder()
                .apiKey("your-Z.AI-api-key")
                .baseUrl("https://api.z.ai/api/paas/v4/")
                .build();

            // Create chat completion request
            ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
                .addSystemMessage("You are a helpful AI assistant.")
                .addUserMessage("Hello, please introduce yourself.")
                .model("glm-5.1")
                .build();

            // Send request and get response
            ChatCompletion chatCompletion = client.chat().completions().create(params);
            Object response = chatCompletion.choices().get(0).message().content();

            System.out.println(response);
        }
    }
    ```
  </Tab>
</Tabs>

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Errors

When calling the API, the response code consists of two parts: the outer layer is the HTTP status code, and the inner layer is the business error code defined by Z.AI in the response body, which provides a more detailed error description.

## HTTP Status Code

| Code | Reason                                                                                          | Solution                                                                                            |
| :--- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| 200  | Business processing successful                                                                  | -                                                                                                   |
| 400  | Parameter error                                                                                 | Check if the interface parameters are correct                                                       |
| 400  | File content anomaly                                                                            | Check if the jsonl file content meets the requirements                                              |
| 401  | Authentication failure or Token timeout                                                         | Confirm if the API KEY and authentication token are correctly generated                             |
| 404  | Fine-tuning feature not available                                                               | Contact customer service to activate this feature                                                   |
| 404  | Fine-tuning task does not exist                                                                 | Ensure the fine-tuning task ID is correct                                                           |
| 429  | Interface request concurrency exceeded                                                          | Adjust the request frequency or contact business to increase concurrency                            |
| 429  | File upload frequency too fast                                                                  | Wait briefly and then request again                                                                 |
| 429  | Account balance exhausted                                                                       | Recharge the account to ensure sufficient balance                                                   |
| 429  | Account anomaly                                                                                 | Account has violation, please contact platform customer service to unlock                           |
| 429  | Terminal account anomaly                                                                        | Terminal user has violation, account has been locked                                                |
| 434  | No API permission, fine-tuning API and file management API are in beta phase, we will open soon | Wait for the interface to be officially open or contact platform customer service to apply for beta |
| 435  | File size exceeds 100MB                                                                         | Use a jsonl file smaller than 100MB or upload in batches                                            |
| 500  | Server error occurred while processing the request                                              | Try again later or contact customer service                                                         |

## Business Error Codes

| Error Category         | Code | Error Message                                                                                                                                                                                                                  |
| :--------------------- | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Error            | 500  | Internal Error                                                                                                                                                                                                                 |
| Authentication Error   | 1000 | Authentication Failed                                                                                                                                                                                                          |
|                        | 1001 | Authentication parameter not received in Header, unable to authenticate                                                                                                                                                        |
|                        | 1002 | Invalid Authentication Token, please confirm the correct transmission of the Authentication Token                                                                                                                              |
|                        | 1003 | Authentication Token expired, please regenerate/obtain                                                                                                                                                                         |
|                        | 1004 | Authentication failed with the provided Authentication Token                                                                                                                                                                   |
|                        | 1100 | Account Read/Write                                                                                                                                                                                                             |
| Account Error          | 1110 | Your account is currently inactive. Please check your account information                                                                                                                                                      |
|                        | 1111 | Your account does not exist                                                                                                                                                                                                    |
|                        | 1112 | Your account has been locked, please contact customer service to unlock                                                                                                                                                        |
|                        | 1113 | Your account is in arrears, please recharge and try again                                                                                                                                                                      |
|                        | 1120 | Unable to successfully access your account, please try again later                                                                                                                                                             |
|                        | 1121 | Account has irregular activities and has been locked                                                                                                                                                                           |
| API Call Error         | 1200 | API Call Error                                                                                                                                                                                                                 |
|                        | 1210 | Incorrect API call parameters, please check the documentation                                                                                                                                                                  |
|                        | 1211 | Model does not exist, please check the model code                                                                                                                                                                              |
|                        | 1212 | Current model does not support `${method}` call method                                                                                                                                                                         |
|                        | 1213 | `${field}` parameter not received properly                                                                                                                                                                                     |
|                        | 1214 | Invalid `${field}` parameter. Please check the documentation                                                                                                                                                                   |
|                        | 1215 | `${field1}` and `${field2}` cannot be set simultaneously, please check the documentation                                                                                                                                       |
|                        | 1220 | You do not have permission to access `${API_name}`                                                                                                                                                                             |
|                        | 1221 | API `${API_name}` has been taken offline                                                                                                                                                                                       |
|                        | 1222 | API `${API_name}` does not exist                                                                                                                                                                                               |
|                        | 1230 | API call process error                                                                                                                                                                                                         |
|                        | 1231 | You already have a request: `${request_id}`                                                                                                                                                                                    |
|                        | 1234 | Network error, error id: `${error_id}`, please contact customer service                                                                                                                                                        |
|                        | 1261 | Prompt exceeds max length                                                                                                                                                                                                      |
| API Policy Block Error | 1300 | API call blocked by policy                                                                                                                                                                                                     |
|                        | 1301 | System detected potentially unsafe or sensitive content in input or generation. Please avoid using prompts that may generate sensitive content. Thank you for your cooperation.                                                |
|                        | 1302 | High concurrency usage of this API, please reduce concurrency or contact customer service to increase limits                                                                                                                   |
|                        | 1303 | High frequency usage of this API, please reduce frequency or contact customer service to increase limits                                                                                                                       |
|                        | 1304 | Daily call limit for this API reached. For more requests, please contact customer service to purchase                                                                                                                          |
|                        | 1305 | The API has triggered a rate limit.                                                                                                                                                                                            |
|                        | 1308 | Usage limit reached for {number} {unit}. Your limit will reset at `${next_flush_time}`                                                                                                                                         |
|                        | 1309 | Your GLM Coding Plan package has expired and is temporarily unavailable. You can resume using it after renewing the subscription on the official website. [https://z.ai/subscribe](https://z.ai/subscribe)                     |
|                        | 1310 | Weekly/Monthly Limit Exhausted. Your limit will reset at `${next_flush_time}`                                                                                                                                                  |
|                        | 1311 | Your current subscription plan does not yet include access to `${model_name}`                                                                                                                                                  |
|                        | 1312 | This model is currently experiencing high traffic. Please try again later, or switch to another model such as `${model_name}`                                                                                                  |
|                        | 1313 | Your usage violates the Fair Use Policy. Your request rate has been restricted. See Subscription Service Agreement for details. To restore access, go to Personal Center → My Subscription and request to lift the restriction |

## Error Shapes

Errors are always returned as JSON, with a top-level error object that includes a `code` and `message` value.

```json theme={null}
{
  "error": {
    "code": "1214",
    "message": "Input cannot be empty"
  }
}
```

## Error Example

The following is the response message of a curl request, where 401 is the HTTP status code and 1002 is the business error code.

```
* We are completely uploaded and fine
< HTTP/2 401
< date: Wed, 20 Mar 2024 03:06:05 GMT
< content-type: application/json
< set-cookie: acw_tc=76b20****a0e42;path=/;HttpOnly;Max-Age=1800
< server: nginx/1.21.6
< vary: Origin
< vary: Access-Control-Request-Method
< vary: Access-Control-Request-Headers
<
* Connection #0 to host open.z.ai left intact
{"error":{"code":"1002","message":"Authorization Token is invalid, please ensure that the Authorization Token is correctly provided."}}
```

> **Note**: When using streaming (SSE) calls, if the API terminates abnormally during inference, the above error codes will not be returned. Instead, the reason for the exception will be provided in the `finish_reason` parameter of the response body. For details, please refer to the description of the `finish_reason` parameter.

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Chat Completion

> Create a chat completion model that generates AI replies for given conversation messages. It supports multimodal inputs (text, images, audio, video, file), offers configurable parameters (like temperature, max tokens, tool use), and supports both streaming and non-streaming output modes.



## OpenAPI

````yaml POST /paas/v4/chat/completions
openapi: 3.0.1
info:
  title: Z.AI API
  description: Z.AI API available endpoints
  license:
    name: Z.AI Developer Agreement and Policy
    url: https://chat.z.ai/legal-agreement/terms-of-service
  version: 1.0.0
  contact:
    name: Z.AI Developers
    url: https://chat.z.ai/legal-agreement/privacy-policy
    email: user_feedback@z.ai
servers:
  - url: https://api.z.ai/api
    description: Production server
security:
  - bearerAuth: []
paths:
  /paas/v4/chat/completions:
    post:
      description: >-
        Create a chat completion model that generates AI replies for given
        conversation messages. It supports multimodal inputs (text, images,
        audio, video, file), offers configurable parameters (like temperature,
        max tokens, tool use), and supports both streaming and non-streaming
        output modes.
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/ChatCompletionTextRequest'
                  title: Text Model
                - $ref: '#/components/schemas/ChatCompletionVisionRequest'
                  title: Vision Model
            examples:
              Basic Example:
                value:
                  model: glm-5.1
                  messages:
                    - role: system
                      content: You are a useful AI assistant.
                    - role: user
                      content: >-
                        Please tell us about the development of artificial
                        intelligence.
                  temperature: 1
                  stream: false
              Stream Example:
                value:
                  model: glm-5.1
                  messages:
                    - role: user
                      content: Write a poem about spring.
                  temperature: 1
                  stream: true
              Thinking Example:
                value:
                  model: glm-5.1
                  messages:
                    - role: user
                      content: Write a poem about spring.
                  thinking:
                    type: enabled
                  stream: true
              Multi Conversation:
                value:
                  model: glm-5.1
                  messages:
                    - role: system
                      content: You are a professional programming assistant.
                    - role: user
                      content: What is recursion?
                    - role: assistant
                      content: >-
                        Recursion is a programming technique where a function
                        calls itself to solve a problem... What is recursion
                    - role: user
                      content: Can you give me an example of Python recursion?
                  stream: true
              Image Visual Example:
                value:
                  model: glm-5v-turbo
                  messages:
                    - role: user
                      content:
                        - type: image_url
                          image_url:
                            url: https://cdn.bigmodel.cn/static/logo/register.png
                        - type: image_url
                          image_url:
                            url: https://cdn.bigmodel.cn/static/logo/api-key.png
                        - type: text
                          text: What are the pics talk about?
              Video Visual Example:
                value:
                  model: glm-5v-turbo
                  messages:
                    - role: user
                      content:
                        - type: video_url
                          video_url:
                            url: >-
                              https://cdn.bigmodel.cn/agent-demos/lark/113123.mov
                        - type: text
                          text: What are the video show about?
              File Visual Example:
                value:
                  model: glm-5v-turbo
                  messages:
                    - role: user
                      content:
                        - type: file_url
                          file_url:
                            url: https://cdn.bigmodel.cn/static/demo/demo2.txt
                        - type: file_url
                          file_url:
                            url: https://cdn.bigmodel.cn/static/demo/demo1.pdf
                        - type: text
                          text: What are the files show about?
              Function Call Example:
                value:
                  model: glm-5.1
                  messages:
                    - role: user
                      content: >-
                        Is there an example of how the weather in Beijing is
                        today?
                  tools:
                    - type: function
                      function:
                        name: get_weather
                        description: Get weather information for the specified city.
                        parameters:
                          type: object
                          properties:
                            city:
                              type: string
                              description: City Name
                          required:
                            - city
                  tool_choice: auto
                  temperature: 0.3
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChatCompletionResponse'
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  parameters:
    AcceptLanguage:
      name: Accept-Language
      in: header
      schema:
        type: string
        description: Config desired response language for HTTP requests.
        default: en-US,en
        example: en-US,en
        enum:
          - en-US,en
      required: false
  schemas:
    ChatCompletionTextRequest:
      required:
        - model
        - messages
      type: object
      properties:
        model:
          type: string
          description: >-
            The model code to be called. GLM-5.1, GLM-5, GLM-5-Turbo are the
            latest flagship model series, foundational models specifically
            designed for agent applications.
          example: glm-5.1
          default: glm-5.1
          enum:
            - glm-5.1
            - glm-5-turbo
            - glm-5
            - glm-4.7
            - glm-4.7-flash
            - glm-4.7-flashx
            - glm-4.6
            - glm-4.5
            - glm-4.5-air
            - glm-4.5-x
            - glm-4.5-airx
            - glm-4.5-flash
            - glm-4-32b-0414-128k
        messages:
          type: array
          description: >-
            The current conversation message list as the model’s prompt input,
            provided in JSON array format, e.g.,`{“role”: “user”, “content”:
            “Hello”}`. Possible message types include system messages, user
            messages, assistant messages, and tool messages. Note: The input
            must not consist of system messages or assistant messages only.
          items:
            oneOf:
              - title: User Message
                type: object
                properties:
                  role:
                    type: string
                    enum:
                      - user
                    description: Role of the message author
                    default: user
                  content:
                    oneOf:
                      - type: string
                        description: Text message content
                        example: >-
                          What opportunities and challenges will the Chinese
                          large model industry face in 2025?
                required:
                  - role
                  - content
              - title: System Message
                type: object
                properties:
                  role:
                    type: string
                    enum:
                      - system
                    description: Role of the message author
                    default: system
                  content:
                    oneOf:
                      - type: string
                        description: Message text content
                        example: You are a helpful assistant.
                required:
                  - role
                  - content
              - title: Assistant Message
                type: object
                description: Can include tool calls
                properties:
                  role:
                    type: string
                    enum:
                      - assistant
                    description: Role of the message author
                    default: assistant
                  content:
                    oneOf:
                      - type: string
                        description: Text message content
                        example: I'll help you with that analysis.
                  tool_calls:
                    type: array
                    description: >-
                      Tool call messages generated by the model. When this field
                      is provided, content is usually empty.
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Tool call ID
                        type:
                          type: string
                          description: Tool type, supports web_search, retrieval, function
                          enum:
                            - function
                            - web_search
                            - retrieval
                        function:
                          type: object
                          description: >-
                            Function call information, not empty when type is
                            function
                          properties:
                            name:
                              type: string
                              description: Function name
                            arguments:
                              type: string
                              description: Function parameters, JSON format string
                          required:
                            - name
                            - arguments
                      required:
                        - id
                        - type
                required:
                  - role
              - title: Tool Message
                type: object
                properties:
                  role:
                    type: string
                    enum:
                      - tool
                    description: Role of the message author
                    default: tool
                  content:
                    oneOf:
                      - type: string
                        description: Message text content
                        example: 'Function executed successfully with result: ...'
                  tool_call_id:
                    type: string
                    description: Indicates the tool call ID corresponding to this message
                required:
                  - role
                  - content
                  - tool_call_id
          minItems: 1
        request_id:
          type: string
          description: >-
            Passed by the user side, needs to be unique; used to distinguish
            each request. If not provided by the user side, the platform will
            generate one by default.
        do_sample:
          type: boolean
          example: true
          default: true
          description: >-
            When do_sample is true, sampling strategy is enabled; when do_sample
            is false, sampling strategy parameters such as temperature and top_p
            will not take effect. Default value is `true`.
        stream:
          type: boolean
          example: false
          default: false
          description: >-
            This parameter should be set to false or omitted when using
            synchronous call. It indicates that the model returns all content at
            once after generating all content. Default value is false. If set to
            true, the model will return the generated content in chunks via
            standard Event Stream. When the Event Stream ends, a `data: [DONE]`
            message will be returned.
        thinking:
          $ref: '#/components/schemas/ChatThinking'
        temperature:
          type: number
          description: >-
            Sampling temperature, controls the randomness of the output, must be
            a positive number within the range: `[0.0, 1.0]`. The GLM-5.1,
            GLM-5, GLM-4.7, GLM-4.6 series default value is `1.0`, GLM-4.5
            series default value is `0.6`, GLM-4-32B-0414-128K default value is
            `0.75`.
          format: float
          example: 1
          default: 1
          minimum: 0
          maximum: 1
        top_p:
          type: number
          description: >-
            Another method of temperature sampling, value range is: `[0.01,
            1.0]`. The GLM-5.1, GLM-5, GLM-4.7, GLM-4.6, GLM-4.5 series default
            value is `0.95`, GLM-4-32B-0414-128K default value is `0.9`.
          format: float
          example: 0.95
          default: 0.95
          minimum: 0.01
          maximum: 1
        max_tokens:
          type: integer
          description: >-
            The maximum number of tokens for model output, the GLM-5.1, GLM-5,
            GLM-4.7, GLM-4.6 series supports 128K maximum output, the GLM-4.5
            series supports 96K maximum output, the GLM-4.6v series supports 32K
            maximum output, the GLM-4.5v series supports 16K maximum output,
            GLM-4-32B-0414-128K supports 16K maximum output.
          example: 1024
          minimum: 1
          maximum: 131072
        tool_stream:
          type: boolean
          example: false
          default: false
          description: >-
            Whether to enable streaming response for Function Calls. Default
            value is false. Only supported by GLM-4.6 and above. Refer the
            [Stream Tool Call](/guides/tools/stream-tool)
        tools:
          type: array
          description: >
            A list of tools the model may call. Currently, only functions are
            supported as a tool. Use this to provide a list of functions the
            model may generate JSON inputs for. A max of 128 functions are
            supported.
          items:
            anyOf:
              - $ref: '#/components/schemas/FunctionToolSchema'
              - $ref: '#/components/schemas/RetrievalToolSchema'
              - $ref: '#/components/schemas/WebSearchToolSchema'
        tool_choice:
          oneOf:
            - type: string
              enum:
                - auto
              description: >-
                Used to control how the model selects which function to call.
                This is only applicable when the tool type is function. The
                default value is auto, and only auto is supported.
          description: Controls how the model selects a tool.
        stop:
          type: array
          description: >-
            Stop word list. Generation stops when the model encounters any
            specified string. Currently, only one stop word is supported, in the
            format ["stop_word1"].
          items:
            type: string
          maxItems: 1
        response_format:
          type: object
          description: >-
            Specifies the response format of the model. Defaults to text.
            Supports two formats:{ "type": "text" } plain text mode, returns
            natural language text, { "type": "json_object" } JSON mode, returns
            valid JSON data. When using JSON mode, it’s recommended to clearly
            request JSON output in the prompt.
          properties:
            type:
              type: string
              enum:
                - text
                - json_object
              default: text
              description: >-
                Output format type: text for plain text, json_object for
                JSON-formatted output.
          required:
            - type
        user_id:
          type: string
          description: >-
            Unique ID for the end user, 6–128 characters. Avoid using sensitive
            information.
          minLength: 6
          maxLength: 128
    ChatCompletionVisionRequest:
      required:
        - model
        - messages
      type: object
      properties:
        model:
          type: string
          description: >-
            The model code to be called. GLM-5V-Turbo are the new generation of
            visual reasoning models. `AutoGLM-Phone-Multilingual` is mobile
            intelligent assistant model.
          example: glm-5v-turbo
          default: glm-5v-turbo
          enum:
            - glm-5v-turbo
            - glm-4.6v
            - autoglm-phone-multilingual
            - glm-4.6v-flash
            - glm-4.6v-flashx
            - glm-4.5v
        messages:
          type: array
          description: >-
            The current conversation message list as the model’s prompt input,
            provided in JSON array format, e.g.,`{“role”: “user”, “content”:
            “Hello”}`. Possible message types include system messages, user
            messages. Note: The input must not consist of system or assistant
            messages only.
          items:
            oneOf:
              - title: User Message
                type: object
                properties:
                  role:
                    type: string
                    enum:
                      - user
                    description: Role of the message author
                    default: user
                  content:
                    oneOf:
                      - type: array
                        description: >-
                          Multimodal message content, supports text, images,
                          video, file
                        items:
                          $ref: '#/components/schemas/VisionMultimodalContentItem'
                      - type: string
                        description: >-
                          Text message content (can switch to multimodal message
                          above)
                        example: >-
                          What opportunities and challenges will the Chinese
                          large model industry face in 2025?
                required:
                  - role
                  - content
              - title: System Message
                type: object
                properties:
                  role:
                    type: string
                    enum:
                      - system
                    description: Role of the message author
                    default: system
                  content:
                    oneOf:
                      - type: string
                        description: Message text content
                        example: You are a helpful assistant.
                required:
                  - role
                  - content
              - title: Assistant Message
                type: object
                description: Can include tool calls
                properties:
                  role:
                    type: string
                    enum:
                      - assistant
                    description: Role of the message author
                    default: assistant
                  content:
                    oneOf:
                      - type: string
                        description: Text message content
                        example: I'll help you with that analysis.
                required:
                  - role
          minItems: 1
        request_id:
          type: string
          description: >-
            Passed by the user side, needs to be unique; used to distinguish
            each request. If not provided by the user side, the platform will
            generate one by default.
        do_sample:
          type: boolean
          example: true
          default: true
          description: >-
            When do_sample is true, sampling strategy is enabled; when do_sample
            is false, sampling strategy parameters such as temperature and top_p
            will not take effect. Default value is `true`.
        stream:
          type: boolean
          example: false
          default: false
          description: >-
            This parameter should be set to false or omitted when using
            synchronous call. It indicates that the model returns all content at
            once after generating all content. Default value is false. If set to
            true, the model will return the generated content in chunks via
            standard Event Stream. When the Event Stream ends, a `data: [DONE]`
            message will be returned.
        thinking:
          $ref: '#/components/schemas/ChatThinking'
        temperature:
          type: number
          description: >-
            Sampling temperature, controls the randomness of the output, must be
            a positive number within the range: `[0.0, 1.0]`. The GLM-5V-Turbo,
            GLM-4.6V, GLM-4.5V series default value is `0.8`, the
            autoglm-phone-multilingual default value is `0.0`.
          format: float
          example: 0.8
          default: 0.8
          minimum: 0
          maximum: 1
        top_p:
          type: number
          description: >-
            Another method of temperature sampling, value range is: `[0.01,
            1.0]`, value range is: `[0.01, 1.0]`. The GLM-5V-Turbo, GLM-4.6V,
            GLM-4.5V series default value is `0.6`, the
            autoglm-phone-multilingual default value is `0.85`.
          format: float
          example: 0.6
          default: 0.6
          minimum: 0.01
          maximum: 1
        max_tokens:
          type: integer
          description: >-
            The maximum number of tokens for model output, the GLM-5V-Turbo
            supports 128K maximum output, GLM-4.6V series supports 32K maximum
            output, the GLM-4.5V series supports 16K maximum output, the
            autoglm-phone-multilingual supports 4K maximum output.
          example: 1024
          minimum: 1
          maximum: 131072
        tools:
          type: array
          description: >
            A list of tools the model may call. Only support by GLM-4.6V series
            and autoglm-phone-multilingual. Use this to provide a list of
            functions the model may generate JSON inputs for. A max of 128
            functions are supported.
          items:
            anyOf:
              - $ref: '#/components/schemas/FunctionToolSchema'
        tool_choice:
          oneOf:
            - type: string
              enum:
                - auto
              description: >-
                Used to control how the model selects which function to call.
                This is only applicable when the tool type is function. The
                default value is auto, and only auto is supported.
          description: Controls how the model selects a tool.
        stop:
          type: array
          description: >-
            Stop word list. Generation stops when the model encounters any
            specified string. Currently, only one stop word is supported, in the
            format ["stop_word1"].
          items:
            type: string
          maxItems: 1
        user_id:
          type: string
          description: >-
            Unique ID for the end user, 6–128 characters. Avoid using sensitive
            information.
          minLength: 6
          maxLength: 128
    ChatCompletionResponse:
      type: object
      properties:
        id:
          type: string
          description: Task ID
        request_id:
          description: Request ID
          type: string
        created:
          description: Request creation time, Unix timestamp in seconds
          type: integer
        model:
          description: Model name
          type: string
        choices:
          type: array
          description: List of model responses
          items:
            type: object
            properties:
              index:
                type: integer
                description: Result index.
              message:
                $ref: '#/components/schemas/ChatCompletionResponseMessage'
              finish_reason:
                type: string
                description: >-
                  Reason for model inference termination. Can be `stop`,
                  `tool_calls`, `length`, `sensitive`,
                  `model_context_window_exceeded` or `network_error`.
        usage:
          type: object
          description: Token usage statistics returned when the model call ends.
          properties:
            prompt_tokens:
              type: number
              description: Number of tokens in user input
            completion_tokens:
              type: number
              description: Number of output tokens
            prompt_tokens_details:
              type: object
              properties:
                cached_tokens:
                  type: number
                  description: Number of tokens served from cache
            total_tokens:
              type: integer
              description: Total number of tokens
        web_search:
          description: Search results.
          type: array
          items:
            $ref: '#/components/schemas/WebSearchObjectResponse'
    Error:
      required:
        - code
        - message
      type: object
      description: The request has failed.
      properties:
        code:
          type: integer
          format: int32
          description: Error code.
        message:
          type: string
          description: Error message.
    ChatThinking:
      type: object
      description: >-
        Only supported by GLM-4.5 series and higher models. This parameter is
        used to control whether the model enable the chain of thought.
      properties:
        type:
          type: string
          description: >-
            Whether to enable the chain of thought(When enabled, GLM-5.1 GLM-5
            GLM-5-Turbo GLM-5V-Turbo GLM-4.7 GLM-4.5V will think compulsorily,
            while GLM-4.6, GLM-4.6V, GLM-4.5 and others will automatically
            determine whether to think), default: enabled
          default: enabled
          enum:
            - enabled
            - disabled
        clear_thinking:
          type: boolean
          description: >-
            Default value is True. Controls whether to clear `reasoning_content`
            from previous conversation turns. View more in [Thinking
            Mode](/guides/capabilities/thinking-mode). 
             - `true` (default): For this request, the system ignores/removes `reasoning_content` from prior turns, and only keeps non-reasoning context (e.g., user/assistant visible text, tool calls, and tool results). This is recommended for general chat or lightweight tasks to reduce context length and cost. 
             - `false`: Retains `reasoning_content` from prior turns and includes it in the context sent to the model. To enable Preserved Thinking, you must forward the full, unmodified, and correctly ordered historical `reasoning_content` in `messages`. Missing, truncated, rewritten, or reordered blocks may degrade performance or prevent the feature from taking effect. 
             - Notes: This parameter only affects cross-turn historical thinking blocks; it does not change whether the model generates/returns thinking in the current turn.
          default: true
          example: true
    FunctionToolSchema:
      type: object
      title: Function Call
      properties:
        type:
          type: string
          default: function
          enum:
            - function
        function:
          $ref: '#/components/schemas/FunctionObject'
      required:
        - type
        - function
      additionalProperties: false
    RetrievalToolSchema:
      type: object
      title: Retrieval
      properties:
        type:
          type: string
          default: retrieval
          enum:
            - retrieval
        retrieval:
          $ref: '#/components/schemas/RetrievalObject'
      required:
        - type
        - retrieval
      additionalProperties: false
    WebSearchToolSchema:
      type: object
      title: Web Search
      properties:
        type:
          type: string
          default: web_search
          enum:
            - web_search
        web_search:
          $ref: '#/components/schemas/WebSearchObject'
      required:
        - type
        - web_search
      additionalProperties: false
    VisionMultimodalContentItem:
      oneOf:
        - title: Text
          type: object
          properties:
            type:
              type: string
              enum:
                - text
              description: Content type is text
              default: text
            text:
              type: string
              description: Text content
          required:
            - type
            - text
          additionalProperties: false
        - title: Image
          type: object
          properties:
            type:
              type: string
              enum:
                - image_url
              description: Content type is image URL
              default: image_url
            image_url:
              type: object
              description: Image information
              properties:
                url:
                  type: string
                  description: >-
                    Image URL or Base64 encoding. Image size limit is under 5M
                    per image, with pixels not exceeding 6000*6000. GLM-5V
                    GLM4.6V series are limited to 150 sheets, GLM4.5V limit 50
                    sheets. Supports jpg, png, jpeg formats.
              required:
                - url
              additionalProperties: false
          required:
            - type
            - image_url
          additionalProperties: false
        - title: Video
          type: object
          properties:
            type:
              type: string
              enum:
                - video_url
              description: Content type is video URL
              default: video_url
            video_url:
              type: object
              description: Video information.
              properties:
                url:
                  type: string
                  description: >-
                    Video URL address.The video size is limited to within 200
                    MB, GLM-5V GLM4.6V series are limited to 2 videos, GLM4.5V
                    limit 1 video, and the format supports `mp4`，`mkv`，`mov`.
              required:
                - url
              additionalProperties: false
          required:
            - type
            - video_url
          additionalProperties: false
        - title: File
          type: object
          properties:
            type:
              type: string
              enum:
                - file_url
              description: >-
                Content type is file URL, not support passing both the
                `file_url` and `image_url` or `video_url` parameters at the same
                time.
              default: file_url
            file_url:
              type: object
              description: File information.
              properties:
                url:
                  type: string
                  description: >-
                    File URL address. Only GLM-5V-Turbo, GLM-4.6V, GLM-4.5V
                    supported. Supports formats such as
                    pdf、txt、word、jsonl、xlsx、pptx, with a maximum of 50.
              required:
                - url
              additionalProperties: false
          required:
            - type
            - file_url
          additionalProperties: false
    ChatCompletionResponseMessage:
      type: object
      properties:
        role:
          type: string
          description: Current conversation role, default is ‘assistant’ (model)
          example: assistant
        content:
          type: string
          description: >-
            Current conversation content. Hits function is null, otherwise
            returns model inference result. 

            For the GLM-4.5V series models, the output may contain the reasoning
            process tags `<think> </think>` or the text boundary tags
            `<|begin_of_box|> <|end_of_box|>`.
        reasoning_content:
          type: string
          description: Reasoning content, supports by GLM-4.5 series.
        tool_calls:
          type: array
          description: >-
            Function names and parameters generated by the model that should be
            called.
          items:
            $ref: '#/components/schemas/ChatCompletionResponseMessageToolCall'
    WebSearchObjectResponse:
      type: object
      properties:
        title:
          type: string
          description: Title.
        content:
          type: string
          description: Content summary.
        link:
          type: string
          description: Result URL.
        media:
          type: string
          description: Website name.
        icon:
          type: string
          description: Website icon.
        refer:
          type: string
          description: Index number.
        publish_date:
          type: string
          description: Website publication date.
    FunctionObject:
      type: object
      properties:
        name:
          type: string
          description: >-
            The name of the function to be called. Must be a-z, A-Z, 0-9, or
            contain underscores and dashes, with a maximum length of 64.
          minLength: 1
          maxLength: 64
          pattern: ^[a-zA-Z0-9_-]+$
        description:
          type: string
          description: >-
            A description of what the function does, used by the model to choose
            when and how to call the function.
        parameters:
          $ref: '#/components/schemas/FunctionParameters'
      required:
        - name
        - description
        - parameters
    RetrievalObject:
      type: object
      properties:
        knowledge_id:
          type: string
          description: Knowledge base ID, created or obtained from the platform
        prompt_template:
          type: string
          description: >-
            Prompt template for requesting the model, a custom request template
            containing placeholders `{{ knowledge }}` and `{{ question }}`.
            Default template: Search for the answer to the question
            `{{question}}` in the document `{{ knowledge }}`. If an answer is
            found, respond only using statements from the document; if no answer
            is found, use your own knowledge to answer and inform the user that
            the information is not from the document. Do not repeat the
            question, start the answer directly.
      required:
        - knowledge_id
    WebSearchObject:
      type: object
      properties:
        enable:
          type: boolean
          description: |-
            Whether to enable search functionality.
            Default is `false`. Set to true to `enable`.
        search_engine:
          type: string
          description: |-
            Type of search engine.
            Default is `search_pro_jina`. Supports: `search_pro_jina`.
          enum:
            - search_pro_jina
        search_query:
          type: string
          description: Force trigger a search
        count:
          type: integer
          description: |
            Number of returned results
            Range: `1-50`, max `50` results per search
            Default is `10`
            Supported engines: `search_pro_jina`
          minimum: 1
          maximum: 50
        search_domain_filter:
          type: string
          description: >-
            Limits search results to specified whitelisted domains. Whitelist:
            input domains directly (e.g., www.example.com)

            Supported engines: `search_pro_jina`
        search_recency_filter:
          type: string
          description: |-
            Limits search to a specific time range.
            Default is `noLimit`
            Values:
            `oneDay`, within a day
            `oneWeek`, within a week
            `oneMonth`, within a month
            `oneYear`, within a year
            `noLimit`, no limit (default)
            Supported engines: `search_pro_jina`
          enum:
            - oneDay
            - oneWeek
            - oneMonth
            - oneYear
            - noLimit
        content_size:
          type: string
          description: >-
            Number of characters for webpage summaries.

            Default is `medium`

            `medium`: Balanced mode for most queries. 400-600 characters

            `high`: Maximizes context for comprehensive answers, 2500
            characters.
          enum:
            - medium
            - high
        result_sequence:
          type: string
          description: >-
            Specifies whether search results are shown before or after model
            response. Options: `before`, `after`. Default is `after`
          enum:
            - before
            - after
        search_result:
          type: boolean
          description: |-
            Whether to return search results in the response.
            Default is `false`
        require_search:
          type: boolean
          description: |-
            Whether to force model response based on search result.
            Default is `false`
        search_prompt:
          type: string
          description: >-
            Prompt to customize how search results are processed.

            Default Prompt:

            `You are an intelligent Q&A expert with the ability to synthesize
            information, recognize time, understand semantics, and clean
            contradictory data. The current date is {{current_date}}. Use this
            as the only time reference. Based on the following information,
            provide a comprehensive and accurate answer to the user's
            question.Only extract valuable content for the answer. Ensure the
            answer is timely and authoritative. State the answer directly
            without citing data sources or internal processes.`
      required:
        - search_engine
    ChatCompletionResponseMessageToolCall:
      type: object
      properties:
        function:
          type: object
          description: >-
            Contains the function name and JSON format parameters generated by
            the model.
          properties:
            name:
              type: string
              description: Model-generated function name.
            arguments:
              type: object
              description: >-
                JSON format of the function call parameters generated by the
                model. Validate the parameters before calling the function.
          required:
            - name
            - arguments
        id:
          type: string
          description: Unique identifier for the hit function.
        type:
          type: string
          description: Tool type called by the model, currently only supports ‘function’.
    FunctionParameters:
      type: object
      description: >-
        Parameters defined using JSON Schema. Must pass a JSON Schema object to
        accurately define accepted parameters. Omit if no parameters are needed
        when calling the function.
      additionalProperties: true
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````