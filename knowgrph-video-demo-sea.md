---
title: "Knowgrph · Video Demo — Five Skies (RoboDrone X1 · SEA Multiverse)"
graphId: "md:knowgrph-video-toys-demo-v1"
doc_type: "Video Script — Director Brief"
date: "2026-04-30"
lang: en-US

kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: "flowEditor"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgDocumentStructureBaselineLock: false

$schema: "kgc-pipeline/v1"

inputs:
  byteplus_text_model: "seed-2-0-lite-260228"
  byteplus_image_model: "seedream-4-0-250828"
  byteplus_video_model: "seedance-1-0-pro-fast-251015"
  vibe: "vivid, photorealistic, magic-realist, warm naturalistic light cross-cutting to surreal multiverse glow, 9:16 vertical, TikTok-native"
  duration_seconds: 8
  duration_label: "8s"
  theme: "a RoboDrone X1 lifts off in five SEA landscapes — paddy field, mango farm, water market, island coast, city skyline — each world dissolving into its own surreal multiverse the moment the drone clears tree-height; parents watch proudly on the ground while children step through the portal above"
  script: |
    VN — Golden afternoon. A child launches the drone above a paddy field.
    It clears the rice stalks. The field shimmers — a hidden spirit village glows beneath the paddies. Ancient harvest guardians rise.
    PH — Sunset. Drone lifts from a mango grove. The ripe mangoes begin to float upward like amber lanterns. The farm peels off the earth into a floating island kingdom in the clouds.
    TH — Morning canal. Drone weaves between longboats at the floating market. The market lifts — boats become sky-barges drifting through a neon Muay Thai arena above the clouds.
    ID — Turquoise coastline. Drone skims the shore. A sea serpent breaks the surface. The child steers the drone through coral spine ridges in an underwater canyon battle.
    SG — Dusk. Drone rises before Marina Bay Sands. The Merlion morphs into a 100m AI sentinel. Singapore becomes RoboTown — the child pilots the neural grid command unit.
    Cut back: five parents, five phones, five proud faces. Five worlds. One drone.
    Text fades in: "One brief. Five multiverses. The drone opens the portal."
    "airvio.co/knowgrph — Write it. See it. Ship it."
  location:
    name: "multi-locale SEA: VN paddy field → PH mango grove → TH floating water market → ID island coastline → SG Marina Bay Sands / RoboTown"
    short_label: "5-locale-SEA"
    label: "Five-locale SEA traversal: Vietnam paddy field · Philippines mango farm · Thailand floating water market · Indonesia island coast · Singapore MBS / RoboTown"

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
    label: "script to prompt breakdown — 5 locale variants"
    actor: ["user", "AI"]
    edge_in: "prompt_in"
    edge_out: "text_out"
    user_action: "Edit locale variant field and run"
    sys_event: "TextGeneration returns dual-layer prompts (parent trust + child multiverse) per locale for scene image + final video"
    data_in: "properties.prompt"
    data_out: "properties.output + properties.outputSrcDoc"
    trigger: "run"
    on_fail: "output unchanged"
    confidence: high
    status: TBD
  - seq: W02
    node: w-img-scene
    label: "image generation — hero locale reference frame"
    actor: ["user", "AI"]
    edge_in: "prompt_in"
    edge_out: "imageUrl"
    user_action: "Run the scene reference image widget for selected locale"
    sys_event: "ImageGeneration writes imageUrl for hero multiverse frame"
    data_in: "properties.prompt + properties.model"
    data_out: "properties.imageUrl"
    trigger: "run"
    on_fail: "imageUrl unchanged"
    confidence: high
    status: TBD
  - seq: W03
    node: w-video-scene
    label: "video generation — locale clip"
    actor: ["user", "AI"]
    edge_in: "reference_image"
    edge_out: "videoUrl"
    user_action: "Run the video widget after reference image exists"
    sys_event: "VideoGeneration writes videoUrl for 9:16 TikTok-ready locale clip"
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
      prompt: {key: prompt, type: string, value: "Generate dual-layer prompts for (1) one hero locale scene reference image and (2) the final video. Parent trust layer: safety badges, crash-proof, flight time. Child multiverse layer: locale-specific adventure scene. Use: vibe={{inputs.vibe}}, duration={{inputs.duration_label}}, location={{inputs.location.name}}, theme={{inputs.theme}}. Script: {{inputs.script}}. Output as markdown with explicit sections: Scene Image Prompt, Video Prompt."}

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
      prompt: {key: prompt, type: textarea, value: "{{inputs.vibe}}, {{inputs.duration_label}}; {{inputs.location.label}}; {{inputs.theme}}. Script: {{inputs.script}}. Hero frame: ID locale — child on turquoise coastline, RoboDrone X1 lifting off, sea serpent breaking surface in background, coral canyon visible below waterline, 9:16 vertical."}
      size: {key: size, type: select, value: "2K"}
      output_format: {key: output_format, type: select, value: "jpeg"}
      response_format: {key: response_format, type: select, value: "b64_json"}
      optimize_prompt_options: {key: optimize_prompt_options, type: select, value: "fast"}
      aspect_ratio: {key: aspect_ratio, type: number, value: 0.5625}
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
      ratio: {key: ratio, type: select, value: "9:16"}
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
  title: "Five Skies"
  runtime: "30 seconds"
  format: "9:16 vertical · 1080p · no dialogue · no voiceover · no subtitles"
  score: "Gamelan-inflected lo-fi (0–22s) → full swell (22–27s) → silence (27–28s) → single warm resolution chord (28–30s)"
  score_note: "No music sync cuts — score breathes with each child's launch moment, not against it."
  conceptual_spine: "Five children in five SEA landscapes each launch the same RoboDrone X1. The moment each drone clears tree-height, reality folds — the real landscape dissolves into its locale's unique multiverse. The parent on the ground sees the sky. The child in the sky enters another world. The recursive beat: every world was always a node on a canvas."

  shots:
    - shot: S01
      timecode: "00:00–00:05"
      locale: "VN · Mekong Delta paddy field"
      frame_label: "LIFT-OFF — The Rice Spirit Stirs"
      description: "Golden late-afternoon. A Vietnamese child, 10, stands at the edge of a flooded paddy field. Rows of jade-green rice stalks extend to the horizon. She holds the drone controller, exhales, and launches. The RoboDrone X1 rises above the stalks — and the moment it clears the canopy, the paddy field beneath begins to shimmer. Faint bioluminescent lines pulse along each rice row. Ancient harvest-guardian silhouettes rise slow from the waterline, translucent, benevolent. The child hovers the drone over them. She is the first to see."
      prompt: "Write the Text Widget output for S01. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Parent Trust Beat, Locale Hook, Rich Media Panel Summary. Use the VN paddy field details, parent trust proof, child discovery beat, and 9:16 vertical magic-realist style."
      camera:
        shot_type: "Low Dutch Angle → Tilt-Up Follow"
        lens: "35mm"
        movement: "low angle on child, tilt up as drone lifts, slow follow to drone POV over field"
        aperture: "T2"
        lighting: "golden hour backlight; warm amber fill on child face; cool teal bioluminescent bloom from field surface"
        vfx: "bioluminescent rice-row pulse lines; spirit silhouettes rising from water surface; soft shimmer transition layer over real field"
      image_prompt: "Vietnamese child launching small consumer drone at golden hour above flooded paddy field, Mekong Delta, rice stalks at waist height, bioluminescent teal lines pulsing along rice rows below, ancient harvest spirit silhouettes rising translucent from waterline, warm amber backlight, magic-realist, photorealistic, 9:16 vertical"
      video_prompt: "Low angle tilt-up following child launching drone above Vietnamese paddy field at golden hour, drone clears rice canopy, field below shimmers and bioluminescent lines pulse along rows, translucent harvest guardian spirits rise slowly from water surface, warm amber light cross-cuts to cool teal glow, 9:16 vertical, cinematic, magic-realist"
      duration: "5s"
      locale_hook: "Bay cùng gia đình, khám phá thế giới bí ẩn!"
      parent_trust: "obstacle-sense · 20-min flight · crash-proof shell"

    - shot: S02
      timecode: "00:05–00:10"
      locale: "PH · Cebu mango grove, golden hour"
      frame_label: "FLOAT — The Farm Becomes a Kingdom"
      description: "Sunset. A Filipino boy, 9, stands between rows of mango trees heavy with ripe fruit. He launches the drone. It rises. The moment it clears the highest branch — the mangoes begin to detach from their stems and float upward slowly, glowing amber, like lanterns released at a festival. The entire grove peels gently off the earth. Soil, roots, trees, the child's laughter — all rising into a floating island kingdom drifting above sunset clouds. The drone leads the ascent."
      prompt: "Write the Text Widget output for S02. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Parent Trust Beat, Locale Hook, Rich Media Panel Summary. Use the PH mango grove details, floating island transformation, parent trust proof, and 9:16 vertical magic-realist style."
      camera:
        shot_type: "Medium → Crane Pull-Back"
        lens: "40mm"
        movement: "medium on child between trees, crane pull-back as grove lifts, reveal floating island from below"
        aperture: "T2.8"
        lighting: "warm gold sunset key; amber bounce from floating mangoes; under-lit cloud layer as island clears it"
        vfx: "mango float particle system — amber glow trail per fruit; terrain lift simulation; floating island kingdom environment; cloud layer below ascending island"
      image_prompt: "Filipino boy launching drone in mango grove at golden hour Cebu Philippines, ripe mangoes detaching and floating upward glowing amber like lanterns, entire grove beginning to lift off earth, floating island kingdom forming above sunset clouds, drone ascending ahead of the floating farm, magic-realist, photorealistic, 9:16 vertical"
      video_prompt: "Crane pull-back from child launching drone in mango grove, mangoes begin floating upward glowing amber at golden hour, entire grove peels off earth in slow motion, floating island kingdom rises above sunset cloud layer, drone leads ascent, camera pulls back to reveal floating island from below, 9:16 vertical, cinematic, warm magic-realist"
      duration: "5s"
      locale_hook: "Lumipad sa lupain ng mga mangga sa langit!"
      parent_trust: "obstacle-sense · 20-min flight · crash-proof shell"

    - shot: S03
      timecode: "00:10–00:16"
      locale: "TH · Bangkok floating water market"
      frame_label: "LIFT — The Market Takes Flight"
      description: "Morning. A Thai girl, 11, sits cross-legged on the prow of a longtail boat among the canal stalls of a floating market. Vendors in wide-brim hats, lotus flowers, steaming bowls. She launches the drone. It weaves between the boat canopies — and then the entire market lifts. Boats become sky-barges. The canal surface remains but the market floats upward into a neon-lit aerial arena where Muay Thai fighters spar in slow motion on platforms suspended between the sky-barges. The girl's drone is the referee."
      prompt: "Write the Text Widget output for S03. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Parent Trust Beat, Locale Hook, Rich Media Panel Summary. Use the TH floating water market details, sky-barge arena transformation, parent trust proof, and 9:16 vertical magic-realist style."
      camera:
        shot_type: "Eye-Level Float → Wide Aerial"
        lens: "28mm"
        movement: "eye-level on child in boat, drone lifts through market canopies, camera follows up to aerial wide as market floats"
        aperture: "T2"
        lighting: "soft morning diffuse on canal; neon magenta and gold as market lifts; stadium-light bloom on aerial arena"
        vfx: "boat levitation simulation; canal surface remains static below; neon arena environment build; Muay Thai fighter composites; slow-motion particle system on impacts"
      image_prompt: "Thai girl on longtail boat launching drone in Bangkok floating water market, canal stalls lifting off water into sky, boats becoming sky-barges drifting into neon aerial Muay Thai arena above clouds, slow-motion fighters sparring on floating platforms, soft morning light cross-cutting to neon magenta gold, magic-realist, photorealistic, 9:16 vertical"
      video_prompt: "Eye-level shot on child launching drone in Bangkok floating water market, drone weaves through boat canopies, entire market begins lifting off canal, boats become sky-barges, camera follows up to aerial wide revealing neon Muay Thai arena in the sky with slow-motion fighters on floating platforms, 9:16 vertical, cinematic, neon magic-realist"
      duration: "6s"
      locale_hook: "บินสู่ตลาดน้ำในโลกอีกใบ!"
      parent_trust: "obstacle-sense · 20-min flight · crash-proof shell"

    - shot: S04
      timecode: "00:16–00:22"
      locale: "ID · Lombok island coastline"
      frame_label: "DIVE — The Sea Serpent Rises"
      description: "Turquoise water. Black volcanic sand. An Indonesian boy, 12, stands barefoot at the shoreline and launches the drone low over the water. It skims the surface. Below the waterline — visible through the impossible clarity — a vast sea serpent is coiling upward, ancient, scaled in iridescent green and gold. It breaks the surface in a slow column of white water. The drone banks hard, the boy leans into the controller, and they weave through the exposed coral spine ridges of the serpent's back as it arcs back into the deep. The battle has begun."
      prompt: "Write the Text Widget output for S04. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Parent Trust Beat, Locale Hook, Rich Media Panel Summary. Use the ID Lombok coastline details, sea serpent action beat, parent trust proof, and 9:16 vertical magic-realist style."
      camera:
        shot_type: "Low Drone POV → Tracking Dive"
        lens: "24mm wide"
        movement: "low skim over water surface following drone, tilt down to reveal serpent rising from below, tracking dive alongside serpent arc"
        aperture: "T2"
        lighting: "midday equatorial white overhead; turquoise caustic refraction from below waterline; iridescent green-gold bioluminescent scale glow on serpent"
        vfx: "underwater serpent reveal — subsurface caustic light simulation; serpent surface breach with water column; coral spine ridge environment; drone banking physics simulation"
      image_prompt: "Indonesian boy on black volcanic sand beach Lombok launching drone low over turquoise ocean, enormous sea serpent rising from below waterline iridescent green gold scales, white water column breach, drone banking toward exposed coral spine ridges on serpent's back, midday equatorial light, turquoise caustics from below, magic-realist, photorealistic, 9:16 vertical"
      video_prompt: "Low drone-POV skim over turquoise Lombok coastline, camera tilts down to reveal massive iridescent sea serpent coiling upward from below surface, serpent breaches in slow-motion white water column, drone banks hard alongside coral spine ridges on serpent's back, boy leans into controller on volcanic sand shore, 9:16 vertical, cinematic, vivid magic-realist"
      duration: "6s"
      locale_hook: "Tantang naga laut dari langit!"
      parent_trust: "obstacle-sense · 20-min flight · crash-proof shell"

    - shot: S05
      timecode: "00:22–00:27"
      locale: "SG · Marina Bay Sands / RoboTown"
      frame_label: "ASCEND — The Merlion Becomes a Sentinel"
      description: "Dusk. Singapore. A Singaporean girl, 13, stands on the Marina Bay promenade. City lights just beginning. She launches the drone. It rises before Marina Bay Sands — the three towers, the sky park, the bay. Then: the Merlion shifts. Stone becomes chrome. It stands taller — 100 metres, articulated, AI-sentinel, scanning. The skyline morphs: towers grow sensor arrays, drone corridors appear between buildings, the bay surface becomes a neural grid of light. This is RoboTown. The girl's drone ascends to the command position at the top of the grid. She is the pilot. The city waits."
      prompt: "Write the Text Widget output for S05. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Parent Trust Beat, Locale Hook, Rich Media Panel Summary. Use the SG Marina Bay RoboTown details, AI sentinel transformation, parent trust proof, and 9:16 vertical futurist magic-realist style."
      camera:
        shot_type: "Low Angle Rise → Wide City Transform"
        lens: "35mm"
        movement: "low angle on child with MBS behind, drone rises past child eyeline, camera cranes up to reveal full city transform"
        aperture: "T1.8"
        lighting: "blue-hour Singapore dusk on real city; cold chrome-white and electric blue on RoboTown reveal; neural grid bay surface light emission"
        vfx: "Merlion morph — stone-to-chrome particle transition; MBS tower sensor array extension; drone corridor network materialise between buildings; bay surface neural grid light animation; city scale exaggeration — towers grow 30%"
      image_prompt: "Singaporean girl launching drone on Marina Bay promenade at dusk, Marina Bay Sands towers behind her, Merlion transforming from stone to chrome 100m AI sentinel, Singapore skyline morphing into RoboTown with sensor arrays on towers and drone corridors between buildings, Marina Bay surface becoming neural grid of light, girl's drone ascending to command position above grid, blue-hour cold chrome tones, magic-realist futurist, photorealistic, 9:16 vertical"
      video_prompt: "Low angle crane-up following drone rising before Marina Bay Sands at blue-hour dusk, Merlion begins morphing from stone to towering chrome AI sentinel, Singapore skyline transforms into RoboTown — sensor arrays grow on towers, drone corridors materialise, bay surface becomes glowing neural grid, girl's drone ascends to command position above the city, cold chrome and electric blue tones, 9:16 vertical, cinematic, futurist magic-realist"
      duration: "5s"
      locale_hook: "Command the future. Your city. Your drone."
      parent_trust: "obstacle-sense · 20-min flight · crash-proof shell"

    - shot: S06
      timecode: "00:27–00:29"
      epoch: "The Canvas Reveal"
      frame_label: "REVERSE ZOOM — Five Worlds, One Brief"
      description: "From the SG drone's command position — exponential pull-back. RoboTown shrinks. Then: five locale scenes appear as nodes on a dark canvas, connected by luminous bezier threads. VN paddy field · PH mango kingdom · TH sky market · ID serpent coast · SG RoboTown — all live, all glowing. Five parents visible at the base of each node. A cursor materialises and hovers. The canvas glows."
      prompt: "Write the Text Widget output for S06. Produce a concise markdown scene brief with sections: Scene Image Prompt, Video Prompt, Canvas Reveal Beat, Edge/Node Summary, Rich Media Panel Summary. Use the five-world reverse zoom, luminous bezier edges, parent silhouettes, cursor reveal, and dark canvas aesthetic."
      camera:
        shot_type: "Rapid Reverse Zoom — Practical→Digital"
        lens: "transition from 35mm to screen-space CG camera"
        movement: "exponential pull-back, 0→8m/s"
        aperture: "N/A (CG transition)"
        lighting: "screen glow — dark canvas; five node halos in locale colours: teal · amber · magenta · turquoise · electric blue"
        vfx: "full CG canvas environment; five locale nodes materialise; bezier edges between nodes; cursor animation; parent silhouettes at node bases"
      image_prompt: "Extreme pull-back zoom revealing five glowing locale nodes on dark creative canvas flow graph — VN paddy field, PH mango island, TH sky market, ID serpent coast, SG RoboTown — connected by luminous bezier curves in locale colours teal amber magenta turquoise electric blue, cursor hovering above canvas, parent silhouettes at base of each node, 9:16 vertical, dark canvas aesthetic"
      video_prompt: "Rapid exponential reverse zoom from Singapore drone command position to reveal five locale scenes as glowing nodes on dark canvas flow graph, bezier edges connecting all five nodes in locale colours, cursor materialises and hovers, five parent silhouettes glow at node bases, canvas pulses once, 9:16 vertical, cinematic, 2s"
      duration: "2s"

    - shot: S07
      timecode: "00:29–00:30"
      epoch: "CTA — Canvas Hold"
      frame_label: "HOLD — Text Materialises"
      description: "Canvas holds. Subtle parallax drift across the five nodes. Two lines of text fade in over one second. Held for one second. Warm resolution chord sounds."
      prompt: "Write the Text Widget output for S07. Produce a concise markdown scene brief with sections: CTA Copy, Video Prompt, Canvas Hold Beat, Rich Media Panel Summary. Use the final text materialisation, warm resolution chord, five glowing nodes, and airvio.co/knowgrph call to action."
      camera:
        shot_type: "Static Hold (CG)"
        lens: "N/A"
        movement: "subtle parallax 0.05m/s drift"
        aperture: "N/A"
        lighting: "canvas ambient only; five node halos maintain locale colours"
        vfx: "text fade-in; parallax depth pass; warm chord audio"
      cta:
        line_1: "One brief. Five multiverses. The drone opens the portal."
        line_2: "airvio.co/knowgrph — Write it. See it. Ship it."
        font: "Cormorant Garamond · Light · tracked +80"
        colour: "#FFFFFF"
        fade_in: "1s"
        hold: "1s"
      duration: "1s"
---

# Video Demo — Five Skies (RoboDrone X1 · SEA Multiverse)

Director brief, storyboard spec, and shot list for the 30-second five-locale multiverse reel.  
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

**Title:** Five Skies  
**Runtime:** 30 seconds  
**Format:** 9:16 vertical · 1080p · no dialogue · no voiceover · no subtitles  
**Score:** Gamelan-inflected lo-fi (0–22s) → full swell (22–27s) → silence (27–28s) → warm resolution chord (28–30s)  
**No music sync cuts** — score breathes with each child's launch moment, not against it.

**Conceptual spine:** Five children in five SEA landscapes each launch the same RoboDrone X1. The moment each drone clears tree-height, reality folds — the landscape dissolves into its locale's unique multiverse. The parent on the ground sees the sky. The child in the sky enters another world. The recursive reveal: every world was always a node on a canvas. *The brief was always building them.*

---

## Storyboard — Shot-by-Shot

### S01 · 0–5s · VN · Paddy Field · LIFT-OFF — The Rice Spirit Stirs

**Frame description:** Golden late-afternoon. Vietnamese child launches drone above flooded paddy field. Drone clears the rice canopy. The field shimmers — bioluminescent lines pulse along each rice row. Ancient harvest-guardian silhouettes rise translucent from the waterline.

**Camera:** Low Dutch angle → tilt-up follow · 35mm · T2  
**VFX:** Bioluminescent rice-row pulse; spirit silhouette composites; shimmer transition layer  
**Image prompt seed:** `{{director_brief.shots[0].image_prompt}}`

---

### S02 · 5–10s · PH · Mango Grove · FLOAT — The Farm Becomes a Kingdom

**Frame description:** Sunset. Filipino boy launches drone above Cebu mango grove. Drone clears the highest branch. Mangoes detach and float upward — amber lanterns. The entire grove peels off the earth into a floating island kingdom above sunset clouds.

**Camera:** Medium → crane pull-back · 40mm · T2.8  
**VFX:** Mango float particle system; terrain lift simulation; floating island environment; cloud layer below

---

### S03 · 10–16s · TH · Water Market · LIFT — The Market Takes Flight

**Frame description:** Morning Bangkok canal. Thai girl on longtail boat launches drone. Drone weaves through canopy. The market lifts — boats become sky-barges. Neon Muay Thai arena materialises above clouds. Slow-motion fighters spar on floating platforms. The drone is the referee.

**Camera:** Eye-level float → wide aerial · 28mm · T2  
**VFX:** Boat levitation; canal static below; neon arena environment; Muay Thai composites

---

### S04 · 16–22s · ID · Lombok Coastline · DIVE — The Sea Serpent Rises

**Frame description:** Turquoise water. Black volcanic sand. Indonesian boy launches drone low over the sea. Below the surface — a vast iridescent sea serpent coils upward. It breaches in a column of white water. The drone banks through the coral spine ridges of the serpent's back. The battle begins.

**Camera:** Low drone POV → tracking dive · 24mm · T2  
**VFX:** Subsurface caustic simulation; serpent breach water column; coral spine ridge environment; drone banking physics

---

### S05 · 22–27s · SG · Marina Bay / RoboTown · ASCEND — The Merlion Becomes a Sentinel

**Frame description:** Blue-hour Singapore. Singaporean girl launches drone before Marina Bay Sands. The Merlion morphs — stone to chrome, 100 metres, AI sentinel. The skyline transforms into RoboTown: sensor arrays, drone corridors, neural grid bay. The girl's drone ascends to the command position. She pilots the city.

**Camera:** Low angle rise → wide city transform · 35mm · T1.8  
**VFX:** Merlion stone-to-chrome morph; tower sensor array extension; drone corridor network; neural grid bay animation

---

### S06 · 27–29s · Canvas Reveal · REVERSE ZOOM — Five Worlds, One Brief

**Frame description:** Exponential pull-back from SG command position. Five locale scenes appear as nodes on a dark canvas — VN · PH · TH · ID · SG — connected by luminous bezier threads in locale colours. Five parent silhouettes at each node base. Cursor materialises. Canvas glows.

**Camera:** Rapid reverse zoom · 35mm → CG · exponential 0→8m/s  
**VFX:** Full CG canvas; five locale nodes; bezier edges in locale colours; cursor animation; parent silhouettes

---

### S07 · 29–30s · CTA · HOLD — Text Materialises

**Frame description:** Canvas holds. Parallax drift. Text fades in. Warm chord resolves.

**Camera:** Static hold CG · subtle parallax 0.05m/s  
**Score:** Warm resolution chord

---

## Pipeline

`W01` generates dual-layer structured prompts per locale (parent trust + child multiverse), `W02` creates the hero reference frame (S04 — ID sea serpent breach selected as hero frame for highest visual drama), `W03` generates the final video from that reference.

## Flow Graph

The `mermaid` and `flow` blocks above describe the same graph. Rich Media Panels render the output values written by each widget.