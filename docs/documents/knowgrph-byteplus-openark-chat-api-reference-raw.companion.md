# knowgrph-byteplus-openark-chat-api-reference-raw - Companion

Continuation from knowgrph-byteplus-openark-chat-api-reference-raw.md.

### Request body

---


**model** `string` %%require%%
The ID of the model that you want to call. You can [activate a model service](https://console.byteplus.com/ark/region:ark+ap-southeast-1/openManagement) and [query the model ID](https://docs.byteplus.com/en/docs/ModelArk/model_id).
You can also use an endpoint ID to call a model, querying its rate limits, billing method (prepaid or postpaid), and runtime status, and using its advanced capabilities such as monitoring and security. For more information, refer to [Get the Endpoint ID](https://docs.byteplus.com/en/docs/ModelArk/1099522).

---


**messages**  `object[]` %%require%%
The list of messages in the chat. Supported message types (such as text, image, and video) vary with models.

Message types

---


System message `object`
Instructions for the models to follow, including the role, the context and more.

Attributes

---


messages.**role** `string` %%require%%
The role that sends the message. Value: `system`.

---


messages.**content** `string/object[]` %%require%%
The message content.

Attributes

---


Plaintext message content `string`
The content of the plaintext message.

---


Multimodal message content `object[]` 

Content modalities

---


Text `object`

Attributes

---


messages.content.**text ** `string` %%require%%
The text message content.

---


messages.content.**type ** `string` %%require%%
The content type. Value: `text`.


---


Image `object`

Attributes

---


messages.content.**image_url ** `object` %%require%%
The image message content.

Attributes

---


messages.content.image_url.**url ** `string` %%require%%
The following inputs are supported. For details, refer to [Image input methods](https://docs.byteplus.com/en/docs/ModelArk/1362931#image-input-methods).

* Image URL
* Base64\-encoded string


---


messages.content.image_url.**detail ** `string` 
The image quality. Valid values:
Valid values: `low`, `high`, `xhigh`.
For image understanding granularity, the default value by model, and the corresponding pixel ranges, see the pixel and token usage notes in [Image understanding](https://docs.byteplus.com/en/docs/ModelArk/1362931).


---


messages.content.**type ** `string` %%require%%
The content type. Value: `image_url`.


---


Video `object`
> Audio comprehension for video content is not supported.


Attributes

---


messages.content.**type** `string` %%require%%
The content type. Value: `video_url`.

---


messages.content.**video_url** `object` %%require%%
The video message content.

Attributes

---


messages.content.video_url.**url** `string` %%require%%
The following inputs are supported. For details, refer to [Video input methods](https://docs.byteplus.com/en/docs/ModelArk/1895586#video-input-methods).

* Video URL
* Base64\-encoded string


---


messages.content.video_url.**fps** `float/null` `default value: 1`
Value range: `[0.2, 5]`
Specifies the number of images to extract from the video per second. For details, refer to [Video understanding](https://docs.byteplus.com/en/docs/ModelArk/1895586).

* A higher value results in a more detailed understanding of frame changes in the video.
* A lower value reduces the perception of frame changes in the video but consumes fewer tokens and operates faster.






---


User message `object` 
Messages sent in the role of users. Supported parameter types vary with models.

Attributes

---


messages **.role ** `string` %%require%%
The role that sends the message. Value: `user`.

---


messages **.content ** `string/object[]` **  ** %%require%%
The message content.

Content types

---


Plaintext message content `string`
Content in plaintext.

---


Multimodal message content `object[]` 
Content in the form of text, images, videos, and so on.

Content modalities

---


Text `object`
The text content in a multimodal message.

Attributes

---


messages.content.**text ** `string` %%require%%
The text content.

---


messages.content.**type ** `string` %%require%%
The content type. Value: `text`.


---


Image `object`

Attributes

---


messages.content.**type ** `string` %%require%%
The content type. Value: `image_url`.

---


messages.content.**image_url ** `object` %%require%%
The image message content.

Attributes

---


messages.content.image_url.**url ** `string` %%require%%
The following inputs are supported. For details, refer to [Image input methods](https://docs.byteplus.com/en/docs/ModelArk/1362931#image-input-methods).

* Image URL
* Base64\-encoded string


---


messages.content.image_url.**detail ** `string/null`
For image understanding detail levels, default values by model, and the corresponding pixel ranges, see [Precision control of image understanding](https://docs.byteplus.com/en/docs/ModelArk/1362931#precision-control-of-image-understanding).

---


messages.content.image_url.**image_pixel_limit ** `object/null` `default: null`
The image pixel limits. An image that falls outside the specified range will be proportionally resized to be within the range.
:::warning warning
The image pixel count must be within  **[196, 36,000,000]** ; otherwise, the request will fail.

:::
* Priority: If you set both **detail** and **image_pixel_limit** parameters, **image_pixel_limit** takes precedence over **detail**.
* If you do not set **min_pixels** or **max_pixels** for this parameter, the **min_pixels** or **max_pixels** value set for the **detail** field will be used.


Attributes

---


messages.content.image_url.image_pixel_limit.**max_pixels ** `integer`
The maximum image pixels. Images with more pixels are proportionally scaled down to stay below the **max_pixels** value.

* For models prior to seed\-1.8: (**min_pixels**, `4014080`];
* For seed\-1.8 and seed\-2.0: (**min_pixels**, `9031680`]

If you do not set it, the **max_pixels** value set for the **detail** parameter will be used.

---


messages.content.image_url.image_pixel_limit.**min_pixels**
The minimum image pixels. Images with fewer pixels are proportionally scaled up to stay above the **min_pixels** value.

* For models prior to seed\-1.8: [`3136`, **max_pixels**)
* For seed\-1.8 and seed\-2.0: [`1764`, **max_pixels**)

If you do not set it, the **min_pixels** value set for the **detail** parameter will be used.


---





---


Video `object`
> Audio comprehension for video content is not supported.


Attributes

---


messages.content.**type** `string` %%require%%
The content type. Value: `video_url`.

---


messages.content.**video_url** `object` %%require%%
The video message content.

Attributes

---


messages.content.video_url.**url** `string` %%require%%
The following inputs are supported. For details, refer to [Video input methods](https://docs.byteplus.com/en/docs/ModelArk/1895586#video-input-methods).

* Video URL
* Base64\-encoded string


---


messages.content.video_url.**fps** `float/null` `default: 1`
Value range: `[0.2, 5]`
Specifies the number of images to extract from the video per second. For details, refer to [Video understanding](https://docs.byteplus.com/en/docs/ModelArk/1895586).

* A higher value results in a more detailed understanding of frame changes in the video.
* A lower value reduces the perception of frame changes in the video but consumes fewer tokens and operates faster.






---


Model message `object`
The messages replied by the model in the chat history. They are typically used during the passing in of multi\-turn chat history and during [response prefilling](https://docs.byteplus.com/en/docs/ModelArk/1359497) to enable the model to continue to respond based on the preset content.

Attributes
:::tip Tip
At least one of messages.**content** ** ** and messages.**tool_calls** is required.

:::
---


messages.**role** `string` %%require%%
The role that sends the message. Value: `assistant`.

---


messages.**content** `string/array`  
The message content.

---


messages.**reasoning_content** `string`
Chain\-of\-thought content in model messages.
> Only seed\-1.8, seed\-2.0 and deepseek\-v3.2 support this parameter.


---


messages.**encrypted_content** `string`
The encrypted and compressed reasoning content. Supported starting from `seed-2-0-pro-260328`.
**Notes**

* When you return **encrypted_content** to the model, it must be valid. If it has been tampered with or cannot be restored, the service returns "Invalid signature".
* **encrypted_content** takes precedence over **reasoning_content**. If you return **encrypted_content**, **reasoning_content** is ignored.


---


messages.**tool_calls** `object[]`
The tool call messages replied by the model in the chat history.

Attributes

---


messages.tool_calls **.function ** `object` %%require%%
The information about the tool function called by the model.

Attributes

---


messages.tool_calls **.** function.**name ** `string` %%require%%
The name of the function called by the model.

---


messages.tool_calls **.** function.**arguments ** `string` %%require%%
The parameters in the JSON format generated by the model to call a function.
:::tip Tip
The models may generate some invalid parameters and construct some parameters that are not defined in the function parameter specifications. Before calling a function, verify whether the generated parameters are valid in your code.

:::

---


messages.tool_calls **.id ** `string` %%require%%
The ID of the called tool, generated by the models.

---


messages.tool_calls **.type ** `string` %%require%%
The type of the tool. Currently, only `function` is supported.



---


Tool message `object`
The messages returned by the tools called in the chat history. Used in function calling.

Attributes

---


messages.**role** `string` %%require%%
The role that sends the message. Value: `tool`.

---


messages.**content** `string/array`  %%require%%
The messages returned by the tools.

---


messages.**tool_call_id ** `string` %%require%%
The ID generated by the model when tool calling is required. The same ID must be included in the response of tool calling to associate the tool structure with the model request, and to avoid confusion among the callings of different tools.



---


**thinking** `object` `default: {"type":"enabled"}`
Enables or disables the deep thinking mode. 
> Different models may or may not support this parameter. The default value also varies with models. For details, refer to [Enable/disable deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1449737#enable-disable-deep-reasoning).


Attributes

---


thinking.**type ** `string`  `required`
Valid values:

* `enabled`: Enable thinking mode. The model will always think before answering.
* `disabled`: Disable thinking mode. The model will answer questions directly without prior thinking.
* `auto`: Automatic mode. The model will decide if thinking is necessary according to the received question. Thinking will be skipped for simple questions.


---


**stream** `boolean/null` `default: false`
Specifies whether to return the response content in streaming mode. Valid values:

* `false`: All content generated by the model is returned at a time.
* `true`: The content generated by the model is returned by block according to the SSE protocol and ends with the message of `data: [DONE]`. If **stream** is set to `true`, you can set the **stream_options** parameter to get token consumption details.


---


**stream_options** `object/null` `default: null`
The options for streaming responses. If **stream** is set to `true`, you can set the **stream_options** parameter.

Attributes

---


stream_options.**include_usage ** `boolean/null` `default: false`
Specifies whether to return token usage for this request before the streaming ends. Valid values:

* `true`: An extra block will be returned before the `data: [DONE]` message. In this block, the **usage** parameter indicates the token usage of the entire request, and the **choices** field is an empty array.
* `false`: No token usage is returned.


---


**max_tokens** `integer/null` `default: 4096`
Value range: Varies with models. For details, refer to [Model list](https://docs.byteplus.com/en/docs/ModelArk/1330310).
The maximum length of the model's response (in tokens).
:::tip Tip

* The model's response does not include chain\-of\-thought content. Model response = Model output \- Model chain\-of\-thought (if any).
* The total length of the output tokens is also limited by the model's context length.


:::
---


**max_completion_tokens** `integer/null`
> For models supporting this parameter and instructions, refer to [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).

Value range: `[0, 65536]`.
Controls the maximum length of the model's output (including both the model's response and its chain\-of\-thought content, measured in tokens).
When this parameter is configured, the model will ignore the default value of **max_tokens** and generate extra\-long content (including the response and the chain\-of\-thought) as needed until reaching the value of **max_completion_tokens**.
This parameter cannot be set alongside **max_tokens**.

---


**service_tier** `string/null` `default: auto`
Specifies whether to use TPM guarantee packages. Valid values:

* `auto`: Always use TPM guarantee packages if any.
   * If the inference endpoint has a TPM guarantee package quota, the TPM guarantee package is used for this request for higher service tier (faster responses and higher availability).
   * Otherwise, the default service tier applies.
* `default`: No TPM guarantee package is used for this request, and the default service tier applies even if the requested inference endpoint has a TPM guarantee package quota.


---


**stop** `string/string[]/null` `default: null`
If the model encounters a string specified by `stop` parameter, it stops content generation. The specified strings are excluded from the output. Up to four strings are supported.
> This parameter is not supported by any of the [deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning) models.

`["Hello", "Weather"]`

---


**reasoning_effort** `string/null` `default: medium`
> For details about models supporting this parameter, instructions and its relation with **thinking.type** parameters, refer to [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1449737).

Valid values:

* `minimal`: Immediate response without reasoning.
* `low`: Faster response with low reasoning effort.
* `medium`: Balanced mode that covers both speed and depth.
* `high`: Deep analysis suitable for handling complex issues.


---


**response_format** `object`  `default: {"type": "text"}` `beta`
The response format.

Formats

---


Text `object`
By default, model responses are in text format.

Attributes

---


response_format.**type** `string` %%require%%
Value: `text`.


---


JSON object `object`
Model response content is organized as a JSON object. 
> See [Supported models](https://docs.byteplus.com/en/docs/ModelArk/1568221#supported-models) for models supporting this parameter.
> Please use caution when using it in the production environment because it is still in Beta phase.


Attributes

---


response_format.**type ** `string` %%require%%
Value: `json_object`.


---


JSON schema `object` 
Model response content is structured as a JSON object, following the defined JSON structure in the **schema** parameter.
> See [Supported models](https://docs.byteplus.com/en/docs/ModelArk/1568221#supported-models) for models supporting this parameter.
> Please use caution when using it in the production environment because it is still in Beta phase.


Attributes

---


response_format.**type ** `string` %%require%%
Value: `json_schema`.

---


response_format.**json_schema** `object` %%require%%
Definition of the JSON schema.

Attributes

---


response_format.json_schema.**name** `string` %%require%%
Name of the user\-defined JSON schema.

---


response_format.json_schema.**description** `string/null` 
Description of the response purpose. The model will determine how to respond in this format based on this description.

---


response_format.json_schema.**schema** `object` %%require%%
JSON format definition of the response format, described as a JSON Schema object.

---


response_format.json_schema.**strict** `boolean/null` `default: false`
Whether to enable strict adherence to the schema when generating output.

* `true`: The model will always strictly follow the format defined in the **schema** parameter.
* `false`: The model will try to follow the structure defined in the **schema** parameter as much as possible.




---


**frequency_penalty** `float/null` `default: 0`
Value range: [`-2.0`, `2.0`].
:::warning Note
`seed-1.8` and `seed-2.0` series models do not support this parameter.
:::
The frequency penalty. If the value is positive, the penalty is applied based on the frequency of the new token, thus reducing the likelihood of repetitions.

---


**presence_penalty** `float/null` `default: 0`
Value range: [`-2.0`, `2.0`].
:::warning Note
`seed-1.8` and `seed-2.0` series models do not support this parameter.
:::
The presence penalty. If the value is positive, the penalty is applied based on the presence of the new token, thus increasing the likelihood that the model talks about new topics.

---


**temperature** `float/null` `default: 1`
Value range: [`0`, `2`].
The sampling temperature, which controls the variability and randomness of generated text. If the value is 0, the model considers only the token with the highest logprob.
A higher value (for example, 0.8) makes the output more random, while a lower value (for example, 0.2) makes the output more deterministic.
We recommend that you adjust either the temperature or the top_p parameter.

---


**top_p** `float/null` `default: 0.7`
Value range: [`0`, `1`].
The nucleus sampling probability threshold. The model considers possibilities that equal or exceed the value of top_p. If the value is 0, the model considers only the token with the highest logprob.
For example, 0.1 indicates that only the top 10% of probable tokens are considered. The larger the value, the greater the randomness. The lower the value, the greater the certainty. We recommend that you adjust either the temperature or top_p parameter.

---


**logprobs** `boolean/null` `default: false`
> Models with deep thinking ability do not support this parameter. For details about deep thinking models, refer to the [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).

Specifies whether to return the logprobs of tokens.

* `false`: No logprob is returned.
* `true`: The logprob for each token in the message is returned.


---


**top_logprobs** `integer/null` `default: 0`
> Models with deep thinking ability do not support this parameter. For details about deep thinking models, refer to the [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).

Value range: [`0`, `20`].
The most likely number of returned tokens at each token position, each with an associated logprob. You can set the **top_logprobs** parameter only when **logprobs** is set to `true`.

---


**logit_bias** `map/null` `default: null`
> Models with deep thinking ability do not support this parameter. For details about deep thinking models, refer to the [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).

The likelihood of specified tokens appearing in a model\-generated output, which makes the content more consistent with specific preferences. **logit_bias** accepts a map where each key is a token ID in the vocabulary obtained through the tokenization API and each value is a bias value in the range of [\-100, 100].
If the value is \-1, the model is less encouraged to use the token. If the value is 1, the model is more encouraged to do so. If the value is \-100, the model must not use the token. If the value is 100, the model can only use the token. The actual effect of this parameter may vary by model.
`{"<Token_ID>": -100}`

---


**tools** `object[]/null` `default: null`
The list of tools that can be called by a model and included in the response. This structure is required for a model to call tools. For models supporting this parameter, refer to [Tool use](https://docs.byteplus.com/en/docs/ModelArk/1330310#tool-use).

Attributes

---


tools.**type ** `string` %%require%%
The type of the tool. Value: `function`.

---


tools.**function ** `object` %%require%%
The list of tools that the model can call.

Attributes

---


tools.function.**name ** `string` %%require%%
The name of the called function.

---


tools.function.**description ** `string` 
The description of the called function. It helps the LLM to determine whether to call the function.

---


tools.function.**parameters ** `object` 
Function request parameters in JSON Schema format. For more information about the format, refer to [JSON Schema](https://json-schema.org/understanding-json-schema). Example:
```JSON
{
  "type": "object",
  "properties": {
    "Parameter Name": {
      "type": "string | number | boolean | object | array",
      "description": "Parameter description"
    }
  },
  "required": ["Required Parameter"]
}
```

Note:

* All parameter names are case\-sensitive.
* **Parameters** must be a valid JSON Schema object.



---


**parallel_tool_calls** `boolean` `default: true`
Specifies whether multiple tools are allowed to be included in the model response.

* `true`: multiple tools are allowed to be included in the model response.
* `false`: the number of tools allowed to be included in the model response is ≤ 1. This option only works for `seed-1.6` and later series models.


---


**tool_choice**  `string/object`
> Only `seed-1.6` and later series models support this parameter.

Specifies whether any tools are allowed to be included in the model response for this request.
When no tools are specified, the default value is `none`; When any tool is specified, the default value is `auto`.

Attributes

---


Choice mode `string`
Specifies whether any tools are allowed to be included in the model response.

* none: No tools can be included in the model response.
* required: Tools must be included in the model response. When choosing this option, make sure suitable tools are in place to reduce hallucination.
* auto: The model determines whether to include tools in the response or not.


---


Tool calls `object`
Specifies the tools to be called by the model. Only the following model information is allowed to be included in the model response. When choosing this option, make sure the tools are suitable for the user requirement to reduce hallucination.

Attributes

---


tool_choice.**type ** `string` %%require%%
The type of the tool. Value: `function`.

---


tool_choice.**function ** `object` %%require%%
The information about the tool.

Attributes

---


tool_choice.function.**name ** `string` %%require%%
The name of the called tool.



<span id="CKb7vjIa"></span>
## Response parameters
> Jump to [Request parameters](#lYMB9msn)

<span id="dSeXigg7"></span>
### Non\-streaming call
> Jump to [Streaming call](#xW8kgzY1)


---


**id** `string`
The unique identifier of the request. 

---


**model** `string`
The name and version of the model used in the request.

---


**service_tier** `string`
Indicates whether TPM guarantee packages are used for the request.

* `scale`: The TPM guarantee package quota is used for the request.
* `default`: No TPM guarantee package quota is used for the request.


---


**created** `integer`
The Unix timestamp in seconds of the creation time of the request.

---


**object** `string`
Value: `chat.completion`.

---


**choices** `object[]`
The model output for the request.

Attributes

---


choices.**index ** `integer`
The index of the element in the **choices** list.

---


choices.**finish_reason ** `string`
The reason why the model stopped generating tokens. Valid values:

* `stop`: Model output ends or is truncated because the string specified in the stop request parameter is detected.
* `length`: Model output is truncated because one of the following limits is reached:
   * The length of the response reaches the limit specified by `max_tokens`.
   * The length of the chain\-of\-thought and the response reaches the limit specified by `max_completion_tokens`.
   * The length of the input, the chain\-of\-thought, and the response reaches the limit specified by `context_window`.
* `content_filter`: Model output is intercepted by content moderation.
* `tool_calls`: A tool is called by the model.


---


choices.**message ** `object`
The content output by the model.

Attributes

---


choices.message.**role ** `string`
The role that outputs the content. Valid value: `assistant`.

---


choices.message.**content ** `string`
The content of the message generated by the model.

---


choices.message.**reasoning_content ** `string/null`
The content of the chain\-of\-thought of the model during problem\-solving.
This parameter is supported by deep thinking models only. For details about deep thinking models, refer to the [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).

---


choices.message.**tool_calls ** `object[]/null`
The tool calls generated by the model.

Attributes

---


choices.message.tool_calls.**id ** `string`
The ID of the called tool.

---


choices.message.tool_calls.**type ** `string`
The type of the tool. Valid value: `function`.

---


choices.message.tool_calls.**function ** `object`
The function called by the model.

Attributes

---


choices.message.tool_calls.function.**name ** `string`
The name of the function called by the model.

---


choices.message.tool_calls.function.**arguments ** `string`
The parameters in the JSON format generated by the model to call a function.
The models may generate some invalid parameters and construct some parameters that are not defined in the function parameter specifications. Before calling a function, verify whether the generated parameters are valid in your code.




---


choices.**logprobs ** `object/null`
The logprob of the current content.

Attributes

---


choices.logprobs.**content ** `object[]/null`
The logprob of the token in each content element in the message list.

Attributes

---


choices.logprobs.content.**token ** `string`
The current token.

---


choices.logprobs.content.**bytes ** `integer[]/null`
The UTF\-8 value of the current token, in the format of a list of integers. It can be used for encoding and decoding characters consisting of multiple tokens, such as emojis or special characters. If the token does not have a UTF\-8 value, the list is empty.

---


choices.logprobs.content.**logprob ** `float`
The logprob of the current token.

---


choices.logprobs.content.**top_logprobs ** `object[]`
The list of most probable tokens in the current position and their logprobs. In some cases, the number returned may be less than the number specified in the top_logprobs request parameter.

**Attributes**

---


choices.logprobs.content.top_logprobs.**token ** `string`
The current token.

---


choices.logprobs.content.top_logprobs.**bytes ** `integer[]/null`
The UTF\-8 value of the current token, in the format of a list of integers. It can be used for encoding and decoding characters consisting of multiple tokens, such as emojis or special characters. If the token does not have a UTF\-8 value, the list is empty.

---


choices.logprobs.content.top_logprobs.**logprob ** `float`
The logprob of the current token.




---


choices.**moderation_hit_type ** `string/null`
If the text output by the model contains sensitive information, a matching risk classification tag is returned for the text.
Return values and their meanings:

* `severe_violation`: The text output by the model involves severe violations.
* `violence`: The text output by the model involves radical behaviors.

Note: Currently, only [visual understanding models](https://docs.byteplus.com/en/docs/ModelArk/1362931) support returning this parameter. To return risk classification tags, you must also set ModerationStrategy to Basic on the [Endpoint settings](https://console.byteplus.com/ark/region:ark+ap-southeast-1/endpoint/create?customModelId=) page of the ModelArk console or in the [CreateEndpoint](https://docs.byteplus.com/en/docs/ModelArk/1262823) API.


---


**usage** `object`
The token usage for the request.

Attributes

---


usage.**total_tokens ** `integer`
The total number of input and output tokens consumed by this request.

---


usage.**prompt_tokens ** `integer`
The number of prompt tokens input.

---


usage.**prompt_tokens_details ** `object`
The details of the number of prompt tokens input.

Attributes

---


usage.prompt_tokens_details.**cached_tokens** `integer`
The number of tokens used by prompt cache. Value: `0`.


---


usage.**completion_tokens ** `integer`
The number of tokens generated by the model.

---


usage.**completion_tokens_details ** `object`
The details of the number of tokens generated by the model.

Attributes

---


usage.completion_tokens_details.**reasoning_tokens ** `integer`
The number of tokens consumed to output the chain\-of\-thought content.
For models supporting the output of chain\-of\-thought content, refer to [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1449737).



---


<span id="xW8kgzY1"></span>
### Streaming call
> Jump to [Non-streaming call](#dSeXigg7)


---


**id** `string`
The unique identifier of the request.

---


**model** `string`
The name and version of the model used in the request.

---


**service_tier** `string`
Indicates whether TPM guarantee packages are used for the request.

* `scale`: The TPM guarantee package quota is used for the request.
* `default`: No TPM guarantee package quota is used for the request.


---


**created** `integer`
The Unix timestamp in seconds of the creation time of the request.

---


**object** `string`
Value: `chat.completion.chunk`.

---


**choices** `object[]`
The model output for the request.

Attributes

---


choices.**index ** `integer`
The index of the element in the **choices** list.

---


choices.**finish_reason ** `string`
The reason why the model stopped generating tokens. Valid values:

* `stop`: Model output ends or is truncated because the string specified in the stop request parameter is detected.
* `length`: Model output is truncated because one of the following limits is reached:
   * The length of the response reaches the limit specified by `max_tokens`.
   * The length of the chain\-of\-thought and the response reaches the limit specified by `max_completion_tokens`.
   * The length of the input, the chain\-of\-thought, and the response reaches the limit specified by `context_window`.
* `content_filter`: Model output is intercepted by content moderation.
* `tool_calls`: A tool is called by the model.


---


choices.**delta ** `object`
The incremental content output by the model.

Attributes

---


choices.delta.**role ** `string`
The role that outputs the content. Value: `assistant`.

---


choices.delta.**content ** `string`
The content of the message generated by the model.

---


choices.delta.**reasoning_content ** `string/null`
Original reasoning content. Starting from `seed-2-0-pro-260328`, this field returns a summary of the reasoning content.
This parameter is supported by deep reasoning models only. For details about deep thinking models, refer to the [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1330310#deep-reasoning).
:::tip tip
For time\-consuming scenarios such as long\-form generation or deep reasoning, we recommend increasing the time to first token (TTFT) and time per output token (TPOT) timeouts as appropriate to prevent the request from being interrupted due to timeouts.

:::
---


choices.delta.**encrypted_content ** `string`
Encrypted and compressed original reasoning content. Supported starting from `seed-2-0-pro-260328`.
:::tip tip
In streaming output mode, after the reasoning content has finished streaming and before the final response content begins, the service outputs a chunk that includes the complete **encrypted_content**. In this chunk, both the **content** and **reasoning_content** fields are empty.

:::
---


&nbsp;
choices.delta.**tool_calls ** `object[]/null`
The tool calls generated by the model.

Attributes

---


choices.delta.tool_calls.**id ** `string`
The ID of the called tool.

---


choices.delta.tool_calls.**type ** `string`
The type of the tool. Value: `function`.

---


choices.delta.tool_calls.**function ** `object`
The function called by the model.

Attributes

---


choices.delta.tool_calls.function.**name ** `string`
The name of the function called by the model.

---


choices.delta.tool_calls.function.**arguments ** `string`
The parameters in the JSON format generated by the model to call a function.
The models may generate some invalid parameters and construct some parameters that are not defined in the function parameter specifications. Before calling a function, verify whether the generated parameters are valid in your code.




---


choices.**logprobs ** `object/null`
The logprob of the current content.

Attributes

---


choices.logprobs.**content ** `object[]/null`
The logprob of the token in each content element in the message list.

Attributes

---


choices.logprobs.content.**token ** `string`
The current token.

---


choices.logprobs.content.**bytes ** `integer[]/null`
The UTF\-8 value of the current token, in the format of a list of integers. It can be used for encoding and decoding characters consisting of multiple tokens, such as emojis or special characters. If the token does not have a UTF\-8 value, the list is empty.

---


choices.logprobs.content.**logprob ** `float`
The logprob of the current token.

---


choices.logprobs.content.**top_logprobs ** `object[]`
The list of most probable tokens in the current position and their logprobs. In some cases, the number returned may be less than the number specified in the top_logprobs request parameter.

Attributes

---


choices.logprobs.content.top_logprobs.**token ** `string`
The current token.

---


choices.logprobs.content.top_logprobs.**bytes ** `integer[]/null`
The UTF\-8 value of the current token, in the format of a list of integers. It can be used for encoding and decoding characters consisting of multiple tokens, such as emojis or special characters. If the token does not have a UTF\-8 value, the list is empty.

---


choices.logprobs.content.top_logprobs.**logprob ** `float`
The logprob of the current token.




---


choices.**moderation_hit_type ** `string/null` 
If the text output by the model contains sensitive information, a matching risk classification tag is returned for the text.
Return values and their meanings:

* `severe_violation`: The text output by the model involves severe violations.
* `violence`: The text output by the model involves radical behaviors.

Note: Currently, only [visual understanding models](https://docs.byteplus.com/en/docs/ModelArk/1330310#visual-understanding) support returning this parameter. To return risk classification tags, you must also set ModerationStrategy to Basic on the [Endpoint settings](https://console.byteplus.com/ark/region:ark+ap-southeast-1/endpoint/create?customModelId=) page of the ModelArk console or in the [CreateEndpoint](https://docs.byteplus.com/en/docs/ModelArk/1262823) API.


---


**usage** `object`
The token usage for the request.
For a streaming call, token usage is not calculated by default, and the return value is `null`.
To calculate token usage, set **stream_options.include_usage** to `true`.

Attributes

---


usage.**total_tokens ** `integer`
The total number of input and output tokens consumed by this request.

---


usage.**prompt_tokens ** `integer`
The number of prompt tokens input.

---


usage.**prompt_tokens_details ** `object`
The details of the number of prompt tokens input.

Attributes

---


usage.prompt_tokens_details.**cached_tokens ** `integer`
The number of tokens used by prompt cache. Value: `0`.


---


usage.**completion_tokens ** `integer`
The number of tokens generated by the model.

---


usage.**completion_tokens_details ** `object`
The details of the number of tokens generated by the model.

Attributes

---


usage.completion_tokens_details.**reasoning_tokens ** `integer`
The number of tokens consumed to output the chain\-of\-thought content.
For models supporting the output of chain\-of\-thought content, refer to [Deep reasoning](https://docs.byteplus.com/en/docs/ModelArk/1449737).


