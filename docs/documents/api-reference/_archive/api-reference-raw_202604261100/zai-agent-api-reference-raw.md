> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Agent Chat

> General Translation: General Translation API provides large model-based multilingual translation services, including general translation, paraphrase translation, two-step translation, and three-pass translation strategies. It supports automatic language detection, glossary customization, translation suggestions, and streaming output. Users only need to call the Translation API, input the text to be processed, specify the source language (auto-detection supported) and target language to receive high-quality translation results. 

 Popular Special Effects Videos: Popular special effects videos are intelligent templates launched based on trending features from pan-entertainment platforms, designed to precisely adapt to short video creative production needs. Currently, three effect templates are available: `French Kiss`, `Body Shake Dance`, and `Sexy Me`. After selecting a template, users only need to upload an image and enter corresponding prompts to generate a special effects video. 

 GLM Slide/Poster Agent: An intelligent creation agent built for working people and creators. It goes beyond traditional engineering-style assembly tools—supporting one-click generation of slides or posters from natural language instructions. By natively integrating content generation with layout aesthetics and design conventions, it helps you quickly produce polished, professional-grade materials while lowering design barriers and boosting creative efficiency.



## OpenAPI

````yaml POST /v1/agents
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
  /v1/agents:
    post:
      description: >-
        General Translation: General Translation API provides large model-based
        multilingual translation services, including general translation,
        paraphrase translation, two-step translation, and three-pass translation
        strategies. It supports automatic language detection, glossary
        customization, translation suggestions, and streaming output. Users only
        need to call the Translation API, input the text to be processed,
        specify the source language (auto-detection supported) and target
        language to receive high-quality translation results. 

         Popular Special Effects Videos: Popular special effects videos are intelligent templates launched based on trending features from pan-entertainment platforms, designed to precisely adapt to short video creative production needs. Currently, three effect templates are available: `French Kiss`, `Body Shake Dance`, and `Sexy Me`. After selecting a template, users only need to upload an image and enter corresponding prompts to generate a special effects video. 

         GLM Slide/Poster Agent: An intelligent creation agent built for working people and creators. It goes beyond traditional engineering-style assembly tools—supporting one-click generation of slides or posters from natural language instructions. By natively integrating content generation with layout aesthetics and design conventions, it helps you quickly produce polished, professional-grade materials while lowering design barriers and boosting creative efficiency.
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/TranslationAgentRequest'
                  title: General Translation
                - $ref: '#/components/schemas/SpecialEffectsVideosAgentRequest'
                  title: Popular Special Effects Videos
                - $ref: '#/components/schemas/GlmSlideAgentRequest'
                  title: GLM Slide/Poster
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/TranslationAgentResponse'
                    title: General Translation
                  - $ref: '#/components/schemas/SpecialEffectsVideosAgentResponse'
                    title: Popular Special Effects Videos
                  - $ref: '#/components/schemas/GlmSlideAgentResponse'
                    title: GLM Slide/Poster
              examples:
                General Translation:
                  value:
                    id: <string>
                    agent_id: <string>
                    choices:
                      - index: 123
                        finish_reason: <string>
                        messages:
                          - role: <string>
                            content:
                              text: <string>
                              type: <string>
                    usage:
                      prompt_tokens: 123
                      completion_tokens: 123
                      total_tokens: 123
                      total_calls: 123
                Popular Special Effects Videos:
                  value:
                    status: <string>
                    agent_id: <string>
                    async_id: <string>
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/Error'
                    title: General Translation
                  - $ref: '#/components/schemas/SpecialEffectsVideosAgentError'
                    title: Popular Special Effects Videos
              examples:
                General Translation:
                  value:
                    code: 123
                    message: <string>
                Popular Special Effects Videos:
                  value:
                    status: <string>
                    agent_id: <string>
                    error:
                      code: <string>
                      message: <string>
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
    TranslationAgentRequest:
      type: object
      properties:
        agent_id:
          type: string
          description: 'Agent ID: `general_translation`.'
          enum:
            - general_translation
        stream:
          type: boolean
          description: False for sync calls (default). True for streaming.
        messages:
          type: array
          description: Session message body.
          items:
            type: object
            properties:
              role:
                type: string
                description: 'User input role: `user`'
                example: user
                default: user
                enum:
                  - user
              content:
                type: array
                description: Content list.
                items:
                  type: object
                  properties:
                    type:
                      type: string
                      description: 'Supported type: `text`.'
                      default: text
                      enum:
                        - text
                    text:
                      type: string
                      description: User text input.
                  required:
                    - type
                    - text
            required:
              - role
              - content
        custom_variables:
          type: object
          properties:
            source_lang:
              type: string
              description: |
                Supported language codes (default: `auto`):
                - `auto`: Auto Detect
                - `zh-CN`: Simplified Chinese
                - `zh-TW`: Traditional Chinese
                - `wyw`: Classical Chinese
                - `yue`: Cantonese
                - `en`: English
                - `ja`: Japanese
                - `ko`: Korean
                - `fr`: French
                - `de`: German
                - `es`: Spanish
                - `ru`: Russian
                - `pt`: Portuguese
                - `it`: Italian
                - `ar`: Arabic
                - `hi`: Hindi
                - `bg`: Bulgarian
                - `cs`: Czech
                - `da`: Danish
                - `el`: Greek
                - `et`: Estonian
                - `fi`: Finnish
                - `hu`: Hungarian
                - `id`: Indonesian
                - `lt`: Lithuanian
                - `lv`: Latvian
                - `nl`: Dutch
                - `no`: Norwegian Bokmål
                - `pl`: Polish
                - `ro`: Romanian
                - `sk`: Slovak
                - `sl`: Slovenian
                - `sv`: Swedish
                - `th`: Thai
                - `tr`: Turkish
                - `uk`: Ukrainian
                - `vi`: Vietnamese
                - `my`: Burmese
                - `ms`: Malay
                - `Pinyin`: Pinyin
                - `IPA`: International Phonetic Alphabet
              enum:
                - auto
                - zh-CN
                - zh-TW
                - wyw
                - yue
                - en
                - ja
                - ko
                - fr
                - de
                - es
                - ru
                - pt
                - it
                - ar
                - hi
                - bg
                - cs
                - da
                - el
                - et
                - fi
                - hu
                - id
                - lt
                - lv
                - nl
                - 'no'
                - pl
                - ro
                - sk
                - sl
                - sv
                - th
                - tr
                - uk
                - vi
                - my
                - ms
                - Pinyin
                - IPA
            target_lang:
              type: string
              description: |-
                Target language code (default: `zh-CN`):
                - `zh-CN`: Simplified Chinese
                - `zh-TW`: Traditional Chinese
                - `wyw`: Classical Chinese
                - `yue`: Cantonese
                - `en`: English
                - `en-GB`: English (British)
                - `en-US`: English (American)
                - `ja`: Japanese
                - `ko`: Korean
                - `fr`: French
                - `de`: German
                - `es`: Spanish
                - `ru`: Russian
                - `pt`: Portuguese
                - `it`: Italian
                - `ar`: Arabic
                - `hi`: Hindi
                - `bg`: Bulgarian
                - `cs`: Czech
                - `da`: Danish
                - `el`: Greek
                - `et`: Estonian
                - `fi`: Finnish
                - `hu`: Hungarian
                - `id`: Indonesian
                - `lt`: Lithuanian
                - `lv`: Latvian
                - `nl`: Dutch
                - `no`: Norwegian Bokmål
                - `pl`: Polish
                - `ro`: Romanian
                - `sk`: Slovak
                - `sl`: Slovenian
                - `sv`: Swedish
                - `th`: Thai
                - `tr`: Turkish
                - `uk`: Ukrainian
                - `vi`: Vietnamese
                - `my`: Burmese
                - `ms`: Malay
                - `Pinyin`: Pinyin
                - `IPA`: International Phonetic Alphabet
                .
              enum:
                - zh-CN
                - zh-TW
                - wyw
                - yue
                - en
                - en-GB
                - en-US
                - ja
                - ko
                - fr
                - de
                - es
                - ru
                - pt
                - it
                - ar
                - hi
                - bg
                - cs
                - da
                - el
                - et
                - fi
                - hu
                - id
                - lt
                - lv
                - nl
                - 'no'
                - pl
                - ro
                - sk
                - sl
                - sv
                - th
                - tr
                - uk
                - vi
                - my
                - ms
                - Pinyin
                - IPA
            glossary:
              type: string
              description: Glossary ID.
            strategy:
              type: string
              description: |-
                Translation strategy (default: `general`)，Optional:
                - `general`: General Translation
                - `paraphrase`: Paraphrase Translation
                - `two_step`: Two-Step Translation
                - `three_step`: Three-Stage Translation
                - `reflection`: Reflection Translation; cot: COT Translation
              enum:
                - general
                - paraphrase
                - two_step
                - three_step
                - reflection
            strategy_config:
              type: object
              description: Strategy parameters.
              properties:
                general:
                  type: object
                  properties:
                    suggestion:
                      type: string
                      description: >-
                        Translation suggestions or style requirements (e.g.,
                        terminology mapping, style guidelines).
                cot:
                  type: object
                  description: Parameters when strategy is `cot`.
                  properties:
                    reason_lang:
                      type: string
                      description: >-
                        Language for translation reasoning, values:
                        [`from`｜`to`], default: `to`.
                      enum:
                        - from
                        - to
      required:
        - agent_id
        - messages
    SpecialEffectsVideosAgentRequest:
      type: object
      properties:
        agent_id:
          type: string
          description: 'Agent ID: `vidu_template_agent`.'
          enum:
            - vidu_template_agent
        request_id:
          type: string
          description: >-
            User-defined unique ID; used to distinguish requests. Auto-generated
            if omitted.
        messages:
          type: array
          description: Session message body.
          items:
            type: object
            properties:
              role:
                type: string
                description: 'User input role: `user`'
                example: user
                default: user
                enum:
                  - user
              content:
                type: array
                description: Content list.
                items:
                  oneOf:
                    - title: text
                      type: object
                      properties:
                        type:
                          type: string
                          description: Specifies that this content is text.
                          enum:
                            - text
                        text:
                          type: string
                          description: User text input.
                      required:
                        - type
                        - text
                    - title: image_url
                      type: object
                      properties:
                        type:
                          type: string
                          description: Specifies that this content is an image URL.
                          enum:
                            - image_url
                        image_url:
                          type: string
                          format: uri
                          description: Image URL input.
                      required:
                        - type
                        - image_url
            required:
              - role
              - content
        custom_variables:
          type: object
          description: Agent extension parameters.
          properties:
            template:
              type: string
              description: 'Effect template: `french_kiss`, `bodyshake`, or `sexy_me`.'
              enum:
                - french_kiss
                - bodyshake
                - sexy_me
          required:
            - template
      required:
        - agent_id
        - messages
    GlmSlideAgentRequest:
      type: object
      properties:
        agent_id:
          type: string
          description: Agent ID.
          enum:
            - slides_glm_agent
        stream:
          type: boolean
          default: true
          description: False for sync calls (default). True for streaming.
        conversation_id:
          type: string
          description: Conversation Id.
        request_id:
          type: string
          description: >-
            User-defined unique ID; used to distinguish requests. Auto-generated
            if omitted.
        messages:
          type: array
          description: Message body.
          items:
            type: object
            properties:
              role:
                type: string
                description: 'User input role: `user`'
                example: user
                default: user
                enum:
                  - user
              content:
                type: array
                description: Content list.
                items:
                  oneOf:
                    - title: text
                      type: object
                      properties:
                        type:
                          type: string
                          description: Specifies that this content is text.
                          enum:
                            - text
                        text:
                          type: string
                          description: User text input.
                      required:
                        - type
                        - text
            required:
              - role
              - content
      required:
        - agent_id
        - messages
    TranslationAgentResponse:
      type: object
      properties:
        id:
          description: Task ID.
          type: string
        agent_id:
          type: string
          description: Agent ID.
        status:
          type: string
          description: Task status.
        choices:
          type: array
          description: Model output content.
          items:
            type: object
            properties:
              index:
                type: integer
                description: Result index.
              finish_reason:
                type: string
                description: >-
                  Termination reason: `stop` (normal completion), `tool_calls`
                  (model calls), `length` (token limit exceeded), `sensitive`
                  (content flagged), `network_error` (model inference error).
              messages:
                type: object
                description: Model response message.
                properties:
                  role:
                    type: string
                    description: 'Dialog role (default: `assistant`).'
                  content:
                    type: object
                    description: Inference result
                    properties:
                      type:
                        type: string
                        description: Result type.
                      text:
                        type: string
                        description: Result content.
        usage:
          type: object
          description: Token usage statistics.
          properties:
            prompt_tokens:
              type: integer
              description: Input tokens count.
            completion_tokens:
              type: integer
              description: Output tokens count.
            total_tokens:
              type: integer
              description: Total tokens count.
            total_calls:
              type: integer
              description: Total number of calls
    SpecialEffectsVideosAgentResponse:
      allOf:
        - type: object
          properties:
            async_id:
              type: string
              description: Asynchronous task ID.
        - $ref: '#/components/schemas/SpecialEffectsVideosAgentError'
    GlmSlideAgentResponse:
      type: object
      properties:
        id:
          description: Request ID
          type: string
        conversation_id:
          type: string
          description: Conversation ID
        agent_id:
          type: string
          description: Agent ID
        choices:
          type: array
          description: Agent output.
          items:
            type: object
            properties:
              index:
                type: integer
                description: Result index.
              finish_reason:
                type: string
                description: >-
                  Reason for model inference termination. Can be ‘stop’,
                  ‘tool_calls’, ‘length’, ‘sensitive’, or ‘network_error’.
              message:
                type: array
                items:
                  type: object
                  properties:
                    role:
                      type: string
                      description: 'Role: fixed as `assistant`.'
                    phase:
                      type: string
                      description: 'Current role type: thinking、tool、answer'
                    content:
                      type: array
                      description: Content metadata
                      items:
                        type: object
                        properties:
                          type:
                            type: string
                            description: 'Response Content type: text、object'
                          tag_cn:
                            type: string
                            description: CN Tag.
                          tag_en:
                            type: string
                            description: EN Tag.
                          text:
                            type: string
                            description: Output string content when type is text
                          object:
                            type: object
                            description: Output object content when type is object
                            properties:
                              tool_name:
                                type: string
                                description: 'Tool name eg: search、insert_page'
                              input:
                                type: string
                                description: Tool input content
                              output:
                                type: string
                                description: >-
                                  Tool output content, will output html when
                                  generate slide
                              position:
                                type: array
                                description: >-
                                  If the tool involves operations on a PPT file,
                                  the position field specifies which slides are
                                  being manipulated.
                                   If the user says, “Insert a slide after the second slide,” then position = [3], and the output is the HTML content of the third slide.
                                   If the user says, “Please delete slides 4, 5, and 6,” then position = [4, 5, 6].
                                items:
                                  type: number
        error:
          type: object
          properties:
            code:
              type: string
              description: Error code.
            message:
              type: string
              description: Error message.
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
    SpecialEffectsVideosAgentError:
      type: object
      properties:
        status:
          type: string
          description: 'Status: `pending` (task created), `failed` (task creation failed).'
        agent_id:
          type: string
          description: Agent ID
        error:
          type: object
          properties:
            code:
              type: string
              description: Error code.
            message:
              type: string
              description: Error message.
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# File Upload

> This API is designed for uploading auxiliary files (such as glossaries, terminology lists) to support the translation service. It allows users to upload reference materials that can enhance translation accuracy and consistency.

## File Limitations

* Maximum 100 files
* Maximum 100MB per file
* Files retained for 180 days
* Supported formats: pdf, doc, xlsx, ppt, txt, jpg, png


## OpenAPI

````yaml POST /paas/v4/files
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
  /paas/v4/files:
    post:
      description: >-
        This API is designed for uploading auxiliary files (such as glossaries,
        terminology lists) to support the translation service. It allows users
        to upload reference materials that can enhance translation accuracy and
        consistency.
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                purpose:
                  type: string
                  description: Upload purpose (agent)
                  default: agent
                  enum:
                    - agent
                file:
                  type: string
                  format: binary
                  description: >-
                    File to upload. Limit to `100MB`. Allowed formats: `pdf`,
                    `doc`, `xlsx`, `ppt`, `txt`, `jpg`, `png`.
              required:
                - purpose
                - file
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                    description: Unique identifier of the uploaded file.
                  object:
                    type: string
                    description: Object type.
                  bytes:
                    type: integer
                    description: File size in bytes.
                  filename:
                    type: string
                    description: Name of the uploaded file.
                  purpose:
                    type: string
                    description: Purpose of the uploaded file.
                  created_at:
                    type: integer
                    description: Timestamp of file creation.
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
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
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieve Result

> This endpoint is used to query the result of an asynchronous request.



## OpenAPI

````yaml POST /v1/agents/async-result
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
  /v1/agents/async-result:
    post:
      description: This endpoint is used to query the result of an asynchronous request.
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CommonAgentResultRequest'
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CommonAgentResultResponse'
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SpecialEffectsVideosAgentError'
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
    CommonAgentResultRequest:
      type: object
      properties:
        agent_id:
          type: string
          description: 'Agent ID: `vidu_template_agent`.'
        async_id:
          type: string
          description: Task ID from async response.
    CommonAgentResultResponse:
      type: object
      properties:
        status:
          type: string
          description: '`pending` (processing), `success` (completed), `failed` (failed).'
        agent_id:
          type: string
          description: Agent ID
        async_id:
          type: string
          description: Asynchronous task ID.
        choices:
          type: array
          description: Agent output.
          items:
            type: object
            properties:
              index:
                type: integer
                description: Result index.
              finish_reason:
                type: string
                description: >-
                  Reason for model inference termination. Can be ‘stop’,
                  ‘tool_calls’, ‘length’, ‘sensitive’, or ‘network_error’.
              message:
                type: array
                items:
                  type: object
                  properties:
                    role:
                      type: string
                      description: 'Role: fixed as `assistant`.'
                    content:
                      type: array
                      description: Video file metadata
                      items:
                        type: object
                        properties:
                          type:
                            type: string
                            description: 'object type: `video_url`.'
                          video_url:
                            type: string
                            description: MP4 video URL.
    SpecialEffectsVideosAgentError:
      type: object
      properties:
        status:
          type: string
          description: 'Status: `pending` (task created), `failed` (task creation failed).'
        agent_id:
          type: string
          description: Agent ID
        error:
          type: object
          properties:
            code:
              type: string
              description: Error code.
            message:
              type: string
              description: Error message.
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Conversation History

> This endpoint is used to query the agent conversation history.Only support slides_glm_agent



## OpenAPI

````yaml POST /v1/agents/conversation
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
  /v1/agents/conversation:
    post:
      description: >-
        This endpoint is used to query the agent conversation history.Only
        support slides_glm_agent
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GlmSlideAgentConversationRequest'
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GlmSlideAgentConversationResponse'
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
    GlmSlideAgentConversationRequest:
      type: object
      properties:
        agent_id:
          type: string
          description: Agent ID
        conversation_id:
          type: string
          description: Conversation ID
        custom_variables:
          type: object
          description: Custom variables
          properties:
            include_pdf:
              type: boolean
              description: Is export the pdf file
            pages:
              type: array
              description: Slides Pages
              items:
                type: object
                properties:
                  position:
                    type: number
                    description: Slide Page Position
                  width:
                    type: number
                    description: 'Slide Width, unit: pt'
                  height:
                    type: number
                    description: 'Slide Height, unit: pt'
    GlmSlideAgentConversationResponse:
      type: object
      properties:
        conversation_id:
          type: string
          description: Conversation ID
        agent_id:
          type: string
          description: Agent ID
        choices:
          type: array
          description: Agent output.
          items:
            type: object
            properties:
              message:
                type: array
                items:
                  type: object
                  properties:
                    role:
                      type: string
                      description: 'Role: fixed as `assistant`.'
                    content:
                      type: array
                      description: Content metadata
                      items:
                        type: object
                        properties:
                          type:
                            type: string
                            description: 'Response Content type: file_url、image_url'
                          tag_cn:
                            type: string
                            description: CN Tag.
                          tag_en:
                            type: string
                            description: EN Tag.
                          file_url:
                            type: string
                            description: Output file_url content when type is file_url
                          image_url:
                            type: string
                            description: Output image_url content when type is image_url
        error:
          type: object
          properties:
            code:
              type: string
              description: Error code.
            message:
              type: string
              description: Error message.
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
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: >-
        Use the following format for authentication: Bearer [<your api
        key>](https://z.ai/manage-apikey/apikey-list)

````