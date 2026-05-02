> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Tokenizer

> `Tokenizer` is used to split text into `tokens` recognizable by the model and calculate the count. It receives user input text, processes it through the model for tokenization, and finally returns the corresponding `token` count. It is suitable for text length evaluation, model input estimation, dialogue context truncation, cost calculation, etc.



## OpenAPI

````yaml POST /paas/v4/tokenizer
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
  /paas/v4/tokenizer:
    post:
      summary: Text Tokenizer
      description: >-
        `Tokenizer` is used to split text into `tokens` recognizable by the
        model and calculate the count. It receives user input text, processes it
        through the model for tokenization, and finally returns the
        corresponding `token` count. It is suitable for text length evaluation,
        model input estimation, dialogue context truncation, cost calculation,
        etc.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TokenizerRequest'
            examples:
              Text Tokenization Example:
                value:
                  model: glm-4.6
                  messages:
                    - role: user
                      content: >-
                        What opportunities and challenges will the Chinese large
                        model industry face in 2025?
        required: true
      responses:
        '200':
          description: Business processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenizerResponse'
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    TokenizerRequest:
      type: object
      required:
        - model
        - messages
      properties:
        model:
          type: string
          description: The model code to be called.
          example: glm-4.6
          default: glm-4.6
          enum:
            - glm-4.6
            - glm-4.6v
            - glm-4.5
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
        tools:
          type: array
          description: List of tools the model can call. Supports up to `128` functions.
          anyOf:
            - items:
                $ref: '#/components/schemas/FunctionToolSchema'
        request_id:
          type: string
          description: >-
            Passed by the client, must be unique. If empty, it will be generated
            by default.
        user_id:
          type: string
          description: Unique `ID` of the end user
    TokenizerResponse:
      type: object
      properties:
        created:
          type: integer
          format: int64
          example: 1727156815
        id:
          type: string
          example: 20241120141244890ab4ee4af84acf
          description: >-
            The task sequence number generated by the Zhipu AI Open Platform.
            Please use this number when calling the request result interface.
        request_id:
          type: string
          example: '1'
          description: >-
            The task number submitted by the client or generated by the platform
            when the request was initiated.
        usage:
          type: object
          properties:
            prompt_tokens:
              type: number
              description: Prompt tokens in this input
            image_tokens:
              type: number
              description: Image tokens in this input
            video_tokens:
              type: number
              description: Video tokens in this input
            total_tokens:
              type: number
              description: Total tokens in this input
      required:
        - id
        - usage
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

---

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Layout Parsing

> Use the [GLM-OCR](/guides/vlm/glm-ocr) model to parse the layout of documents and images and extract text content. Support OCR recognition of images and PDF documents, returning detailed layout information and visualization results.



## OpenAPI

````yaml POST /paas/v4/layout_parsing
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
  /paas/v4/layout_parsing:
    post:
      summary: Layout Parsing
      description: >-
        Use the [GLM-OCR](/guides/vlm/glm-ocr) model to parse the layout of
        documents and images and extract text content. Support OCR recognition
        of images and PDF documents, returning detailed layout information and
        visualization results.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LayoutParsingRequest'
            examples:
              Layout Parsing Example:
                value:
                  model: glm-ocr
                  file: https://cdn.bigmodel.cn/static/logo/introduction.png
        required: true
      responses:
        '200':
          description: Business processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LayoutParsingResponse'
        default:
          description: Request failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    LayoutParsingRequest:
      type: object
      required:
        - model
        - file
      properties:
        model:
          type: string
          description: 'Model code: `glm-ocr`'
          example: glm-ocr
          enum:
            - glm-ocr
        file:
          type: string
          description: >-
            Image or PDF document to be recognized, supports URL and base64.
            Supported image formats: PDF, JPG, PNG. Single image ≤10MB, PDF
            ≤50MB, maximum support 100 pages
          example: https://cdn.bigmodel.cn/static/logo/introduction.png
        return_crop_images:
          type: boolean
          description: Whether to return screenshot information
          default: false
        need_layout_visualization:
          type: boolean
          description: Whether to return detailed layout image result information
          default: false
        start_page_id:
          type: integer
          description: Start page number for parsing when PDF is provided
          minimum: 1
        end_page_id:
          type: integer
          description: End page number for parsing when PDF is provided
          minimum: 1
        request_id:
          type: string
          description: Unique request identifier, automatically generated if not provided
          example: req_123456789
        user_id:
          type: string
          description: 'End user ID for abuse monitoring. Length: 6-128 characters'
          minLength: 6
          maxLength: 128
          example: user_123456
    LayoutParsingResponse:
      type: object
      properties:
        id:
          type: string
          description: Task ID
          example: task_123456789
        created:
          type: integer
          format: int64
          description: Request creation time, Unix timestamp in seconds
          example: 1727156815
        model:
          type: string
          description: Model name
          example: GLM-OCR
        md_results:
          type: string
          description: Recognition result in Markdown format
          example: |-
            # Doc title
            This is the document content...
        layout_details:
          type: array
          description: Detailed layout information
          items:
            type: array
            items:
              $ref: '#/components/schemas/LayoutDetail'
        layout_visualization:
          type: array
          description: Recognition result image URLs
          items:
            type: string
        data_info:
          $ref: '#/components/schemas/DataInfo'
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
        request_id:
          type: string
          description: Request ID
          example: req_123456789
      required:
        - id
        - created
        - model
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
    LayoutDetail:
      type: object
      description: Layout detail element
      properties:
        index:
          type: integer
          description: Element index
          example: 1
        label:
          type: string
          description: >-
            Element type: image for images, text for text content, formula for
            inline formulas, table for tables
          enum:
            - image
            - text
            - formula
            - table
          example: text
        bbox_2d:
          type: array
          description: Normalized element coordinates [x1,y1,x2,y2]
          items:
            type: number
            minimum: 0
            maximum: 1
          minItems: 4
          maxItems: 4
          example:
            - 0.1
            - 0.1
            - 0.5
            - 0.3
        content:
          type: string
          description: Element content (text / image URL / table HTML)
          example: This is the content of the element
        height:
          type: integer
          description: Page height
          example: 800
        width:
          type: integer
          description: Page width
          example: 600
      required:
        - index
        - label
    DataInfo:
      type: object
      description: Document basic information
      properties:
        num_pages:
          type: integer
          description: Total number of document pages
          example: 5
        pages:
          type: array
          description: Document page count information
          items:
            $ref: '#/components/schemas/PageInfo'
      required:
        - num_pages
    PageInfo:
      type: object
      description: Page dimension information
      properties:
        width:
          type: integer
          description: Page width
          example: 600
        height:
          type: integer
          description: Page height
          example: 800
      required:
        - width
        - height
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

# Web Search

> The [Web Search](/guides/tools/web-search) is a specialized search engine for large language models. Building upon traditional search engine capabilities like web crawling and ranking, it enhances intent recognition to return results better suited for LLM processing (including webpage titles, URLs, summaries, site names, favicons etc.).



## OpenAPI

````yaml POST /paas/v4/web_search
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
  /paas/v4/web_search:
    post:
      description: >-
        The [Web Search](/guides/tools/web-search) is a specialized search
        engine for large language models. Building upon traditional search
        engine capabilities like web crawling and ranking, it enhances intent
        recognition to return results better suited for LLM processing
        (including webpage titles, URLs, summaries, site names, favicons etc.).
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebSearchRequest'
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebSearchResponse'
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
    WebSearchRequest:
      type: object
      properties:
        search_engine:
          type: string
          description: |-
            The search engine code to call.
             search-prime: Z.AI Premium Version Search Engine
          example: search-prime
          default: search-prime
          enum:
            - search-prime
        search_query:
          type: string
          description: The content to be searched.
        count:
          type: integer
          description: |-
            The number of results to return
            Fillable range: `1-50`, maximum `50` results per single search
            Default is `10`
            Supported search engines: 
            `search_pro_jina`.
          minimum: 1
          maximum: 50
        search_domain_filter:
          type: string
          description: >-
            Used to limit the scope of search results and only return content
            from specified whitelist domains.

            Whitelist: Directly enter the domain name (e.g., `www.example.com`)

            Supported search engines: 

            `search_pro_jina`
        search_recency_filter:
          type: string
          description: |-
            Search for webpages within a specified time range.
            Default is `noLimit`
            Fillable values:
            `oneDay`: within one day
            `oneWeek`: within one week
            `oneMonth`: within one month
            `oneYear`: within one year
            `noLimit`: no limit (default)
            Supported search engines: 
            `search_pro_jina`
          enum:
            - oneDay
            - oneWeek
            - oneMonth
            - oneYear
            - noLimit
        request_id:
          type: string
          description: >-
            User-provided unique identifier for distinguishing requests. If not
            provided, the platform will generate one.
        user_id:
          type: string
          description: >-
            Unique ID of the end user, helping the platform intervene in illegal
            activities, inappropriate content generation, or other abuses. ID
            length: 6 to 128 characters.
      required:
        - search_engine
        - search_query
    WebSearchResponse:
      type: object
      properties:
        id:
          description: Task ID.
          type: string
        created:
          description: Request creation time, Unix timestamp in seconds.
          type: integer
        search_result:
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

# Web Reader

> Reads and parses the content of the specified URL. Supports selectable return formats, cache control, image retention, and summary options.



## OpenAPI

````yaml POST /paas/v4/reader
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
  /paas/v4/reader:
    post:
      tags:
        - Tools API
      summary: Web Reader
      description: >-
        Reads and parses the content of the specified URL. Supports selectable
        return formats, cache control, image retention, and summary options.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReaderRequest'
            examples:
              Basic:
                value:
                  url: https://www.example.com
        required: true
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReaderResponse'
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    ReaderRequest:
      type: object
      properties:
        url:
          type: string
          description: The URL to retrieve
        timeout:
          type: integer
          description: Request timeout in seconds. Default is 20
          default: 20
        no_cache:
          type: boolean
          description: Whether to disable caching (true/false). Default is false
          default: false
        return_format:
          type: string
          description: Return format (e.g., markdown, text). Default is markdown
          default: markdown
        retain_images:
          type: boolean
          description: Whether to retain images (true/false). Default is true
          default: true
        no_gfm:
          type: boolean
          description: >-
            Whether to disable GitHub Flavored Markdown (true/false). Default is
            false
          default: false
        keep_img_data_url:
          type: boolean
          description: Whether to keep image data URLs (true/false). Default is false
          default: false
        with_images_summary:
          type: boolean
          description: Whether to include image summary (true/false). Default is false
          default: false
        with_links_summary:
          type: boolean
          description: Whether to include links summary (true/false). Default is false
          default: false
      required:
        - url
    ReaderResponse:
      type: object
      properties:
        id:
          type: string
          description: Task ID
        created:
          type: integer
          format: int64
          description: Request creation time as a Unix timestamp in seconds
        request_id:
          type: string
          description: >-
            Client-provided unique identifier to distinguish requests. If not
            provided, the platform will generate one.
        model:
          type: string
          description: Model code
        reader_result:
          type: object
          description: Web reading result
          properties:
            content:
              type: string
              description: Main content parsed from the page (body, images, links, etc.)
            description:
              type: string
              description: Brief description of the page
            title:
              type: string
              description: Page title
            url:
              type: string
              description: Original page URL
            external:
              type: object
              description: External resources referenced by the page
              properties:
                stylesheet:
                  type: object
                  description: Collection of external stylesheets
                  additionalProperties:
                    type: object
                    properties:
                      type:
                        type: string
                        description: Stylesheet MIME type, typically `text/css`
            metadata:
              type: object
              description: Page metadata
              properties:
                keywords:
                  type: string
                  description: Page keywords
                viewport:
                  type: string
                  description: Viewport settings
                description:
                  type: string
                  description: Meta description
                format-detection:
                  type: string
                  description: Format detection settings, e.g., `telephone=no`
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