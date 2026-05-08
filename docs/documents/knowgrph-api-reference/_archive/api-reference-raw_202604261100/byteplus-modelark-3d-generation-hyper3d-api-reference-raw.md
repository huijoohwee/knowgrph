# BytePlus Modelark 3D Generation Hyper3D API Reference


## Create a 3D generation task


`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`
Create a Hyper3D generation task. The model will generate 3D content based on the input image information. Upon completion, you can query the task by conditions and retrieve the generated 3D model.
:::tip tip
This API charges for output tokens at 0.0133 USD/1K Tokens. Each generated 3D model consumes a fixed 30,000 tokens, equivalent to $0.399 per model. See [Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation) for details.

:::
**Model capabilities**
**Hyper3d\-Gen2**

* **Text\-to\-3D**: Generates a 3D model file based on your input text prompt +  parameters (optional).
* **Image\-to\-3D**: Generates a 3D model file based on your input images (1–5 images) + text prompt (optional) + parameters (optional).


**Supported Countries & Regions**
Australia (AU), Cambodia (KH), Cayman Islands (KY), Egypt (EG), Fiji (FJ), Ghana (GH), Hong Kong, China (HK), India (IN), Indonesia (ID), Japan (JP), Kuwait (KW), Laos (LA), Macao, China (MO), Malaysia (MY), Morocco (MA), New Zealand (NZ), Pakistan (PK), Philippines (PH), Qatar (QA), Saudi Arabia (SA), Singapore (SG), Solomon Islands (SB), South Africa (ZA), South Korea (KR), Tanzania (TZ), Thailand (TH), Turkey (TR), Taiwan, China (TW), Vietnam (VN), Zambia (ZM)


---



```mixin-react
return (<Tabs>
<Tabs.TabPane title="Quick start" key="N9ds2kab"><RenderMd content={` [ ](#)[Model Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[ ](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Call Guide](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="Ogw4DdNQ"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="IzMcuGUn"></span>
## Request parameters
> See [Response parameters](#EAVvaaIM)


---


<span id="FV0ncO26"></span>
### Request body
&nbsp;
**model** `string` %%require%%
The ID of the model to call. [Activate a model service](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision) and [query the model ID](https://docs.byteplus.com/en/docs/ModelArk/1330310).
You can choose to use an inference endpoint ID to call a model. Inference endpoints provide an easy way to query rate limits, billing method (prepaid or postpaid), and service status. Advanced capabilities such as monitoring and security are provided. For more information, see [Obtaining an endpoint ID](https://docs.byteplus.com/en/docs/ModelArk/1099522).

---


**content** `object[]` %%require%%
The references provided to the model for 3D generation, supporting text and image input. The following combinations are supported:
**Text to 3D：** 

* Text 
* Text + Parameter (optional)

**Image to 3D：** 

* Image
* Image + Text (optional)
* Image + Parameter (optional)
* Image + Text (optional) + Parameter (optional)


**Information type**

---


**Image** `object` 
Information of the image provided to the model to generate a 3D content.

Attributes

---


content.**type ** `string` %%require%%
The type of the input content. In this case, set the value to `image_url`. 
Supports image URL or image Base64 encoding.

---


content.**image_url ** `object` %%require%%
The input image object.

Attributes

---


content.image_url.**url ** `string` %%require%%
Accepts image URL, Base64\-encoded image.

* URL: Enter the public accessible URL of the image.
* Base64 encoding: Convert the local file to a Base64\-encoded string, and then submit to the model. Format: `data:image/<image format>;base64,<Base64 encoding>`.

:::tip Image input requirements

* Format: jpg, jpeg, png
* Total pixels：Single image must be less than 4096×4096 px
* Size: Single image must be less than 30 MB
* Number of images: 1~5

:::


---


**Text**  `object`  
The text provided to the model to generate a 3D.

Attributes

---


content.**type ** `string` %%require%%
The type of the input content. In this case, set the value to `text`.

---


content.**text ** `string` %%require%%
The text provided to the model, which describes the 3D content to be generated. Input should include:

* **Text prompt (required)** : Only English is supported, with a maximum length of 400 characters; long inputs will be truncated.
* **Parameters (optional)** : You can append `--[parameters]` after the text prompt to manage the specifications of the output 3D. For more information, refer to **Text commands for models (optional)** .



---


**seed** `integer` 
An integer that controls the randomness of the output content. Valid values: integers within the range of `[0, 65535]`.
:::warning warning

* You can change the seed value to receive different outputs using the same request.
* Using the same seed value doesn't guarantee identical outputs.


:::
---


**callback_url** `string`
Fills in the callback address to receive the result the generation task. When a status change happens in the 3D generation task, Ark will send a callback request containing the latest task status to this address.
The structure of the callback request is consistent with the response body of [Retrieve a 3D generation task](https://docs.byteplus.com/en/docs/ModelArk/Querying_the_information_about_a_video_generation_task).
The status returned by the callback includes the following states:

* queued: The task is in queue.
* running: The task is running.
* succeeded: The task is successful. (If the sending fails, i.e., the information of successful sending is not received within 5 seconds, the callback will be made three times)
* failed: The task fails. (If the sending fails, i.e., the information of successful sending is not received within 5 seconds, the callback will be made three times)


---


&nbsp;
<span id="UWxn9kGk"></span>
### **Parameters (optional)** 
Manages the output specifications of the 3D model file.

Example
```JSON
"content": [
        {
            "type": "text",
            "text": "Complete full-body quadrupedal mech robot, orange and black armored, rounded head with glowing blue sensors, 4 articulated mechanical legs, hard-surface sci-fi design, high-detail joints, photorealistic 8K, fully assembled, no missing parts. --mesh_mode Raw --hd_texture true --material PBR --addons HighPack --quality_override 1000000 --use_original_alpha false --bbox_condition [100,100,100] --TAPose false"        
        }
    ]
```




---


**material** `string` `default PBR`
Controls the material type of the 3D model. Optional values:

* `PBR`: Physically based rendering material, including base color texture, metallic texture, normal texture, and roughness texture, providing high realism and physical accuracy under dynamic lighting.
* `Shaded`: Stylized material, including base color texture and baked lighting.
* `All`: Generate both PBR and Shaded materials.
* `None`: No texture, i.e., generates a white mesh model.


---


**mesh_mode** `string` `default Quad`
Controls the mesh shape of the generated model. Optional values:

* `Raw`: Generates a triangle mesh model.
* `Quad`: Generates a quad mesh model.


---


**quality_override ** `number`
Customizes the polygon count (number of faces) of the 3D model.

* When **mesh_mode** is `Raw`: range  [500, 1,000,000], default: `500000`
* When **mesh_mode ** is `Quad`: range [1,000, 200,000]，default: `18000`

:::tip tip

* When both **quality_override** and **subdivisionlevel** are provided, **subdivisionlevel** will be ignored.
* It is recommended to specify a face count ≥ 150,000.


:::
---


**addons** `string` 
Enhances the resolution of texture maps. Optional value:

* `HighPack`: Provides 4K resolution texture maps.

:::tip tip
If this parameter is not specified, texture maps will default to 2K resolution.

:::
---


**use_original_alpha** `boolean` `default false`
Controls transparency of the 3D model.

* `true`: The transparent parts of the uploaded image are preserved.
* `false`: The transparent parts are automatically filled, which may lose the original transparency effect.


---


**bbox_condition** `integer[]` 
An array specifying the bounding box dimensions and scaling factor. The array contains three elements: width (x\-axis), height (y\-axis), and length (z\-axis). Example: [100,100,100]
:::tip tip
It is recommended not to specify this parameter unless you have a specific requirement; the model will determine the bounding box automatically.

:::
---


**TAPose** `boolean` `default false`
Controls whether the result is in T/A Pose when generating humanoid models.

* `false`: T/A Pose is not enforced; the model decides the pose.
* `true`: Enforces a standard binding pose, and the model determines whether it is a T\-Pose or A\-Pose.


---


**subdivisionlevel **  `string`  `sl`
Controls the polygon count of the 3D model. Optional values:
When **mesh_mode** is `Raw`, default value is `high`.

* `high`: 500k
* `medium`: 150k
* `low`: 20k

When **mesh_mode** is `Quad`, default value is `medium`.

* `high`: 50k
* `medium`: 18k
* `low`: 8k


---


**fileformat ** `string` `default glb` `ff`
The format of the generated textured 3D model file. Optional values:

* `glb` 
* `obj`
* `usdz`
* `fbx`
* `stl`


---


**hd_texture** `boolean` `default false`
Whether to enable HD texture.

* `true`: HD texture enabled.
* `false`: HD texture disabled.


---


&nbsp;
<span id="EAVvaaIM"></span>
## Response parameters
> See [Request parameters](#IzMcuGUn)

&nbsp;
**id ** `string`
The ID of the 3D generation task. Only retained for 7 days (calculated from the created timestamp) and will be automatically deleted upon expiration.
Creating a 3D generation task is an asynchronous interface. After obtaining the ID, you need to query the status of the 3D generation task through [Retrieve a 3D generation task](https://docs.byteplus.com/en/docs/ModelArk/2310461). When the task is successful, the `file_url` of the generated 3D will be output.

---


## Retrieve a 3D generation task


`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`
Retrieves the information of a 3D generation task.

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Quick start" key="7CzZrYc0"><RenderMd content={` [ ](#)[Model Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[ ](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Call Guide](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="87uQmbWU"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


&nbsp;
<span id="3u5DOVUD"></span>
## Request parameters
> See [Response parameters](#kgxRlOEW)


---


<span id="IkRdkzrU"></span>
### Path parameters
**id** `string` %%require%%
The ID of the 3D generation task to query.
:::tip tip
This parameter is a Path Parameter. You need to replace the `{id}` placeholder in the URL with the ID of the 3D generation task to be queried.

:::
---


&nbsp;
<span id="kgxRlOEW"></span>
## Response parameters
> See [Request parameters](#3u5DOVUD)


---


**id ** `string`
The ID of the 3D generation task.

---


**model** `string`
The name and version of the model used by the task (`Model name-Version`).

---


**status** `string`
The status of the task. Valid values:

* `queued`
* `running`
* `cancelled`  (Only tasks in the queued state can be canceled)
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
The output after the 3D generation task is completed.

Attributes

---


content.**file_url** `string`
The URL of the output 3D. For security purposes, the output 3D is deleted after 24 hours. Be sure to save it in time.


---


**usage** `object`
The token usage for the request.

Attributes

---


usage.**completion_tokens** `integer`
The number of tokens consumed for the 3D output by the model.

---


usage.**total_tokens** `integer`
Total tokens for this request. For 3D models, input tokens are always 0, therefore **total_tokens = completion_tokens**.


## List 3D generation tasks


`GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks?page_num={page_num}&page_size={page_size}&filter.status={filter.status}&filter.task_ids={filter.task_ids}&filter.model={filter.model}`
You can specify the filter parameters to retrieve a list of tasks. 
:::tip Instructions
Only the historical data from the past **7 days** can be queried. Time calculation is based on UTC timestamps. The 7\-day range is determined using the exact moment (to the second) when the batch query request is made, with the time window defined as  **[T − 7 days, T)** .

:::
```mixin-react
return (<Tabs>
<Tabs.TabPane title="Quick start" key="4pNeVPSW"><RenderMd content={` [ ](#)[Model Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[ ](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Call Guide](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="AvKb33Q1"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="Ucm2UtfS"></span>
## Request parameters
> See [Response parameters](#Jw9VfKE0)

:::tip tip
These parameters are Path Parameter. You need to replace the placeholder in the URL with the ID of the 3D generation task to be queried.
:::
<span id="w0rS5IGd"></span>
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


**filter ** `object` 
Filter parameters.

Attributes

---


filter.**status ** `string`
The status of the task. Valid values:

* `queued`
* `running`
* `cancelled` (Only tasks in the queued state can be canceled)
* `succeeded`
* `failed`


---


filter.**task_ids ** `string[]`
Search for specific 3D generation tasks using the task ID. Multiple IDs can be passed, separated with `&`.

Exaple：Query multiple tasks in one request using IDs.
```JSON
curl -X GET https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks?filter.task_ids=id1&filter.task_ids=id2 \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ARK_API_KEY"
```




---


filter.**model ** `string`
The ID of the used inference endpoint for the exact search, which differs from the model parameter in the response.


---


<span id="Jw9VfKE0"></span>
## Response parameters 
> See [Request parameters](#Ucm2UtfS)


---


**items ** `object[]`
The retrieved 3D generation tasks.

Attributes

---


items.**id ** `string`
The ID of the 3D generation task.

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
The output of the 3D generation task. It contains the download URL of the output 3D.

Attributes

---


content.**file_url** `string`
The URL of the output 3D. For security purposes, the output 3D is cleared after 24 hours. Save it in time.


---


items.**usage** `object`
The token usage for the request.

Attributes

---


usage.**completion_tokens** `integer`
The number of tokens consumed for the 3D output by the model.

---


usage.**total_tokens**`integer`
Total tokens for this request. For 3D models, input tokens are always 0, therefore **total_tokens = completion_tokens**.



---


**total ** `integer`
The number of tasks that match the filtering conditions.


---


## Cancel or delete a 3D generation task


`DELETE https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{id}`
Cancels a queued 3D generation task, or deletes a 3D generation task record.

```mixin-react
return (<Tabs>
<Tabs.TabPane title="Quick start" key="OU8JjbdE"><RenderMd content={` [ ](#)[Model Playground](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[ ](https://console.byteplus.com/ark/region:ark+ap-southeast-1/experience/vision?projectName=default)[Model List](https://docs.byteplus.com/en/docs/ModelArk/1330310)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[Model Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320#video-generation)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[API Call Guide](https://docs.byteplus.com/en/docs/ModelArk/1366799)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[API Reference](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[FAQs](https://docs.byteplus.com/en/docs/ModelArk/1359411)<span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[Model Activation](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement?LLM=%7B%7D&tab=ComputerVision)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="Authentication" key="C8t8BIp3"><RenderMd content={`This interface only supports API Key authentication. Obtain a long\\-term API Key on the [ API Key management](https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey?apikey=%7B%7D) page.
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


&nbsp;
<span id="xtyysmMq"></span>
## Request parameters
> See [Response parameters](#TF4YhjV0)

:::tip tip
This parameter is a Path Parameter. You need to directly replace the `{id}` placeholder in the URL with the ID of the 3D generation task to be queried.
:::
<span id="5Ogdz41m"></span>
### Path parameters
**id** `string` %%require%%
The ID of the 3D generation task to be canceled or deleted.
The operation performed by the `DELETE` API varies depending on the status of the 3D generation task:

|**Task Status** |**Can it be deleted?**  |**Description** |**Post\-DELETE Task Status** |
|---|---|---|---|
|queued  |Yes |The task is removed from the queue and its status is updated to 'cancelled'. |cancelled  |
|running  |No |\- |\- |
|succeeded  |Yes |The 3D generation task record is deleted and will no longer be queryable. |\- |
|failed  |Yes |The 3D generation task record is deleted and will no longer be queryable. |\- |
|cancelled  |No |\- |\- |
|expired |Yes |The 3D generation task record is deleted and will no longer be queryable. |\- |


---


&nbsp;
<span id="TF4YhjV0"></span>
## Response parameters
> See [Request parameters](#xtyysmMq)

This API operation has no response parameters.

