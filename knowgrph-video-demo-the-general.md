---
title: "Knowgrph · Video Demo — The General's Dream (Variation 1)"
graphId: "md:knowgrph-video-demo-v1"
doc_type: "Video Script — Director Brief"
date: "2026-04-28"
lang: en-US

kgCanvasSurfaceMode: "2d"
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: "flowEditor"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgMultiDimTableModeEnabled: false
kgDocumentStructureBaselineLock: false

$schema: "kgc-pipeline/v1"

inputs:
  byteplus_text_model: "seed-2-0-lite-260228"
  byteplus_image_model: "seedream-4-0-250828"
  byteplus_video_model: "seedance-1-0-pro-fast-251015"
  vibe: "cinematic, photorealistic, chiaroscuro lighting, muted earth tones, 2.39:1 anamorphic"
  duration_seconds: 8
  duration_label: "8s"
  theme: "a terracotta warrior awakens and walks through six epochs of human history, arriving at a glowing creative canvas — the recursive reveal is that he was always being rendered"
  script: |
    A terracotta warrior cracks open. Dust falls from one eye.
    He rises among 8,000 frozen brothers and steps forward.
    He walks through an Age of Discovery ship deck — crew frozen mid-storm.
    He crosses a Wild West standoff — a bullet hangs suspended in air.
    He passes through a World War trench wall of fire, unbothered.
    A Terminator endoskeleton turns, sees him — and kneels.
    He enters a Prometheus alien corridor, touches a monolith, his clay hand dissolves into light.
    The camera pulls back: he is a node on a canvas. A cursor hovers.
    Text fades in: "Six thousand years of stories. One canvas to build them all.
    airvio.co — SeeDance 2.0. Every model. Every era. Yours."
  location:
    name: "multi-epoch: Xi'an underground vault → Atlantic ocean deck → Sonoran desert town → Somme trench → post-apocalyptic ruin → alien monolith corridor → creative canvas"
    short_label: "6-epoch"
    label: "Six-epoch traversal: terracotta vault · Age of Discovery ship · Wild West standoff · WWI trench · Terminator wasteland · Prometheus corridor · canvas reveal"

spec:
  format: kgc-pipeline
  version: "1.0.0"
  parser: yaml-frontmatter
  execution: computing-flow
  topology: DAG
  ssot_surfaces: [widget_bundle, pipeline, flow.nodes, flow.edges, mermaid, runner]

widget_bundle:
  kind: kg:flow:widgetBundle
  version: 1
  registry: []
  graph:
    type: Graph
    context: frontmatter-flow
    metadata: {kind: frontmatter-flow}
    nodes_ref: [w-text-script, p-text-script, w-img-scene, p-img-scene, w-video-scene, p-video-scene]
    edges_ref: [e-text-script, e-text-script-srcdoc, e-scene-image, e-scene-to-video-ref, e-video]
    display:
      direction: LR
      edgeType: bezier
    behavior:
      drag_pan_zoom_owner: flowEditor-frontmatter-only
      rich_media_overlay_handlers: flowEditor-frontmatter-only
      forbid_cross_renderer_proxy: true

canvas:
  auto_layout: true
  layout_algo: dagre-LR
  snap_to_grid: true
  grid_size: 20
  minimap: true
  controls: true
  node_defaults:
    width: 240
    height: 90
  edge_defaults:
    type: smoothstep
    animated: true

runner:
  entry: R01
  exit: R06
  steps:
    - seq: R01
      action: ingest
      input: "raw file bytes"
      output: "parsed YAML object"
      description: "Parse YAML frontmatter; validate $schema == kgc-pipeline/v1; expose __doc."
    - seq: R02
      action: resolve
      input: "__doc"
      output: "__doc_resolved"
      description: "Resolve {{key}} interpolation for body and tables; expose __doc_resolved."
    - seq: R03
      action: build-graph
      input: "__doc_resolved"
      output: "graph { nodes[], edges[] }"
      description: "Cross-validate SSOT: pipeline[*].node == flow.nodes[*].id.value == mermaid IDs; halt on mismatch."
    - seq: R04
      action: compile-compute
      input: "graph"
      output: "graph (compiled)"
      description: "Compile flow.nodes[*].compute.value to functions; mark nodes async if needed."
    - seq: R05
      action: traverse
      input: "graph (compiled)"
      output: "graph (executed)"
      description: "Materialize widget nodes + edges; connected values resolve into Rich Media Panel render drivers; no feedback arcs."
    - seq: R06
      action: render
      input: "graph (executed) + mermaid + body"
      output: "rendered Knowledge Graph Canvas"
      description: "Render Flow Graph + Pipeline table; apply parseSigil() to cells; auto-layout dagre-LR."

pipeline:
  - seq: W01
    node: w-text-script
    label: "script to prompt breakdown"
    actor: ["user", "AI"]
    edge_in: "prompt_in"
    edge_out: "text_out"
    user_action: "Edit the script and run"
    sys_event: "TextGeneration returns prompts for scene image + final video"
    data_in: "properties.prompt"
    data_out: "properties.output + properties.outputSrcDoc"
    trigger: "run"
    on_fail: "output unchanged"
    confidence: high
    status: TBD
  - seq: W02
    node: w-img-scene
    label: "image generation (reference)"
    actor: ["user", "AI"]
    edge_in: "prompt_in"
    edge_out: "imageUrl"
    user_action: "Run the scene reference image widget"
    sys_event: "ImageGeneration writes imageUrl"
    data_in: "properties.prompt + properties.model"
    data_out: "properties.imageUrl"
    trigger: "run"
    on_fail: "imageUrl unchanged"
    confidence: high
    status: TBD
  - seq: W03
    node: w-video-scene
    label: "video generation"
    actor: ["user", "AI"]
    edge_in: "reference_image"
    edge_out: "videoUrl"
    user_action: "Run the video widget after a reference image exists"
    sys_event: "VideoGeneration writes videoUrl"
    data_in: "properties.prompt + properties.model + properties.duration + properties.reference_image"
    data_out: "properties.videoUrl"
    trigger: "run"
    on_fail: "videoUrl unchanged"
    confidence: high
    status: TBD

mermaid: |
  %%{init: {"theme": "base", "themeVariables": {"primaryColor":"#E1F5EE","primaryTextColor":"#085041","primaryBorderColor":"#1D9E75","lineColor":"#5F5E5A","secondaryColor":"#E6F1FB","tertiaryColor":"#FAEEDA"}}}%%
  flowchart LR
    classDef widget fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:1.5px
    classDef panel  fill:#EAF3DE,stroke:#639922,color:#27500A,stroke-width:1.5px

    w-text-script["BytePlus Video Script Widget\nTextGeneration\n{{inputs.byteplus_text_model}}"]
    p-text-script["Rich Media Panel\nText · Script"]
    w-img-scene["Image Widget\nScene Reference\n{{inputs.byteplus_image_model}}"]
    p-img-scene["Rich Media Panel\nImage · Scene"]
    w-video-scene["Video Widget\nVideoGeneration\n{{inputs.byteplus_video_model}}\n{{inputs.duration_label}}"]
    p-video-scene["Rich Media Panel\nVideo · Scene"]

    w-text-script -->|text_out → output| p-text-script
    w-img-scene -->|imageUrl → imageUrl| p-img-scene
    w-img-scene -->|imageUrl → reference_image| w-video-scene
    w-video-scene -->|videoUrl → videoUrl| p-video-scene

    class w-text-script,w-img-scene,w-video-scene widget
    class p-text-script,p-img-scene,p-video-scene panel

flow:
  direction: {key: direction, type: string, value: LR}
  edgeType: {key: edgeType, type: string, value: bezier}
  snapToGrid: {key: snapToGrid, type: boolean, value: true}
  computed: {key: computed, type: boolean, value: true}

  nodes:
    - id: {key: id, type: string, value: "w-text-script"}
      type: {key: type, type: string, value: "TextGeneration"}
      label: {key: label, type: string, value: "BytePlus Video Script Widget"}
      phase: {key: phase, type: string, value: "generate"}
      actor: {key: actor, type: array, value: ["user", "AI"]}
      handles: {key: handles, type: object, value: {target: ["prompt_in"], source: ["text_out", "outputSrcDoc"]}}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "videoScript"}
      chatProvider: {key: chatProvider, type: string, value: "byteplus-modelark"}
      chatAuthMode: {key: chatAuthMode, type: string, value: "serverManaged"}
      chatEndpointUrl: {key: chatEndpointUrl, type: string, value: "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions"}
      chatModel: {key: chatModel, type: select, value: "{{inputs.byteplus_text_model}}"}
      chatThinkingType: {key: chatThinkingType, type: select, value: "disabled"}
      chatReasoningEffort: {key: chatReasoningEffort, type: select, value: "minimal"}
      chatStream: {key: chatStream, type: boolean, value: true}
      prompt: {key: prompt, type: string, value: "Generate prompts for (1) one scene reference image and (2) the final video. Use: vibe={{inputs.vibe}}, duration={{inputs.duration_label}}, location={{inputs.location.name}}, theme={{inputs.theme}}. Script: {{inputs.script}}. Output as markdown with explicit sections: Scene Image Prompt, Video Prompt."}

    - id: {key: id, type: string, value: "p-text-script"}
      type: {key: type, type: string, value: "RichMediaPanel"}
      label: {key: label, type: string, value: "Rich Media Panel — Text (Script)"}
      phase: {key: phase, type: string, value: "render"}
      actor: {key: actor, type: array, value: ["system", "user"]}
      handles: {key: handles, type: object, value: {target: ["output", "outputSrcDoc"], source: ["output", "outputSrcDoc"]}}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "richMediaPanel"}
      output: {key: output, type: string, value: ""}
      outputSrcDoc: {key: outputSrcDoc, type: string, value: ""}
      media_interactive: {key: media_interactive, type: boolean, value: true}

    - id: {key: id, type: string, value: "w-img-scene"}
      type: {key: type, type: string, value: "ImageGeneration"}
      label: {key: label, type: string, value: "Image Widget — Scene Reference"}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "imageGeneration"}
      model: {key: model, type: select, value: "{{inputs.byteplus_image_model}}"}
      prompt: {key: prompt, type: textarea, value: "{{inputs.vibe}}, {{inputs.duration_label}}; {{inputs.location.label}}; {{inputs.theme}}. Script: {{inputs.script}}. Single coherent frame, 16:9."}
      size: {key: size, type: select, value: "2K"}
      output_format: {key: output_format, type: select, value: "jpeg"}
      response_format: {key: response_format, type: select, value: "b64_json"}
      optimize_prompt_options: {key: optimize_prompt_options, type: select, value: "fast"}
      aspect_ratio: {key: aspect_ratio, type: number, value: 0.0625}
      stream: {key: stream, type: boolean, value: true}
      watermark: {key: watermark, type: boolean, value: false}
      seed: {key: seed, type: number, value: 0}
      guidance_scale: {key: guidance_scale, type: number, value: 0}
      reference_image: {key: reference_image, type: string, value: ""}
      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["imageUrl"]}}
      phase: {key: phase, type: string, value: "generate"}
      actor: {key: actor, type: array, value: ["user", "AI"]}

    - id: {key: id, type: string, value: "p-img-scene"}
      type: {key: type, type: string, value: "RichMediaPanel"}
      label: {key: label, type: string, value: "Rich Media Panel — Image (Scene)"}
      phase: {key: phase, type: string, value: "render"}
      actor: {key: actor, type: array, value: ["system", "user"]}
      handles: {key: handles, type: object, value: {target: ["imageUrl", "outputSrcDoc"], source: ["imageUrl", "outputSrcDoc"]}}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "richMediaPanel"}
      imageUrl: {key: imageUrl, type: string, value: ""}
      outputSrcDoc: {key: outputSrcDoc, type: string, value: ""}
      media_interactive: {key: media_interactive, type: boolean, value: true}

    - id: {key: id, type: string, value: "w-video-scene"}
      type: {key: type, type: string, value: "VideoGeneration"}
      label: {key: label, type: string, value: "Video Widget — Scene"}
      phase: {key: phase, type: string, value: "generate"}
      actor: {key: actor, type: array, value: ["user", "AI"]}
      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["videoUrl"]}}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "videoGeneration"}
      model: {key: model, type: select, value: "{{inputs.byteplus_video_model}}"}
      prompt: {key: prompt, type: string, value: "{{inputs.vibe}}, {{inputs.duration_label}}; {{inputs.location.name}}; {{inputs.theme}}. Script: {{inputs.script}}"}
      ratio: {key: ratio, type: select, value: "16:9"}
      resolution: {key: resolution, type: select, value: "480p"}
      duration: {key: duration, type: number, value: "{{inputs.duration_seconds}}"}
      generate_audio: {key: generate_audio, type: boolean, value: false}
      draft: {key: draft, type: boolean, value: true}
      camera_fixed: {key: camera_fixed, type: boolean, value: false}
      image_url_url: {key: image_url_url, type: select, value: "base64"}
      reference_image: {key: reference_image, type: string, value: ""}

    - id: {key: id, type: string, value: "p-video-scene"}
      type: {key: type, type: string, value: "RichMediaPanel"}
      label: {key: label, type: string, value: "Rich Media Panel — Video (Scene)"}
      phase: {key: phase, type: string, value: "render"}
      actor: {key: actor, type: array, value: ["system", "user"]}
      handles: {key: handles, type: object, value: {target: ["videoUrl", "outputSrcDoc"], source: ["videoUrl", "outputSrcDoc"]}}
      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "richMediaPanel"}
      videoUrl: {key: videoUrl, type: string, value: ""}
      outputSrcDoc: {key: outputSrcDoc, type: string, value: ""}
      media_interactive: {key: media_interactive, type: boolean, value: true}

  edges:
    - {id: e-text-script, source: w-text-script, sourceHandle: text_out, target: p-text-script, targetHandle: output, label: "text_out → output", animated: true}
    - {id: e-text-script-srcdoc, source: w-text-script, sourceHandle: outputSrcDoc, target: p-text-script, targetHandle: outputSrcDoc, label: "outputSrcDoc → outputSrcDoc", animated: true}
    - {id: e-scene-image, source: w-img-scene, sourceHandle: imageUrl, target: p-img-scene, targetHandle: imageUrl, label: "imageUrl → imageUrl", animated: true}
    - {id: e-scene-to-video-ref, source: w-img-scene, sourceHandle: imageUrl, target: w-video-scene, targetHandle: reference_image, label: "imageUrl → reference_image", animated: true}
    - {id: e-video, source: w-video-scene, sourceHandle: videoUrl, target: p-video-scene, targetHandle: videoUrl, label: "videoUrl → videoUrl", animated: true}

director_brief:
  title: "The General's Dream"
  format: "45s reel · 2.39:1 anamorphic · 4K · no dialogue"
  total_runtime: "45s"
  score: "Solo cello (0–28s) → full orchestra swell (28–37s) → silence + ambient hum (37–41s) → sustained chord resolution (41–45s)"
  color_grade: "Desaturated earth tones throughout. Each epoch has a signature push: vault=amber/terracotta, ship=steel-blue/green, west=bleached gold, trench=olive/grey, terminator=red/chrome, prometheus=bioluminescent teal, canvas=pure white"
  no_dialogue: true
  no_voiceover: true
  subtitles: false
  cta_text: "Six thousand years of stories. One canvas to build them all.\nairvio.co — SeeDance 2.0. Every model. Every era. Yours."
  cta_timing_start: "41s"
  cta_font: "serif, light weight, fade-in over 2s, centred"

  shots:
    - shot: S01
      timecode: "00:00–00:04"
      epoch: "Terracotta Vault · Xi'an, 210 BCE"
      frame_label: "ECU — The Eye Cracks Open"
      description: "Extreme close-up of a terracotta warrior's face. Camera locked. Hairline cracks appear across the cheek. A single mote of dust drifts past the lens. The eye socket — sealed for two millennia — fissures. One painted iris becomes visible."
      camera:
        shot_type: ECU
        lens: "85mm anamorphic (1.33× squeeze)"
        movement: locked
        focal_distance: "18cm"
        aperture: "T1.4"
        lighting: "single practical — a sliver of surface light from above (tomb gap); fill: none"
        vfx: "practical dust particles + subtle eye CG replacement"
      image_prompt: "Extreme close-up of terracotta warrior face, cracked clay skin, one eye fissuring open, single amber light shaft from above, black void background, photorealistic, chiaroscuro, muted earth tones, anamorphic lens flare, 2.39:1, film grain"
      video_prompt: "Locked ECU terracotta warrior face, hairline cracks forming in slow motion, dust motes drifting, eye socket slowly opening to reveal painted iris, amber god-ray from above, 4K, anamorphic, no camera movement, cinematic"
      duration: "4s"

    - shot: S02
      timecode: "00:04–00:09"
      epoch: "Terracotta Vault · Xi'an, 210 BCE"
      frame_label: "PULL BACK — 8,000 Brothers"
      description: "Smooth crane pull-back reveals the warrior rising to standing among an infinite grid of frozen terracotta soldiers. He alone moves. He steps forward. Camera follows at chest height, keeping him centre-frame as the army recedes."
      camera:
        shot_type: "Wide → Medium Follow"
        lens: "35mm anamorphic"
        movement: "crane pull-back + slow push forward (cross-dissolve movement)"
        aperture: "T2.8"
        lighting: "raking amber practicals along tunnel ceiling; deep shadow fill on army"
        vfx: "army extension CG; dust atmosphere"
      image_prompt: "Terracotta warrior rising among thousands of identical frozen warriors in underground vault, amber torch-light raking across rows, deep chiaroscuro shadows, single figure in motion among the still, epic wide shot, 2.39:1 anamorphic, photorealistic"
      video_prompt: "Crane pull-back from lone terracotta warrior rising among 8000 frozen brothers in Xi'an underground vault, amber light shafts from ceiling gaps, warrior strides forward as camera follows at chest height, epic cinematic slow motion, 4K"
      duration: "5s"

    - shot: S03
      timecode: "00:09–00:13"
      epoch: "Age of Discovery · Atlantic, 1492"
      frame_label: "SMASH CUT — The Ship Deck"
      description: "Hard cut to the warrior stepping THROUGH the frame edge into a storm-lashed carrack. The transition is a single frame of white flash. Frozen crew mid-scream around broken rigging. He walks through them, head forward. Camera tracks laterally."
      camera:
        shot_type: "Medium Lateral Track"
        lens: "40mm anamorphic"
        movement: "lateral dolly, 0.8m/s"
        aperture: "T2"
        lighting: "overcast diffuse top + practical lightning flash (strobe, 1 hit at 2s)"
        vfx: "frozen crew — VFX time-freeze; rain particles; lightning comp"
      image_prompt: "Terracotta warrior walking through frozen storm-lashed Age of Discovery carrack ship deck, 1492, crew frozen mid-scream, broken rigging, grey-green ocean light, rain particles, lateral camera tracking shot, photorealistic, 2.39:1, steel-blue tones"
      video_prompt: "Lateral tracking shot of terracotta warrior striding through frozen ship deck mid-storm, Age of Discovery carrack, crew frozen in panic poses, lightning flash, rain simulation, camera moves parallel to warrior at waist height, cinematic 4K"
      duration: "4s"

    - shot: S04
      timecode: "00:13–00:18"
      epoch: "Wild West · Sonoran Desert, 1880"
      frame_label: "WHIP PAN — The Standoff"
      description: "Whip pan from ship to desert main street. High noon. Two gunslingers face off 20m apart, frozen. Between them: the warrior walks. A bullet hangs suspended in mid-air at his shoulder level. He passes it without looking. Camera slow-pushes into his back."
      camera:
        shot_type: "Slow Push — Warrior POV (back)"
        lens: "50mm anamorphic"
        movement: "whip pan transition → 0.3m/s push forward"
        aperture: "T4 (high noon exterior simulation)"
        lighting: "bleached overhead sun; long lateral shadows; heat shimmer post"
        vfx: "bullet freeze VFX; time-stop dust; heat distortion shader"
      image_prompt: "Terracotta warrior walking through Wild West main street standoff, 1880 Sonoran desert, two gunslingers frozen at either end, suspended bullet mid-air, bleached gold noon light, long shadows, rear medium shot, photorealistic, 2.39:1 anamorphic"
      video_prompt: "Slow push shot behind terracotta warrior walking through frozen Wild West standoff, suspended bullet at shoulder height, bleached noon light, heat shimmer, two frozen gunslingers at distance, cinematic 4K, slow motion"
      duration: "5s"

    - shot: S05
      timecode: "00:18–00:24"
      epoch: "World War · Somme, 1916"
      frame_label: "SHOCKWAVE CUT — Through Fire"
      description: "The bullet from S04 becomes a shell explosion. Cut on the shockwave. Trenches: rain, mud, barbed wire, frozen soldiers. A wall of orange fire suspended mid-burn across the trench ahead. The warrior walks directly into it. Passes through. Camera holds on the fire, then the warrior emerges from the other side."
      camera:
        shot_type: "Static Wide → Match Cut Through Fire"
        lens: "28mm anamorphic (wider for trench claustrophobia)"
        movement: "static, then rack focus warrior→fire→warrior"
        aperture: "T2.8"
        lighting: "fire practical (orange key); grey overcast fill; smoke atmosphere"
        vfx: "suspended fire wall; mud particle sim; frozen soldier composites"
      image_prompt: "Terracotta warrior walking toward suspended wall of orange fire in WWI Somme trench, 1916, frozen soldiers in mud around him, barbed wire, grey overcast sky, smoke atmosphere, wide static shot, olive-grey tones, photorealistic, 2.39:1 anamorphic"
      video_prompt: "Static wide shot terracotta warrior approaching and passing through suspended wall of fire in WWI trench, frozen soldiers in mud, barbed wire, smoke, camera rack focus from warrior to fire to warrior emerging on other side, cinematic 4K"
      duration: "6s"

    - shot: S06
      timecode: "00:24–00:30"
      epoch: "Terminator · Post-Apocalyptic Ruin, 2029"
      frame_label: "RED BLEEDS IN — The Endoskeleton Kneels"
      description: "Red scanner light bleeds across the frame. Rubble city ruins. Laser grid overhead. An endoskeleton turns to face the warrior — red eye reading him. A beat. Then it kneels. The warrior doesn't stop walking. Camera pushes in on the kneeling machine as the warrior moves out of frame."
      camera:
        shot_type: "Medium → Slow Push on Endoskeleton"
        lens: "65mm anamorphic"
        movement: "slow push 0.2m/s toward endoskeleton"
        aperture: "T1.8"
        lighting: "red scanner key from endoskeleton eye; blue laser grid overheads; no fill"
        vfx: "endoskeleton — full CG; laser grid; ruin environment extension"
      image_prompt: "Chrome Terminator endoskeleton kneeling before terracotta warrior in post-apocalyptic ruins, red scanner eye glow, blue laser grid overhead, rubble and twisted metal, warrior walks forward out of frame, medium push shot, red-chrome tones, photorealistic, 2.39:1"
      video_prompt: "Slow push shot toward Terminator endoskeleton kneeling as terracotta warrior passes it in post-apocalyptic ruin, red eye glow, blue laser grids overhead, warrior continues out of frame, camera holds on kneeling machine, cinematic 4K, tense atmosphere"
      duration: "6s"

    - shot: S07
      timecode: "00:30–00:37"
      epoch: "Prometheus · Alien Monolith Corridor"
      frame_label: "THE DISSOLVE — Clay Becomes Light"
      description: "The warrior enters a vast alien corridor. Bioluminescent teal. Stars visible through open archways. He approaches the monolith — a black obelisk, floor-to-ceiling. He reaches out his right hand and touches it. The clay of his hand begins to dissolve — upward, like ash in reverse — into pure bioluminescent light. He watches his own transformation with no fear."
      camera:
        shot_type: "Medium → ECU Hand"
        lens: "85mm anamorphic"
        movement: "slow push in, then cut to ECU on hand contact"
        aperture: "T1.4"
        lighting: "bioluminescent teal practical from monolith face; star field through arches; no hard key"
        vfx: "hand dissolution particle system — clay particles reverse-float upward; light bloom on contact point"
      image_prompt: "Terracotta warrior touching black alien monolith in vast Prometheus-style corridor, clay hand dissolving upward into bioluminescent teal light particles, stars visible through open archways, god-rays from monolith, extreme close-up on hand, photorealistic, 2.39:1 anamorphic"
      video_prompt: "Terracotta warrior approaches and touches alien monolith in vast cosmic corridor, clay hand begins dissolving upward into bioluminescent teal light particles in slow motion, camera pushes to ECU on hand contact point, stars through archways, cinematic 4K, awe"
      duration: "7s"

    - shot: S08
      timecode: "00:37–00:41"
      epoch: "The Canvas Reveal"
      frame_label: "REVERSE ZOOM — He Is a Node"
      description: "From the ECU of the dissolving hand, the camera pulls back — fast, exponential zoom-out. The Prometheus corridor shrinks. Then we see: it's a node on a canvas. A flow graph. Other nodes surround it — the ship, the trench, the desert — all connected by luminous threads. A cursor appears and hovers over the warrior's node. The canvas glows."
      camera:
        shot_type: "Rapid Reverse Zoom — Practical→Digital"
        lens: "transition from 85mm anamorphic to screen-space CG camera"
        movement: "exponential pull-back, 0→8m/s"
        aperture: "N/A (CG transition)"
        lighting: "screen glow — white canvas light; node halos"
        vfx: "full CG canvas environment; node graph materialises; cursor animation; luminous bezier edges"
      image_prompt: "Extreme pull-back zoom revealing terracotta warrior corridor scene as a glowing node on a dark creative canvas, flow graph with six connected epoch nodes, luminous bezier edges between nodes, cursor hovering over warrior node, digital canvas aesthetic, white glow, 2.39:1"
      video_prompt: "Rapid exponential reverse zoom pulling back from alien corridor to reveal it is a node on a dark video canvas flow graph, six epoch nodes connected by glowing bezier curves, cursor materialises and hovers over the warrior node, canvas glows white, cinematic 4K"
      duration: "4s"

    - shot: S09
      timecode: "00:41–00:45"
      epoch: "CTA — Canvas Hold"
      frame_label: "HOLD — Text Materialises"
      description: "Canvas holds. Slight parallax drift on the node graph. Text fades in over two seconds, centred, white serif on dark canvas. Held for 4 seconds. Score resolves to silence then a single sustained chord."
      camera:
        shot_type: "Static Hold (CG)"
        lens: "N/A"
        movement: "subtle parallax 0.05m/s drift"
        aperture: "N/A"
        lighting: "canvas ambient only"
        vfx: "text fade-in; parallax depth pass; chord audio resolves"
      cta:
        line_1: "Six thousand years of stories. One canvas to build them all."
        line_2: "airvio.co — SeeDance 2.0. Every model. Every era. Yours."
        font: "Cormorant Garamond · Light · tracked +80"
        colour: "#FFFFFF"
        fade_in: "2s"
        hold: "4s"
      duration: "4s"
---

# Video Demo — The General's Dream (Variation 1)

Director brief, storyboard spec, and shot list for the 45-second epoch-traversal reel.
Pipeline: `{{inputs.byteplus_text_model}}` → `{{inputs.byteplus_image_model}}` → `{{inputs.byteplus_video_model}}`

---

## Inputs

- `inputs.vibe`: `{{inputs.vibe}}`
- `inputs.duration_label`: `{{inputs.duration_label}}` per video generation call
- `inputs.location.name`: `{{inputs.location.name}}`
- `inputs.theme`: `{{inputs.theme}}`

Prompt contract:

```text
{{inputs.vibe}}, {{inputs.duration_label}}; {{inputs.location.name}}; {{inputs.theme}}.
Script: {{inputs.script}}
```

---

## Director Brief

**Title:** The General's Dream  
**Runtime:** 45 seconds  
**Format:** 2.39:1 anamorphic · 4K · no dialogue · no voiceover · no subtitles  
**Score:** Solo cello (0–28s) → full orchestra (28–37s) → silence (37–41s) → sustained resolution chord (41–45s)  
**No music sync cuts** — score breathes with the warrior, not against him.

**Conceptual spine:** One terracotta warrior walks through six epochs of human civilisation. He passes through each world as a ghost — unhurried, unafraid. At the end, the camera pulls back to reveal: he was always a node on a creative canvas. The recursive beat is the film's entire thesis. *The artist was always building him.*

---

## Storyboard — Shot-by-Shot

### S01 · 0–4s · Terracotta Vault · ECU — The Eye Cracks Open

**Frame description:** Black. A terracotta face fills the frame. Hairline cracks form. Dust drifts across the lens. The sealed eye socket fissures open.

**Camera:** ECU · 85mm anamorphic · locked · T1.4  
**VFX:** Practical clay crack practical + eye CG replacement  
**Image prompt seed:** `{{director_brief.shots[0].image_prompt}}`

---

### S02 · 4–9s · Terracotta Vault · PULL BACK — 8,000 Brothers

**Frame description:** Crane pulls back. The warrior rises to standing. Infinite grid of frozen soldiers recedes. He alone moves — forward. Camera tracks him at chest height.

**Camera:** Wide → Medium follow · 35mm anamorphic · crane pull-back + push forward · T2.8  
**VFX:** Army extension CG; dust atmosphere

---

### S03 · 9–13s · Age of Discovery · SMASH CUT — The Ship Deck

**Frame description:** Hard cut. White flash single frame. Warrior steps out of frame edge onto a storm-lashed carrack. Frozen crew in tableau. He walks through them. Lateral dolly tracks him.

**Camera:** Medium lateral track · 40mm anamorphic · lateral dolly 0.8m/s · T2  
**VFX:** Frozen crew time-freeze; rain particles; lightning comp

---

### S04 · 13–18s · Wild West · WHIP PAN — The Standoff

**Frame description:** Whip pan lands on main street. Noon. Two gunslingers face off. Bullet suspended mid-air. Warrior walks between them. Camera slow-pushes into his back.

**Camera:** Slow push · 50mm anamorphic · whip pan transition + 0.3m/s push · T4  
**VFX:** Bullet freeze; time-stop dust; heat distortion shader

---

### S05 · 18–24s · World War · SHOCKWAVE CUT — Through Fire

**Frame description:** Bullet becomes shell. Cut on shockwave. Trenches. Mud. Frozen soldiers. Wall of orange fire across the trench, suspended. Warrior walks into it, through it, emerges.

**Camera:** Static wide → match cut through fire · 28mm anamorphic · rack focus · T2.8  
**VFX:** Suspended fire wall; mud particle sim; frozen soldier composites

---

### S06 · 24–30s · Terminator · RED BLEEDS IN — The Endoskeleton Kneels

**Frame description:** Red scanner light floods frame. Ruins. Laser grid. Endoskeleton turns — red eye reads the warrior. A beat. It kneels. Warrior walks on. Camera holds on the kneeling machine.

**Camera:** Medium → slow push · 65mm anamorphic · 0.2m/s toward endoskeleton · T1.8  
**VFX:** Full CG endoskeleton; laser grid; ruin environment extension

---

### S07 · 30–37s · Prometheus · THE DISSOLVE — Clay Becomes Light

**Frame description:** Vast alien corridor. Bioluminescent teal. Stars through archways. Warrior approaches black monolith. Touches it. Clay hand begins dissolving upward into light particles. He watches, fearless.

**Camera:** Medium → ECU hand · 85mm anamorphic · slow push then cut ECU · T1.4  
**VFX:** Hand dissolution particle system; clay particles reverse-float; light bloom on contact

---

### S08 · 37–41s · Canvas Reveal · REVERSE ZOOM — He Is a Node

**Frame description:** From ECU dissolving hand — exponential pull-back. Prometheus corridor shrinks. Then: it's a node on a canvas. Six epoch nodes connected by glowing bezier threads. A cursor materialises and hovers over the warrior's node.

**Camera:** Rapid reverse zoom · anamorphic → CG camera · exponential 0→8m/s · transition to screen-space  
**VFX:** Full CG canvas; node graph materialises; cursor animation; luminous bezier edges

---

### S09 · 41–45s · CTA · HOLD — Text Materialises

**Frame description:** Canvas holds. Subtle parallax drift. White serif text fades in over 2 seconds. Holds for 4 seconds. Score resolves.

**Camera:** Static hold CG · subtle parallax 0.05m/s  
**Score:** Sustained chord resolution

---

## Pipeline

`W01` generates structured image + video prompts per shot, `W02` creates the reference frame (S07 — Prometheus hand dissolve selected as hero frame), `W03` generates the final video from that reference.

## Flow Graph

The `mermaid` and `flow` blocks above describe the same graph. Rich Media Panels render the output values written by each widget.
