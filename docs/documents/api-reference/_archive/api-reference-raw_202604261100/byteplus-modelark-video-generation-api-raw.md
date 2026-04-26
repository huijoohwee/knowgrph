# Video generation API

## Create a video generation task

`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`[ ](https://api.volcengine.com/api-explorer/?action=CreateContentsGenerationsTasks&data=%7B%7D&groupName=%E8%A7%86%E9%A2%91%E7%94%9F%E6%88%90API&query=%7B%7D&serviceCode=ark&version=2024-01-01)[Try](https://api.byteplus.com/api-explorer/?action=CreateContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01) 
This topic describes the request and response parameters for the API operation that creates a video generation task. You can use it to look up parameter definitions when calling this operation.
After the specified model generates a video based on the references provided in the request, you can query the task by conditions and retrieve the generated video.

<span id="hfIqUF5g"></span>
### Model capabilities==^new^==

* **Seedance 2.0 & 2.0 fast ** **==^new^==** ** (Video with audio/Silent video)** 
   * **Multimodal reference\-based video generation ** **==^new^==**: Input **reference images (0\-9) + videos (0\-3) + audio (0\-3) + text prompt (optional)**  to generate one video. 
      **Notes**: 
      * Audio cannot be input alone; at least one reference video or image are required. 
      * Supports generating new videos, editing videos, and extending videos, see the [Seedance 2.0 series tutorial](https://docs.byteplus.com/en/docs/ModelArk/2291680) for detailed examples.
   * **Image\-to\-video (first & last frame)** : Generate one target video using a **start\-frame image + end\-frame image** and an optional **text prompt**.
   * **Image\-to\-video (first frame)** : Generate one target video using a **start\-frame image** and an optional **text prompt**.
   * **Text\-to\-video**: Generate one target video using a **text prompt**.
* **Seedance 1.5 pro (Video with audio/Silent video)** 
   * **Image\-to\-Video\-First Frame and Last Frame: ** Generate the target video based on your ++first\-frame image++ +  ++last\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ . 
   * **Image\-to\-Video\-First Frame:**  Generate the target video based on your ++first\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ .
   * **Text\-to\-Video: ** Generate the target video based on your ++text prompt++ + ++parameters (optional)++ .
* **Seedance 1.0 pro**
   * **Image\-to\-Video\-First Frame and Last Frame: ** Generate the target video based on your ++first\-frame image++ +  ++last\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ . 
   * **Image\-to\-Video\-First Frame:**  Generate the target video based on your ++first\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ .
   * **Text\-to\-Video: ** Generate the target video based on your ++text prompt++ + ++parameters (optional)++ .
* **seedance\-pro\-fast**
   * **Image\-to\-Video\-First Frame:**  Generate the target video based on your ++first\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ .
   * **Text\-to\-Video: ** Generate the target video based on your ++text prompt++ + ++parameters (optional)++ .
* **Seedance 1.0 lite**
   * **seedance\-1\-0\-lite\-t2v: **  Text\-to\-Video. Generate the target video based on your ++text prompt++ + ++parameters (optional)++ .
   * **seedance\-1\-0\-lite\-i2v: ** Image\-to\-Video. 
      * **Image\-to\-Video\-Reference Images: ** Generate the target video based on your ++reference images (1\-4 images)++  + ++text prompt (optional)++  + ++parameters (optional)++ .
      * **Image\-to\-Video\-First Frame and Last Frame: ** Generate the target video based on your ++first\-frame image++ +  ++last\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ . 
      * **Image\-to\-Video\-First Frame:**  Generate the target video based on your ++first\-frame image++ + ++text prompt (optional)++  + ++parameters (optional)++ .


```mixin-react
return (<Tabs>
<Tabs.TabPane title="Try" key="srUpU6IS"><RenderMd content={`<APILink link="https://api.byteplus.com/api-explorer/?action=CreateContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01" description="API Explorer 您可以通过 API Explorer 在线发起调用，无需关注签名生成过程，快速获取调用结果。">去调试</APILink>

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Quick start" key="UgdvNwUx"><RenderMd content={` <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_b9c82890e851fc10cc31f48f9065abc6.png =20x) </span>[Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision)  <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_2abecd05ca2779567c6d32f0ddc7874d.png =20x) </span>[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310) <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1544106#video-generation) <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Tutorial](https://docs.byteplus.com/en/docs/ModelArk/1366799) <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[ API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API) <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411) <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="HknYsLYR"><RenderMd content={`This interface only supports API Key authentication. Please obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```

<span id="kM8oKJJH"></span>
## Request parameters
> Go to [Response parameters](#Ag40Ad3H)


---


<span id="0j5hYOcF"></span>
### Request body
**model** `string` `Required`
The ID of the model that you want to call. You can [activate a model service](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision) and [query the model ID](https://docs.byteplus.com/en/docs/ModelArk/1330310).
You can also use an endpoint ID to call a model, querying its rate limits, billing method (prepaid or postpaid), and status, and using its advanced capabilities such as monitoring and security. For more information, refer to [Obtaining an endpoint ID](https://docs.byteplus.com/en/docs/ModelArk/1099522).

---


**content** `object[]` `Required`
The references provided to the model for video generation, supporting text, image, audio, video, and sample task ID.
:::warning Caution
Seedance 2.0 series models do not support direct upload of reference images or videos containing real human faces. The following solutions are provided to make it easier for creatives to use portraits. For details, see [Dreamina Seedance 2.0 series tutorial](https://docs.byteplus.com/en/docs/ModelArk/2291680).

* Supports using original outputs containing human faces from certain models as input assets
* Supports using preset digital characters as input assets
* Supports using authorized real\-person assets as input assets

:::
The following combinations are supported:

* Text
* Text (optional) + image
* Text (optional) + video
* Text (optional) + image + audio
* Text (optional) + image + video
* Text (optional) + video + audio
* Text (optional) + image + video + audio
* Sample task ID: A sample video generated using the seedance model. The model can generate a high\-quality official video based on the sample.

:::warning Caution
Seedance 2.0 series models do not support direct upload of reference images or videos containing real human faces. To facilitate creators' use of portraits, ModelArk has provided a series of solutions, see the [Seedance 2.0 series tutorial](https://docs.byteplus.com/en/docs/ModelArk/2291680) for details.

:::
**Information type**

---


**Text** `object`
The input text information for the model to generate a video.

Attributes

---


content.**type ** `string` `Required`
The type of the input content. In this case, set the value to `text`.

---


content.**text ** `string` `Required`
The input text information for the model, which describes the video to be generated. The content includes:

* **Text prompt (required)** : You can use Chinese and English characters. For tips on using prompts, please refer to [Guide to Seedance Prompts](https://docs.byteplus.com/en/docs/ModelArk/1587797).
* **Parameters (optional)** : You can add \-\-[parameters] after the text prompt to control the specifications of the output video. For more information, refer to **Text commands for models (optional)** .

:::tip Tip

* Supported prompt languages: All models support English prompts; Dreamina Seedance 2.0 and 2.0 Fast models additionally support Japanese, Indonesian, Spanish and Portuguese.
* Prompt length recommendation: English prompts should not exceed 1000 words. Excessively long prompts can easily lead to scattered information, the model may ignore details and only focus on key points, thus causing some elements to be missing from the generated video.
* For detailed prompt tips, see [Seedance 2.0 & 2.0 fast prompt guide](https://docs.byteplus.com/en/docs/ModelArk/2222480).



:::

---


**Image** `object`
The input image information for the model to generate a video.

Attributes

---


content.**type ** `string` `Required`
The type of the input content. In this case, set the value to `image_url`. Supports image URL or image Base64 encoding.

---


content.**image_url ** `object` `Required`
The input image object for the model.

Attributes
content.image_url.**url ** `string` `Required`
Accepts image URL, Base64\-encoded image, or asset ID.

* URL: Enter the public accessible URL of the image.
* Base64 encoding: Convert the local file to a Base64\-encoded string, then submit to the model. Follow the format: `data:image/<image format>;base64,<Base64 encoding>`.
   **Note**: `<image format>` must be lowercase, for example, `data:image/png;base64,{base64_image}`.
* Asset ID: The URI of the digital charactercter used for video generation. It follows the format `asset://<ASSET_ID>` and can be obtained from the [digital character library](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?modelId=seedance-2-0-260128&tab=GenVideo).

:::tip Image input requirements

* Format: jpeg, png, webp, bmp, tiff, gif. Additionally, seedance 1.5 pro supports heic and heif.
* Aspect ratio (width/height): (0.4, 2.5)
* Width and height (px): (300, 6000)
* Size: 
   * Single image must be less than 30 MB
   * Request body size does not exceed 64 MB. 
   * Do not use Base64 encoding for large files.
* Number of images:
   * Image\-to\-video, first frame: 1 
   * Image\-to\-video, first and last frames: 2 
   * Seedance 2.0 multimodal reference\-to\-video generation: 1~9 
   * Seedance 1.0 lite reference image\-to\-video: 1~4 

:::
content.**role ** `string` `Required under certain conditions`
The location or purpose of the image. Valid values:
:::warning Warning

* **Image\-to\-video (first frame),**  i**mage\-to\-video (first and last frame)** , **Multimodal reference video generation** (including reference image, video, and audio) are three mutually exclusive scenarios and **cannot be mixed**.
* For multimodal reference\-based video generation, you can specify reference images as the first and/or last frame in the prompt to indirectly achieve a “first/last frame + multimodal references” effect. 
If you need to strictly ensure the first and last frames exactly match the specified images, use **Image\-to\-video (first & last frame)**  instead (set role to `first_frame` /` last_frame`).


:::
Image\-to\-video (first frame)

* **Supported models:**  All image\-to\-video models
* **Values:**  You need to pass in one **image_url** object, with the role field set to `first_frame` or leave **role** blank.


Image\-to\-video (first and last frames)

* **Supported models:  ** seedance 2.0, seedance 1.5 pro, seedance 1.0 pro, seedance 1.0 lite i2v
* **Values:**  Two **image_url ** objects must be provided, and the role field is required.
   * Role of the first frame: `first_frame`
   * Role of for the last frame: `last_frame`

:::tip Tip
first\-frame and last\-frame images can be the same one. 
If the aspect ratios of the first and last frame images are inconsistent, the first frame image takes precedence, and the last frame image will be automatically cropped to fit.

:::

Image\-to\-video (reference images)

* **Supported models: ** seedance 2.0 (1–9 images), seedance 1.0 lite i2v (1–4 images)
* **Values:**  Required. The **role ** field for each reference image must be set to `reference_image`

:::tip Tip
The text prompt for the reference image\-to\-video feature allows specifying combinations of multiple images using natural language. However, to achieve better instruction adherence, **it is recommended to specify images using the format "[Image 1]xxx, [Image 2]xxx"** .

* Example 1: Boy wearing glasses and a blue T\-shirt with a corgi puppy, sitting on the lawn, 3D cartoon style
* Example 2: [Image 1] boy wearing glasses and a blue T\-shirt and [Image 2] corgi puppy, sitting on [Image 3] the lawn, 3D cartoon style

:::


---


**Video ** **==^new ^== ** `object`
Reference video provided to the model. 
Only seedance 2.0 & 2.0 fast supports video input.
ModelArk trusts face\-containing videos generated by the seedance 2.0 and 2.0 Fast models. You can use the original face\-containing videos generated by the above models under your account within the past 30 days as input assets for video generation. For details, see the [Seedance 2.0 series tutorial](https://docs.byteplus.com/en/docs/ModelArk/2291680).

Attributes
content.**type ** `string` %%require%%
Type of the input; in this case, set to `video_url`. 
Only video URL is supported.

---


content.**video_url** ** ** `object` %%require%%
The video object provided to the model.

Attributes
content.video_url.**url ** `string` %%require%%

* URL: The public URL of the video. Only video URLs are supported. 
* Asset ID: The URI of the digital character used for video generation. It follows the format `asset://<ASSET_ID>` and can be obtained from the [digital characters library](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?modelId=seedance-2-0-260128&tab=GenVideo).

:::tip Video input requirements

* Video format: mp4, mov. Supported encoding formats are listed in the table below.
* Resolution: 480p, 720p, 1080p
* Duration: Each video must be between [2, 15] seconds. Up to 3 reference videos can be submitted, and the total duration of all videos must not exceed 15 seconds.
* Dimensions:
   * Aspect ratio (width/height): [0.4, 2.5]
   * Width and height (px): [300, 6000]
   * Total pixel count: [640×640=409600, 2206×946=2086876], that is, the product of width and height must fall within the range [409600, 2086876].
* Size: Each video must not exceed 50 MB.
* Frame rate (FPS): [24, 60]

:::
&nbsp;

|Container Format |Common Extension Name |**MIME** |Supported Encodings |
|---|---|---|---|
|MP4 |.mp4 |video/mp4 |Video: H.264/AVC, H.265/HEVC|\
| | | |Audio: AAC, MP3 |
|QuickTime |.mov |video/quicktime |Video: H.264/AVC, H.265/HEVC|\
| | | |Audio: AAC, MP3 |




---


content.**role ** `string` `conditionally required`
Position or purpose of the video. Currently only supports `reference_video`.


---


**Audio ** **==^new ^== ** `object`
Audio provided to the model. Only seedance 2.0 & 2.0 fast supports audio input. 
**Note**: **Audio cannot be input alone**; at least one reference video or image must be included.

Attributes
content.**type ** `string` %%require%%
Type of the input; in this case, set to `audio_url`. Supports audio URL or audio Base64 encoded string.

---


content.**audio_url ** `object` %%require%%
Audio object provided to the model.

Attributes
content.audio_url.**url ** `string`%%require%%
URL, Base64\-encoded string or asset ID of the audio.

* Audio URL: The public accessible URL of the audio.
* Base64 encoding: Convert the local file to a Base64 encoded string, then submit it to the model. Follow the format: `data:audio/<audio format>;base64,<Base64 encoding>`.
   `<audio format>` must be lowercase, for example, `data:audio/wav;base64,{base64_audio}`.
* Asset ID: The URI of the digital character used for video generation. It follows the format `asset://<ASSET_ID>` and can be obtained from the [digital character library](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?modelId=seedance-2-0-260128&tab=GenVideo).

:::tip Audio input requirements

* Format: wav, mp3
* Duration: The length of a single audio [2, 15] (second); up to three reference audio segments can be provided, and the total duration of all audio must not exceed 15 s.
* Size: 
   * Each audio file must not exceed 15 MB.
   * The request body size must not exceed 64 MB. 
   * Do not use Base64 encoding for large files.



:::

---


content.**role ** `string` `conditionally required`
Position or purpose of the audio. Currently only supports reference_audio: reference audio.



---


**Sample** `object`
Generate an official video based on the sample task ID. This feature is only supported by s**eedance 1.5 pro**. To learn more about how to use the draft feature and review important notes, see [Draft mode](https://docs.byteplus.com/en/docs/ModelArk/2298881#5acd28c8).

Attributes
content.**type ** `string` %%require%%
The type of the input content; fixed to `draft_task`.

---


content.**draft_task** ** ** `object` %%require%%
The sample video task provided to the model.

Attributes
content.draft_task.**id ** `string` %%require%%
Sample Task ID. The platform will automatically reuse the user inputs applied by the draft video (including **model**, content.**text**, content.**image_url**, **generate_audio**, **seed**, **ratio**, **duration**, **frames**, **camera_fixed**) to generate the official video. 
For other parameters, you can specify custom values; if not specified, the default values of the current model will be applied.
The workflow consists of two steps:
**Step 1**: Call this API to generate a draft video.
**Step 2**: If the draft video meets your expectations, call this API again with the draft video task ID returned in Step 1 to generate the final video. See [Draft mode](https://docs.byteplus.com/en/docs/ModelArk/2298881#5acd28c8) for detailed tutorials.





---


**callback_url** `string`
Please fill in the callback notification address for the result of this generation task. When there is a status change in the video generation task, Ark will send a callback request containing the latest task status to this address.
The content structure of the callback request is consistent with the response body of [Querying the information about a video generation task](https://docs.byteplus.com/en/docs/ModelArk/Querying_the_information_about_a_video_generation_task).
The status returned by the callback includes the following states:

* queued: In the queue.
* running: The task is running.
* succeeded: The task is successful. (If the sending fails, that is, the information of successful sending is not received within 5 seconds, the callback will be made three times)
* failed: The task fails. (If the sending fails, that is, the information of successful sending is not received within 5 seconds, the callback will be made three times)
* expired: The task has timed out. This occurs when the task has remained in the `running` or `queued` status for longer than the allowed expiration duration. The expiration duration can be set via the **execution_expires_after** field.


---


**return_last_frame** `Boolean` `Default value: false`

* **true**: Returns the last frame image of the generated video. After setting this parameter to `true`, you can obtain the last frame image by calling the [Querying the information about a video generation task](https://docs.byteplus.com/en/docs/ModelArk/Querying_the_information_about_a_video_generation_task). The last frame image is in PNG format, with its pixel width and height consistent with those of the generated video, and it contains no watermarks. 
   Using this parameter allows the generation of multiple consecutive videos: the last frame of the previously generated video is used as the first frame of the next video task, enabling quick generation of multiple consecutive videos. For specific calling examples, please refer to [Generate multiple consecutive videos](https://docs.byteplus.com/en/docs/ModelArk/2298881#141cf7fa).
* **false**: Does not return the last frame image of the generated video.


---


**service_tier** `string` `Default value: default`
> Modification to the service tier of submitted tasks is not supported.
> Seedance 2.0 & 2.0 fast does not support offline inference.

Specifies the service tier for processing the current request.

* **default**: Online inference mode. This tier has lower RPM and concurrency quotas (see [Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)), suitable for latency\-sensitive inference scenarios.
* **flex**: Offline inference mode. This tier provides a higher TPD quota (see [Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)) at 50% of the price of the online inference tier, suitable for scenarios where low inference latency is not a critical requirement.


---


**execution_expires_after ** `integer` `Default value: 172800`
The task expiration threshold. Specifies the time (in seconds) after which a submitted task will expire, calculated from its **created_at** timestamp.

* **Default:**  172800 seconds (48 hours)
* **Valid Range:**  [3600, 259200]

Regardless of the chosen **service_tier**, it is recommended to set an appropriate value based on your business scenario. Tasks exceeding the threshold will be automatically terminated and marked as `expired`.

---


**generate_audio ** `boolean` `Default: true`
> Only supported by seedance 2.0 & 2.0 fast, and seedance 1.5 pro

Whether the generated video includes audio synchronized with the visuals.

* `true`: The model outputs a video with synchronized audio. 
   Seedance 1.5 pro can automatically generate matching voice, sound effects, or background music based on the prompt and visual content. It is recommended to enclose dialogue in double quotes. Example: *A man stops a woman and says, "Remember, never point your finger at the moon."* 
* `false`: The model outputs a silent video.


---


**draft ** `boolean` `Default: false`
> Only supported by seedance 1.5 pro

Whether to enable the d**raft mode**. See [Draft mode](https://docs.byteplus.com/en/docs/ModelArk/2298881#5acd28c8) for tutorials and important notes.

* `true`: Enable the sample mode to generate a preview video. This allows you to quickly verify if the scene structure, shot scheduling, subject movements, and the alignment with the prompt intent meet expectations. It consumes fewer tokens than a standard video, resulting in lower usage costs.
* `false`: Disable the draft mode to directly generate a standard video.

:::tip tip
When **draft mode** is enabled, the system will generate a draft video of 480p resolution (an error will be thrown if other resolutions are used). This mode does not support returning the last frame or offline inference.

:::
---


**safety_identifier ** **==^new^==** `string`
A unique identifier for an end user. The platform uses it to help detect users in your application who may violate BytePlus Engine ModelArk usage policies. The identifier must be an ASCII string that is stable and unique per user, with a maximum length of 64 characters.
We recommend sending a string generated by hashing the user’s name, user ID, or email address to avoid exposing personal information.

---


:::warning Upgrade Instructions for Partial Parameters
For the **resolution**, **ratio**, **duration**, **frames**, **seed**, **camera_fixed** and **watermark** parameters, ModelArk has introduced an updated method for passing parameters, as demonstrated below. All models still support the legacy method for backward compatibility.
Different models may support different parameters and value ranges. For details, please refer to [Set output video specifications](https://docs.byteplus.com/en/docs/ModelArk/2298881#9fe4cce0). If the input parameters or values are not compatible with the selected model, the relevant content will be ignored or an error will be thrown.

* **New method: Pass the paramters directly** **in the request body.**  This method uses strict validation—if a parameter is incorrect, the model will return an error prompt. 
* **Legacy method: Append \-\-[parameter] after the text prompt. ** This method uses lenient validation—if a parameter is incorrect, the relevant content will be ignored or an error will be thrown.


:::
**New method (Recommended): Pass the paramters directly** **in the request body**
```JSON
... 
   // Specify the aspect ratio of the generated video to 16:9, duration to 5 seconds, resolution to 720p, seed to 11, and include a watermark. The camera is not fixed. 
    "model": "dreamina-seedance-2-0-260128", 
    "content": [ 
        { 
            "type": "text", 
            "text": "The kitten is yawning at the camera" 
        } 
    ], 
    // All parameters must be written in full; abbreviations are not supported 
    "resolution": "720p", 
    "ratio":"16:9", 
    "duration": 5, 
    // "frames": 29, Either duration or frames is required 
    "seed": 11, 
    "camera_fixed": false, 
    "watermark": true 
... 
```




**Legacy method: Append \-\-[parameter] after the text prompt**
```JSON
... 
   // Specify the aspect ratio of the generated video to 16:9, duration to 5 seconds, resolution to 720p, seed to 11, and include a watermark. The camera is not fixed. 
    "model": "dreamina-seedance-2-0-260128", 
    "content": [ 
        { 
            "type": "text", 
            "text": "The kitten is yawning at the camera --rs 720p --rt 16:9 --dur 5 --seed 11 --cf false --wm true"
            // "text": "The kitten is yawning at the camera --resolution 720p --ratio 16:9 --duration 5 --seed 11 --camerafixed false --watermark true"
        } 
    ]
... 
```




---


**resolution** `string` 
> Default value for seedance 2.0 & 2.0 fast, seedance 1.5 pro, seedance 1.0 lite: `720p`
> Default value for seedance 1.0 pro & pro\-fast: `1080p`

The resolution of the output video. Valid values:

* 480p
* 720p
* 1080p: seedance 1.0 lite's reference image\-based generation is not supported; seedance 2.0 fast is not supported.


---


**ratio ** `string` 
> Default value for seedance 2.0 & 2.0 fast and seedance 1.5 pro: `adaptive`
> Default value for seedance 1.0 lite reference image\-based generation: `16:9`
> Default value for other models: `16:9` (text\-to\-video) ; `adaptive`: (image\-to\-video)

The aspect ratio of the output video. Valid values:

* 16:9
* 4:3
* 1:1
* 3:4
* 9:16
* 21:9
* adaptive: Automatically selects the most suitable aspect ratio based on the input (see details below).

:::warning Notes on the adaptive option
When **ratio** is configured as `adaptive`, the model will automatically adapt the aspect ratio according to the generated scene. The actual aspect ratio of the generated video can be obtained from the **ratio** field of [Retrieve a video generation task API](https://docs.byteplus.com/en/docs/ModelArk/1521309).
**Supported models:** 

* Seedance 2.0 & 2.0 fast and seedance 1.5 pro are supported.
* Other models only support the image\-to\-video scenarios. Note that seedance 1.0 lite reference image\-based generation is not supported.

**Value selection rules:** 

* **Text\-to\-video**: The system automatically selects the most suitable aspect ratio based on the prompt.
* **First\-frame / First\-and\-last\-frame video generation**: The system automatically selects the closest aspect ratio based on the uploaded first\-frame image.
* **Multimodal reference\-to\-video**: The system determines the aspect ratio based on the user's prompt intent.
   * If the intent is **first\-frame generation**, **video editing**, or **video extension**, the system uses the referenced image/video to select the closest aspect ratio.
   * Otherwise, the system uses the **first media file** provided (priority: **video \> image**) to select the closest aspect ratio.


:::
Corresponding Width and Height Pixel Values for Different Aspect Ratios
Note: When generating a video from an image, if the selected aspect ratio is inconsistent with that of the uploaded image, Ark will crop your image. The cropping will be centered. For detailed rules, please refer to the [Image cropping rules](https://docs.byteplus.com/en/docs/ModelArk/2298881#f76aafc8).

|Resolution |Aspect Ratio|Pixel Dimensions|Pixel Dimensions|\
| | |Seedance 1.0 series |Seedance 1.5 pro|\
| | | |Seedance 2.0 & 2.0 fast |
|---|---|---|---|
|480p |16:9 |864×480 |864×496 |
|^^|4:3 |736×544 |752×560 |
|^^|1:1 |640×640 |640×640 |
|^^|3:4 |544×736 |560×752 |
|^^|9:16 |480×864 |496×864 |
|^^|21:9 |960×416 |992×432 |
|720p |16:9 |1248×704 |1280×720 |
|^^|4:3 |1120×832 |1112×834 |
|^^|1:1 |960×960 |960×960 |
|^^|3:4 |832×1120 |834×1112 |
|^^|9:16 |704×1248 |720×1280 |
|^^|21:9 |1504×640 |1470×630 |
|1080p |16:9 |1920×1088 |1920×1080 |\
|> Seedance 1.0 lite reference image\-based generation is not supported;| | | |\
|> seedance 2.0 fast is not supported. | | | |
|^^|4:3 |1664×1248 |1664×1248 |
|^^|1:1 |1440×1440 |1440×1440 |
|^^|3:4 |1248×1664 |1248×1664 |
|^^|9:16 |1088×1920 |1080×1920 |
|^^|21:9 |2176×928 |2206×946 |




---


**duration** `integer` `Default value: 5` 
> Either duration or frames can be specified; frames take precedence over duration. To generate a video with an integer number of seconds, it is recommended to specify **duration**.

Video duration generation only supports integers (second).

* Seedance 1.0 pro, seedance 1.0 pro fast, seedance 1.0 lite: [2, 12] s.
* Seedance 1.5 pro: [4,12] or set to `-1`
* Seedance 2.0 & 2.0 fast: [4,15] or set to `-1`

:::warning Warning
Seedance 2.0 and seedance 1.5 pro support the following two configuration methods:

   * Specify a specific duration: Any integer within the valid range is supported.
   * Smart specification: Set to `-1`, which means the model will autonomously select an appropriate video length (integer seconds) within the valid range. The actual generated video duration can be obtained through the [Query Video Generation Task API](https://docs.byteplus.com/en/docs/ModelArk/1521309) returned **duration** field. 
**Note**: Duration affects the cost of the video generation task. Please set it with caution.


:::
---


**frames** `Integer` 
> Seedance 2.0 & 2.0 fast, seedance 1.5 pro are not supported for now.
> Either duration or frames can be specified; frames take precedence over duration. To generate a video with fractional seconds, it is recommended to specify frames.

Number of frames for the output video. By specifying the number of frames, you can flexibly control the length of the generated video, including videos with fractional second durations. Due to the value constraints of frames, only a limited number of fractional second durations are supported. You need to calculate the closest number of frames using the formula. 

* Calculation formula: **Number of Frames = Duration × Frame Rate (24)** .
* Value range: Supports all integer values within the range [29, 289] that conform to the format **25 + 4n**, where **n** is a positive integer.

For example: If you want to generate a 2.4\-second video, the number of frames would be 2.4 × 24 = 57.6. Since 57.6 is not a valid value for frames, you must select the closest valid value. Calculated using the formula 25 + 4n, the closest valid number of frames is 57, and the actual duration of the generated video will be 57 / 24 = 2.375 seconds.

---


**seed** `integer` `Default value: -1` 
The seed, which is an integer that controls the randomness of the output content. Valid values: integers within the range of [\-1, 2^32\-1].
:::warning warning

* If the seed parameter is not specified or is set to \-1, a random number is used.
* Changing the seed value is a way to obtain different outputs for the same request. Using the same seed value for the same request generates similar but not necessarily identical outputs.


:::
---


**camera_fixed** `boolean` `Default value: false` 
> Reference image\-based generation is not supported.
> Seedance 2.0 & 2.0 fast are currently not supported.

Specifies whether to fix the camera. Valid values:

* `true`: fixes the camera. The platform appends an instruction to fix the camera to your prompt, but does not guarantee the actual effect.
* `false`: does not fix the camera.


---


**watermark** `boolean` `Default value: false` 
Specifies whether to add watermarks to the output video. Valid values:

* `false`: does not add watermarks.
* `true`: adds watermarks.


---


<span id="Ag40Ad3H"></span>
## Response parameters

---


**id ** `string`
The ID of the video generation task. Only retained for 7 days (calculated from the created at timestamp) and will be automatically deleted upon expiration.
Setting `"draft": true` will generate a task ID for a draft video.
Setting `"draft": false` will generate a task ID for a standard video.
Creating a video generation task is an asynchronous interface. After obtaining the ID, you need to query the status of the video generation task through [Querying the information about a video generation task](https://docs.byteplus.com/en/docs/ModelArk/Querying_the_information_about_a_video_generation_task). When the task is successful, the `video_url` of the generated video will be output.


---


## Retrieve a video generation task

`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}` [Try](https://api.byteplus.com/api-explorer/?action=GetContentsGenerationsTask&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01)
Retrieves the information of a video generation task.

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Try" key="fq9yXaKY"><RenderMd content={`<APILink link="https://api.byteplus.com/api-explorer/?action=GetContentsGenerationsTask&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01" description="API Explorer 您可以通过 API Explorer 在线发起调用，无需关注签名生成过程，快速获取调用结果。"></APILink>
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="3vCxpwty"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the[ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Quick Start" key="AmT6L8NRfI"><RenderMd content={` <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_b9c82890e851fc10cc31f48f9065abc6.png =20x) </span>[Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_2abecd05ca2779567c6d32f0ddc7874d.png =20x) </span>[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1544106#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Tutorial](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="RxN8G2nH"></span>
## Request parameters
> See [Response parameters](#7mi8G8RI)


---


<span id="aN7zwSry"></span>
### Path parameters
**id** `string` %%require%%
The ID of the video generation task to query.

---


<span id="7mi8G8RI"></span>
## 
<span id="7mi8G8RI"></span>
## Response parameters
> See [Request parameters](#RxN8G2nH)


---


**id ** `string`
The ID of the video generation task.

---


**model** `string`
The name and version of the model used by the task (`Model name-Version`)

---


**status** `string`
The status of the task. Valid values:

* `queued`
* `running`
* `cancelled` (Only tasks in the queued state can be canceled)
* `succeeded`
* `failed`
* `expired`


---



* **error** `object / null`

The error information. If the task succeeds, `null` is returned. If the task fails, the error information is returned. For more information, refer to [Error codes](https://docs.byteplus.com/en/docs/ModelArk/1299023).

Attributes

---


error.**code** `string`
The error code.

---


error.**message** `string`
The error message.


---


**created_at** `integer`
The time when the task was created. The value is a Unix timestamp in seconds.

---


**updated_at** `integer`
The time when the task was last updated. The value is a Unix timestamp in seconds.

---


**content** `object`
The output after the video generation task is completed.

Attributes

---


content.**video_url** `string`
The URL of the output video. For security purposes, the output video is deleted after 24 hours. Be sure to save it in time.

---


content.**last_frame_url ** `string`
URL of the last frame of the generated video. Valid for 24 hours. Be sure to save it in time.
Note: If you set `"return_last_frame": true` in the [creating a video generation task](https://docs.byteplus.com/en/docs/ModelArk/1520757) request, the parameter will be returned.


---


**seed** `integer`
The seed value (integer) used for this request.

---


**resolution **  `string` 
The resolution of the generated video.

---


**ratio ** `string`
The width\-to\-height ratio of the generated video.

---


**duration** `integer` 
The length of the generated video in seconds.
**Note: ** Only one of the **duration** and **frames** parameters is returned. If **frames** is not specified in the creating video generation request, **duration** will be returned.

---


**frames** `integer`  
Number of frames for the generated video.
**Note: ** Only one of the **duration** and **frames** parameters will be returned. If **frames** is specified in the creating video generation request, **frames** will be returned.

---


**framespersecond**  `integer` 
The frame rate of the generated video.

---


**generate_audio** `boolean`
Whether the generated video includes audio synchronized with the visuals. This parameter is only supported by seedance 2.0 & 2.0 fast, and seedance 1.5 pro.

* **true**: The model outputs a video with synchronized audio.
* **false**: The model outputs a silent video.


---


items.**safety_identifier==^new^==** `string`
A unique identifier for the end user. If you set this parameter when [creating a video generation task](https://docs.byteplus.com/en/docs/ModelArk/1520757), the API returns it unchanged.

---


**draft** `boolean`
Whether the generated video is a draft video. This parameter is only returned by seedance 1.5 pro.

* **true**: The current output is a draft video.
* **false**: The current output is a standard video.


---


**draft_task_id ** `string`
Draft video task ID. This parameter will be returned when generating an official video based on a draft video.

---


**service_tier ** `string`
The service tier actually used to process the task.

---


**execution_expires_after ** `integer`
The expiration threshold for the task, in seconds.

---


**usage** `object`
The token usage for the request.

Attributes

---


usage.**completion_tokens** `integer`
The number of tokens consumed for the video output by the model.

---


usage.**total_tokens** `integer`
Total tokens for this request. For video models, input tokens are always 0, therefore **total_tokens = completion_tokens**.


---


## List video generation tasks


`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks?page_num={page_num}&page_size={page_size}&filter.status={filter.status}&filter.task_ids={filter.task_ids}&filter.model={filter.model}`  [Try](https://api.byteplus.com/api-explorer/?action=ListContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01)
You can specify the filter parameters to retrieve a list of tasks. 
:::tip Instructions
Only the historical data from the past **7 days** can be queried. Time calculation is based on UTC timestamps. The 7\-day range is determined using the exact moment (to the second) when the batch query request is made, with the time window defined as  **[T − 7 days, T)** .

:::
```mixin-react
return (<Tabs>
<Tabs.TabPane title="Quick start" key="opV4RT2k"><RenderMd content={` <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_b9c82890e851fc10cc31f48f9065abc6.png =20x) </span>[Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_2abecd05ca2779567c6d32f0ddc7874d.png =20x) </span>[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1544106#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Tutorial](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="CPeW5vNl"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the[ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="RxN8G2nH"></span>
## Request parameters
> See [Response parameters](#7mi8G8RI)

&nbsp;
<span id="wRGjj9E7"></span>
### Query parameters

---


**page_num** `integer / null` 
The page number of the returned results.

* Valid values: [1, 500]


---


**page_size ** `integer / null`
The number of entries per page.

* Valid values: [1, 500]


---


**filter.status ** `string / null`
The status of the task. Valid values:

* `queued`
* `running`
* `cancelled` (Only tasks in the queued state can be canceled)
* `succeeded`
* `failed`


---


**filter.task_ids ** `string[] / null`
Search for specific video generation tasks using the task ID. Multiple IDs can be passed, separated with `&`.
Example: `filter.task_ids=id1&filter.task_ids=id2`.

---


**filter.model ** `string / null`
The ID of the used inference endpoint for the exact search, which differs from the model parameter in the response.

---


**filter.service_tier==^new^==** ** ** `string / null` `Default value: default`
The service tier to process tasks.

* `default`: Online inference mode.
* `flex`: Offline inference mode.

<span id="7mi8G8RI"></span>
## Response parameters
> See [Request parameters](#RxN8G2nH)


---


**items ** `object[]`
The retrieved video generation tasks.

Attributes

---


items.**id ** `string`
The ID of the video generation task.

---


items.**model** `string`
The name and version of the model used by the task (`Model name-Version`).

---


items.**status** `string`
The state of the task. Valid values:

* `queued`
* `running`
* `cancelled` (The task has been canceled. Only tasks in the queued state can be canceled.)
* `succeeded`
* `failed`
* `expired`


---


items.**error** `object / null`
The error information. If the task succeeds, `null` is returned. If the task fails, the error information is returned. For more information, refer to [Error codes](https://docs.byteplus.com/en/docs/ModelArk/1299023).

Attributes

---


error.**code** `string`
The error code.

---


error.**message** `string`
The error message.


---


items.**created_at** `integer`
The time when the task was created. The value is a UNIX timestamp in seconds.

---


items.**updated_at** `integer`
The time when the task was last updated. The value is a UNIX timestamp in seconds.

---


items.**content** `object`
The output of the video generation task. It contains the download URL of the output video.

Attributes

---


content.**video_url** `string`
The URL of the output video. For security purposes, the output video is cleared after 24 hours. Save it in time.

---


content.**last_frame_url ** `string`
URL of the Video's last frame. Valid for 24 hours. Be sure to save it in time.
Note: When setting `"return_last_frame": true` in the [creating a video generation task](https://docs.byteplus.com/en/docs/ModelArk/1520757) request, the parameter will be returned.


---


items.**seed** `integer`
The integer value used for this generation task.

---


items.**resolution **  `string` 
The resolution of the generated video.

---


items.**ratio ** `string`
The width\-to\-height ratio of the generated video.

---


items.**duration** `integer` 
The length of the generated video in seconds.
**Note: ** Only one of the **duration** and **frames** parameters will be returned. If **frames** is not specified when creating a video generation task, **duration** will be returned.

---


items.**frames** `integer`  
The number of frames of the generated video.
**Note: ** Only one of the **duration** and **frames** parameters will be returned. If **frames** is specified when creating a video generation, **frames** will be returned.

---


items.**framespersecond**  `integer` 
The frame rate of the generated video.

---


items.**generate_audio** `boolean`
Wwhether the generated video includes audio synchronized with the visuals. This parameter is only supported by seedance 2.0 & 2.0 fast, and seedance 1.5 pro.

* `true`: The model outputs a video with synchronized audio.
* `false`: The model outputs a silent video.


---


items.**safety_identifier==^new^==** `string`
A unique identifier for the end user. If you set this parameter when [creating a video generation task](https://docs.byteplus.com/en/docs/ModelArk/1520757), the API returns it unchanged.

---


items.**draft** `boolean`
Whether the generated video is a draft video. This parameter is only returned by seedance 1.5 pro.

* `true`: The current output is a draft video.
* `false`: The current output is a standard video.


---


items.**draft_task_id ** `string`
Draft video task ID. This parameter will be returned when generating an official video based on a draft video.

---


items.**service_tier ** `string`
The actual service tier used to process the task.

---


items.**execution_expires_after ** `integer`
The expiration threshold for the task, in seconds.

---


items.**usage** `object`
The token usage for the request.

Attributes

---


usage.**completion_tokens** `integer`
The number of tokens consumed for the video output by the model.

---


usage.**total_tokens**`integer`
Total tokens for this request. For video models, input tokens are always 0, therefore **total_tokens = completion_tokens**.



---


**total ** `integer`
The number of tasks that match the filter conditions.


---


## Cancel or delete a video generation task


`DELETE https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`  [Try](https://api.byteplus.com/api-explorer/?action=DeleteContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01)  
Cancels a queued video generation task, or deletes a video generation task record.

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Try" key="vI631gwS"><RenderMd content={`<APILink link="https://api.byteplus.com/api-explorer/?action=DeleteContentsGenerationsTasks&groupName=Video%20Generation%20API&serviceCode=ark&version=2024-01-01" description="API Explorer 您可以通过 API Explorer 在线发起调用，无需关注签名生成过程，快速获取调用结果。"></APILink>
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="L8aMwmZD"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Quick start" key="e1XZwU7pkX"><RenderMd content={` [ ](#)[Experience Center](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[ ](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Call Guide](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="RxN8G2nH"></span>
## Request parameters
> See [Response parameters](#7mi8G8RI)

&nbsp;
<span id="k1empPqb"></span>
### Path parameters
**id** `string` `required`
The ID of the video generation task to be canceled or deleted.
The operation performed by the `DELETE` API varies depending on the status of the video generation task:

|**Task Status** |**Can it be deleted?**  |**Operation Description** |**Post\-DELETE Task Status** |
|---|---|---|---|
|queued  |Yes |The task is removed from the queue and its status is updated to 'cancelled'. |cancelled  |
|running  |No |\- |\- |
|succeeded  |Yes |The video generation task record is deleted and will no longer be queryable. |\- |
|failed  |Yes |The video generation task record is deleted and will no longer be queryable. |\- |
|cancelled  |No |\- |\- |
|expired |Yes |The video generation task record is deleted and will no longer be queryable. |\- |


---


&nbsp;
<span id="7mi8G8RI"></span>
## Response parameters
> See [Request parameters](#RxN8G2nH)

This API operation has no response parameters.

