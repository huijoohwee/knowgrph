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

## Continuation

See companion: knowgrph-byteplus-openark-video-generation-api-reference-raw.companion.md.
