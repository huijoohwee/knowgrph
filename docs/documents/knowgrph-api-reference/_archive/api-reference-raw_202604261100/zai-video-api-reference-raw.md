> ## Documentation Index
> Fetch the complete documentation index at: https://docs.z.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Generate Video(Async)

> CogVideoX is a video generation large model developed by Z.AI, equipped with powerful video generation capabilities. Simply inputting text or images allows for effortless video creation.

Vidu: A high-performance video large model that combines high consistency and high dynamism, with precise semantic understanding and exceptional reasoning speed.



## OpenAPI

````yaml POST /paas/v4/videos/generations
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
  /paas/v4/videos/generations:
    post:
      description: >-
        CogVideoX is a video generation large model developed by Z.AI, equipped
        with powerful video generation capabilities. Simply inputting text or
        images allows for effortless video creation.


        Vidu: A high-performance video large model that combines high
        consistency and high dynamism, with precise semantic understanding and
        exceptional reasoning speed.
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
      requestBody:
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/CogVideoX3Request'
                  title: CogVideoX-3
                - $ref: '#/components/schemas/ViduText2VideoRequest'
                  title: 'Vidu: Text to Video'
                - $ref: '#/components/schemas/ViduImage2VideoRequest'
                  title: 'Vidu: Image to Video'
                - $ref: '#/components/schemas/ViduFrames2VideoRequest'
                  title: 'Vidu: First & Last Frame to Video'
                - $ref: '#/components/schemas/ViduReference2VideoRequest'
                  title: 'Vidu: Ref to Video'
            examples:
              Text to Video Example:
                value:
                  model: cogvideox-3
                  prompt: A cat is playing with a ball.
                  quality: quality
                  with_audio: true
                  size: 1920x1080
                  fps: 30
              Image to Video Example:
                value:
                  model: cogvideox-3
                  image_url: >-
                    https://img.iplaysoft.com/wp-content/uploads/2019/free-images/free_stock_photo.jpg
                  prompt: Make the picture move
                  quality: quality
                  with_audio: true
                  size: 1920x1080
                  fps: 30
              First Last Frame to Video:
                value:
                  model: cogvideox-3
                  image_url:
                    - >-
                      https://gd-hbimg.huaban.com/ccee58d77afe8f5e17a572246b1994f7e027657fe9e6-qD66In_fw1200webp
                    - >-
                      https://gd-hbimg.huaban.com/cc2601d568a72d18d90b2cc7f1065b16b2d693f7fa3f7-hDAwNq_fw1200webp
                  prompt: Make the picture move
                  quality: quality
                  with_audio: true
                  size: 1920x1080
                  fps: 30
        required: true
      responses:
        '200':
          description: Processing successful.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VideoResponse'
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
    CogVideoX3Request:
      allOf:
        - type: object
          properties:
            model:
              type: string
              description: The model code to be called.
              enum:
                - cogvideox-3
            prompt:
              type: string
              description: >-
                Text description of the video, maximum input length of 512
                characters. Either image_url or prompt must be provided, or
                both.
            quality:
              type: string
              description: >-
                Output mode, default is `speed`.

                - `quality`: Prioritizes quality, higher generation quality. 

                - `speed`: Prioritizes speed, faster generation time, relatively
                lower quality.
              example: speed
              enum:
                - speed
                - quality
            with_audio:
              type: boolean
              description: >-
                Whether to generate AI sound effects. Default: `false` (no sound
                effects).
              example: false
            image_url:
              type: array
              description: >-
                Provide an image based on which content will be generated. If
                this parameter is passed, the system will operate based on this
                image. Supports passing images via URL or Base64 encoding. Image
                requirements: images support `.png`, `.jpeg`, `.jpg` formats;
                image size: no more than `5M`. Either image_url and prompt can
                be used, or both can be passed simultaneously.

                First and last frames: supports inputting two images. The first
                uploaded image is regarded as the first frame, and the second
                image is regarded as the last frame. The model will generate the
                video based on the images passed in this parameter.

                First and last frame mode only supports `speed` mode
              items:
                oneOf:
                  - title: Image URL
                    type: string
                    format: uri
                    example: https://example.com/image.png
                  - title: Base64 Encoded Image
                    type: string
                    format: byte
                    example: data:image/png;base64, XXX
            size:
              type: string
              description: >-
                Default value: if not specified, the short side of the generated
                video is 1080 by default, and the long side is determined
                according to the original image ratio. Maximum support for 4K
                resolution. Resolution options: "1280x720", "720x1280",
                "1024x1024", "1080x1920", "2048x1080", "3840x2160"
              example: 1920x1080
              enum:
                - 1280x720
                - 720x1280
                - 1024x1024
                - 1920x1080
                - 1080x1920
                - 2048x1080
                - 3840x2160
            fps:
              type: integer
              description: >-
                Video frame rate (FPS), optional values are `30` or `60`.
                Default: `30`.
              example: 30
              enum:
                - 30
                - 60
            duration:
              type: integer
              description: >-
                Video duration, default is 5 seconds, supports `5` and `10`
                seconds.
              example: 5
              enum:
                - 5
                - 10
          required:
            - model
        - $ref: '#/components/schemas/VideoCommonRequest'
    ViduText2VideoRequest:
      allOf:
        - type: object
          properties:
            model:
              type: string
              description: The model code to be called.
              enum:
                - viduq1-text
            prompt:
              type: string
              description: >-
                Text description of the video, maximum input length of 512
                characters.
            style:
              type: string
              description: >-
                Style

                Default: `general`

                Optional values: `general` , `anime`

                - `general`: General style, can be controlled using prompts to
                define the style.

                - `anime`: Anime style, optimized for anime-specific visuals.
                The style can be controlled using different anime-themed
                prompts.
              enum:
                - general
                - anime
            duration:
              type: integer
              description: |-
                Video duration parameter.
                Default: `5` , Optional: `5`.
              example: 5
              enum:
                - 5
            aspect_ratio:
              type: string
              description: |-
                Aspect ratio
                Default: `16:9`, Optional values: `16:9`, `9:16`, `1:1`
              example: '16:9'
              enum:
                - '16:9'
                - '9:16'
                - '1:1'
            size:
              type: string
              description: |-
                Resolution parameter
                Default: `1920x1080`, Optional: `1920x1080`
              example: 1920x1080
              enum:
                - 1920x1080
            movement_amplitude:
              type: string
              description: >-
                Motion amplitude

                Default: `auto` , Optional values:  `auto` ,`small` ,`medium`
                ,`large`
              example: auto
              enum:
                - auto
                - small
                - medium
                - large
          required:
            - model
            - prompt
        - $ref: '#/components/schemas/VideoCommonRequest'
    ViduImage2VideoRequest:
      allOf:
        - type: object
          properties:
            model:
              type: string
              description: The model code to be called.
              enum:
                - viduq1-image
                - vidu2-image
            prompt:
              type: string
              description: >-
                Text description of the video, maximum input length of 512
                characters. Either image_url or prompt must be provided, or
                both.
            image_url:
              type: string
              description: >-
                The model will use the image provided in this parameter as the
                first frame to generate the video.

                Only `1` image is supported.

                Supported formats: `png` , `jpeg` , `jpg` , `webp` .

                Image aspect ratio must be less than `1:4` or `4:1`.

                Image file size must not exceed `50MB`.

                Note: After Base64 decoding, the byte length must be less than
                50 MB, and the encoding must include the appropriate content
                type string (e.g., `data:image/png;base64,{base64_encode}`).
              oneOf:
                - title: Image URL
                  type: string
                  format: uri
                  example: https://example.com/image.png
                - title: Base64 Encoded Image
                  type: string
                  format: byte
                  example: data:image/png;base64, XXX
            duration:
              oneOf:
                - title: viduq1-image
                  type: integer
                  description: |-
                    Video duration parameter.
                    Default: `5` , Optional: `5`.
                  example: 5
                  enum:
                    - 5
                - title: viduq2-image
                  type: integer
                  description: |-
                    Video duration parameter.
                    Default: `4` , Optional: `4`.
                  example: 4
                  enum:
                    - 4
            size:
              oneOf:
                - title: viduq1-image
                  type: string
                  description: |-
                    Resolution parameter
                    Default: `1920x1080`, Optional: `1920x1080`
                  example: 1920x1080
                  enum:
                    - 1920x1080
                - title: viduq2-image
                  type: string
                  description: |-
                    Resolution parameter
                    Default: `1280x720`, Optional: `1280x720`
                  example: 1280x720
                  default: 1280x720
                  enum:
                    - 1280x720
            movement_amplitude:
              type: string
              description: >-
                Motion amplitude

                Default: `auto` , Optional values:  `auto` ,`small` ,`medium`
                ,`large`
              example: auto
              enum:
                - auto
                - small
                - medium
                - large
            with_audio:
              type: boolean
              description: Add background music to the generated video.
          required:
            - model
        - $ref: '#/components/schemas/VideoCommonRequest'
    ViduFrames2VideoRequest:
      allOf:
        - type: object
          properties:
            model:
              type: string
              description: The model code to be called.
              enum:
                - viduq1-start-end
                - vidu2-start-end
            prompt:
              type: string
              description: >-
                Text description of the video, maximum input length of 512
                characters. Either image_url or prompt must be provided, or
                both.
            image_url:
              type: array
              description: >-
                Images

                Supports input of two images: the first uploaded image will be
                treated as the first frame, and the second image as the last
                frame. The model will use the images provided in this parameter
                to generate a video.

                The resolutions of the two input images (first and last frame)
                must be similar, with the ratio between the resolution of the
                first frame and the resolution of the last frame falling within
                `0.8–1.25`. Additionally, the image aspect ratio must be less
                than `1:4` or `4:1`.

                Supports image URLs or images encoded in Base64 (ensure
                accessibility; using image URLs is recommended).

                Supported formats: `png`, `jpeg`, `.jpg`, `webp`.

                Image file size must not exceed `50 MB`.

                Note: After Base64 decoding, the byte length must be less than
                50 MB, and the encoding must include the appropriate content
                type string, such as `data:image/png;base64,{base64_encode}`.
              items:
                type: string
                minLength: 1
              minItems: 1
              maxItems: 2
            duration:
              oneOf:
                - title: viduq1-start-end
                  type: integer
                  description: |-
                    Video duration parameter.
                    Default: `5` , Optional: `5`.
                  example: 5
                  enum:
                    - 5
                - title: vidu2-start-end
                  type: integer
                  description: |-
                    Video duration parameter.
                    Default: `4` , Optional: `4`.
                  example: 4
                  enum:
                    - 4
            size:
              oneOf:
                - title: viduq1-start-end
                  type: string
                  description: |-
                    Resolution parameter
                    Default: `1920x1080`, Optional: `1920x1080`
                  example: 1920x1080
                  enum:
                    - 1920x1080
                - title: vidu2-start-end
                  type: string
                  description: |-
                    Resolution parameter
                    Default: `1280x720`, Optional: `1280x720`
                  example: 1280x720
                  default: 1280x720
                  enum:
                    - 1280x720
            movement_amplitude:
              type: string
              description: >-
                Motion amplitude

                Default: `auto` , Optional values:  `auto` ,`small` ,`medium`
                ,`large`
              example: auto
              enum:
                - auto
                - small
                - medium
                - large
            with_audio:
              type: boolean
              description: Add background music to the generated video.
          required:
            - model
        - $ref: '#/components/schemas/VideoCommonRequest'
    ViduReference2VideoRequest:
      allOf:
        - type: object
          properties:
            model:
              type: string
              description: The model code to be called.
              enum:
                - vidu2-reference
            prompt:
              type: string
              description: >-
                Text description of the video, maximum input length of 512
                characters. Either image_url or prompt must be provided, or
                both.
            image_url:
              type: array
              description: >-
                Image reference

                Supports input of 1 to 3 images. The model will use the themes
                from the images provided in this parameter as references to
                generate a video with consistent subjects.

                1. Supports image URLs or images encoded in Base64 (ensure
                accessibility; it is recommended to prioritize using image
                URLs).

                2. Supported formats: `png`, `jpeg`, `.jpg`, `webp`.

                3. Image resolution must not be smaller than `128x128`, and the
                aspect ratio must be less than `1:4` or `4:1`.

                4. Image file size must not exceed `50 MB`.

                5. Note: After Base64 decoding, the byte length must be less
                than 50 MB, and the encoding must include the proper
                content-type string, such as
                `data:image/png;base64,{base64_encode}`.
              items:
                type: string
                minLength: 1
              minItems: 1
              maxItems: 3
            duration:
              title: vidu2-reference
              type: integer
              description: |-
                Video duration parameter.
                Default: `4` , Optional: `4`.
              example: 4
              enum:
                - 4
            aspect_ratio:
              type: string
              description: |-
                Aspect ratio
                Default: `16:9`, Optional values: `16:9`, `9:16`, `1:1`
              example: '16:9'
              enum:
                - '16:9'
                - '9:16'
                - '1:1'
            size:
              title: 'vidu2-reference '
              type: string
              description: |-
                Resolution parameter
                Default: `1280x720`, Optional: `1280x720`
              example: 1280x720
              enum:
                - 1280x720
            movement_amplitude:
              type: string
              description: >-
                Motion amplitude

                Default: `auto` , Optional values:  `auto` ,`small` ,`medium`
                ,`large`
              example: auto
              enum:
                - auto
                - small
                - medium
                - large
            with_audio:
              type: boolean
              description: Add background music to the generated video.
          required:
            - model
        - $ref: '#/components/schemas/VideoCommonRequest'
    VideoResponse:
      type: object
      properties:
        model:
          description: Model name used in this call.
          type: string
        id:
          description: >-
            Task order number generated by the Z.AI, use this order number when
            calling the request result interface.
          type: string
        request_id:
          description: >-
            Task number submitted by the user during the client request or
            generated by the platform.
          type: string
        task_status:
          description: >-
            Processing status, `PROCESSING (processing)`,` SUCCESS (success)`,
            `FAIL (failure)`. Results need to be obtained via query.
          type: string
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
    VideoCommonRequest:
      type: object
      properties:
        request_id:
          type: string
          description: >-
            Provided by the client, must be unique; used to distinguish each
            request’s unique identifier. If not provided by the client, the
            platform will generate one by default.
        user_id:
          type: string
          description: >-
            Unique ID of the end-user, assists the platform in intervening in
            end-user violations, generating illegal or inappropriate
            information, or other abusive behaviors. ID length requirement:
            minimum `6` characters, maximum `128` characters.
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

````yaml GET /paas/v4/async-result/{id}
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
  /paas/v4/async-result/{id}:
    get:
      description: This endpoint is used to query the result of an asynchronous request.
      parameters:
        - $ref: '#/components/parameters/AcceptLanguage'
        - name: id
          in: path
          required: true
          schema:
            type: string
            description: Task id.
      responses:
        '200':
          description: Processing successful
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/AsyncVideoGenerationResponse'
                    title: Video Generation
                  - $ref: '#/components/schemas/AsyncImageGenerationResponse'
                    title: Image Generation
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
    AsyncVideoGenerationResponse:
      type: object
      properties:
        model:
          type: string
          description: Model name.
        task_status:
          type: string
          description: >-
            Processing status, `PROCESSING` (processing), `SUCCESS` (success),
            `FAIL` (failure). Note: Processing status needs to be obtained via
            query.
        video_result:
          type: array
          description: Video generation results.
          items:
            type: object
            properties:
              url:
                type: string
                description: Video URL.
              cover_image_url:
                type: string
                description: Video cover URL.
        request_id:
          description: >-
            Task number submitted by the user during the client request or
            generated by the platform.
          type: string
    AsyncImageGenerationResponse:
      type: object
      properties:
        model:
          type: string
          description: Model name.
        task_status:
          type: string
          description: >-
            Processing status, `PROCESSING` (processing), `SUCCESS` (success),
            `FAIL` (failure). Note: Processing status needs to be obtained via
            query.
        image_result:
          type: array
          description: Array containing the generated image URLs.
          items:
            type: object
            properties:
              url:
                type: string
                description: >-
                  Image URL. The temporary link expires after `30` days, please
                  store it promptly.
        request_id:
          type: string
          description: >-
            Unique ID identifying this request, can be submitted by the user or
            generated by the platform.
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