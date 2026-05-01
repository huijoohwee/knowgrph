---
title: "Knowgrph — Write it. See it. Ship it."
id: md:knowgrph-readme-v3
author: joohwee
institution: "Knowgrph — airvio.co/knowgrph"
date: "2026-05-01"
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: "d3"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgDocumentStructureBaselineLock: false
index:
  legend:
    nodes:
      problem:   "#c0392b — red    — pain point / competitor gap"
      insight:   "#d68910 — amber  — reframe / principle / tagline"
      product:   "#1a6fa8 — blue   — widget / layer / tech component"
      actor:     "#1e8449 — green  — user segment / stakeholder / market"
      output:    "#7d3c98 — purple — artifact / export / data store"
      business:  "#117a65 — teal   — revenue line / model tier"
      milestone: "#5d6d7e — grey   — roadmap item"
    edges:
      user_flow: "solid #2980b9  2px  — actor interacts with product surface"
      work_flow: "dashed #d68910 2px  — pitch section narrative progression"
      data_flow: "dotted #7d3c98 1.5px — artifact passes between pipeline nodes"
  mermaid: |
    %%{init:{
      "theme":"base",
      "themeVariables":{
        "primaryColor":"#1a1a2e","primaryTextColor":"#f0f0f0",
        "primaryBorderColor":"#444","lineColor":"#888",
        "secondaryColor":"#16213e","tertiaryColor":"#0f3460",
        "edgeLabelBackground":"#1a1a2e"
      }
    }}%%
    flowchart TD

      classDef problem   fill:#c0392b,color:#fff,stroke:#922b21,stroke-width:1.5px
      classDef insight   fill:#d68910,color:#fff,stroke:#9a6301,stroke-width:1.5px
      classDef product   fill:#1a6fa8,color:#fff,stroke:#154f7a,stroke-width:1.5px
      classDef actor     fill:#1e8449,color:#fff,stroke:#145a32,stroke-width:1.5px
      classDef output    fill:#7d3c98,color:#fff,stroke:#5b2c6f,stroke-width:1.5px
      classDef business  fill:#117a65,color:#fff,stroke:#0e6655,stroke-width:1.5px
      classDef milestone fill:#5d6d7e,color:#fff,stroke:#424f5c,stroke-width:1.5px

      subgraph S0["① Hook"]
        TAGLINE["Write it. See it. Ship it."]:::insight
        POS["Extends CapCut · bridges to Higgsfield · no learning curve"]:::insight
      end

      subgraph S1["② Problem — The Middle Is Empty"]
        subgraph S1A["Too much"]
          P_STEEP["Node-graph tools — too steep, hours to learn"]:::problem
          P_BLIND["Higgsfield — powerful but context-blind"]:::problem
        end
        subgraph S1B["Too little"]
          P_ONE["CapCut — fast for one · breaks at variants"]:::problem
          P_MEMORY["No brand memory · no locale context · manual re-edit"]:::problem
        end
        P_GAP["Solopreneur stuck in the middle — no tool fits"]:::problem
      end

      subgraph S2["③ ICP — Global Emerging Market Creator"]
        subgraph S2A["Who"]
          ICP_SOLO["Solopreneur / one-person company"]:::actor
          ICP_FREE["Freelancer / independent creator"]:::actor
          ICP_INFL["Influencer / content creator"]:::actor
          ICP_ECOM["E-commerce seller (TikTok Shop, Shopee, Mercado)"]:::actor
        end
        subgraph S2B["Where — fragmented, local-context markets"]
          MKT_SEA["Southeast Asia — ID PH TH VN SG MY"]:::actor
          MKT_LATAM["Latin America — MX BR CO AR"]:::actor
          MKT_MENA["MENA — EG SA AE NG"]:::actor
          MKT_SA["South Asia — IN BD PK"]:::actor
          MKT_US["US — Wild West frontier creators"]:::actor
          MKT_CAR["Caribbean — island creators"]:::actor
        end
        subgraph S2C["Behaviour"]
          GTM_CC["Already on CapCut · hits variant ceiling"]:::actor
          GTM_LOOP["Gets template · runs once · ships N · shares forward"]:::insight
        end
      end

      subgraph S3["④ Insight — Extend, Don't Replace"]
        I_EXT["Knowgrph augments CapCut — not a replacement"]:::insight
        I_MD["Markdown brief = brand memory + local context"]:::insight
        I_AI["AI = orchestrator across text → image → video"]:::insight
        I_AUTO["Upstream change → all variants recompute"]:::insight
        I_POS["CapCut for one video · Knowgrph for sixty"]:::insight
      end

      subgraph S4["⑤ Product — Widget Canvas"]
        subgraph S4A["Core Pipeline"]
          W_TEXT["Text Gen — scene plan + captions"]:::product
          W_IMG["Image Gen — local keyframes"]:::product
          W_VID["Video Gen — 9:16 clip"]:::product
          W_PANEL["Rich Media Panel — preview + export"]:::product
        end
        subgraph S4B["Brief Layers"]
          BR_BRAND["Brand memory — palette · font · tone"]:::output
          BR_LOCALE["Locale — language · cultural context · format"]:::output
          BR_VARIANT["Variant field — swap → full recompute"]:::output
        end
      end

      subgraph S5["⑥ Demo — RoboDrone X1 · Three Skies"]
        DM_US["US · Wild West mesa → ghost mustang stampede"]:::output
        DM_CAR["Caribbean · island tempest → mermaid queen cathedral"]:::output
        DM_SG["SG · Marina Bay → RoboTown AI sentinel"]:::output
        DM_PAR["Parent — safety · flight time · crash-proof"]:::actor
        DM_KID["Child — multiverse portal opens at the horizon"]:::actor
        DM_NODE["Three worlds as canvas nodes · one brief"]:::product
      end

      subgraph S6["⑦ Architecture"]
        A_FE["React 18 + TS + Vite — client-first PWA"]:::product
        A_BP["BytePlus OpenArk + Seed — text · image · video"]:::product
        A_PY["Python parser — NetworkX · DuckDB"]:::product
        A_CF["Cloudflare Pages · Stripe · RxDB"]:::product
      end

      subgraph S7["⑧ Business Model"]
        B_SUB["Workspace subscription"]:::business
        B_USE["Usage-based compute"]:::business
        B_MKT["Template marketplace — locale pipelines"]:::business
      end

      subgraph S8["⑨ Roadmap"]
        R_NOW["Now — brief→video pipeline · BytePlus · Stripe"]:::milestone
        R_NEXT["Next — batch variants · eval harness · templates"]:::milestone
        R_LATER["Later — collab · mobile brief editor · plugins"]:::milestone
      end

      subgraph S9["⑩ The Ask"]
        ASK_DP["Design partners — creators at variant ceiling"]:::actor
        ASK_DIST["Distribution — creator community intros"]:::actor
        ASK_DATA["Real-world locale briefs + templates"]:::output
      end

      %% USER FLOW
      GTM_CC -->|"hits ceiling"| W_PANEL
      ICP_SOLO -->|"writes brief"| W_TEXT
      ICP_ECOM -->|"authors campaign"| W_TEXT
      DM_PAR -->|"buys via"| W_PANEL
      DM_KID -->|"enters world in"| DM_NODE

      %% WORK FLOW
      S0 -.->|"frames"| S1
      S1 -.->|"scopes ICP"| S2
      S2 -.->|"motivates"| S3
      S3 -.->|"enables"| S4
      S4 -.->|"shown by"| S5
      S5 -.->|"runs on"| S6
      S6 -.->|"monetised via"| S7
      S7 -.->|"delivered by"| S8
      S8 -.->|"closes"| S9

      %% DATA FLOW
      BR_BRAND -->|"locked context"| W_TEXT
      BR_LOCALE -->|"locale context"| W_TEXT
      BR_VARIANT -->|"swap → recompute"| W_TEXT
      W_TEXT -->|"text_out"| W_IMG
      W_IMG -->|"imageUrl"| W_VID
      W_VID -->|"videoUrl"| W_PANEL
      A_BP -->|"completions · generations · renders"| W_TEXT
---

# Knowgrph

**Brief in. Campaign out.** A node canvas where Markdown becomes images — and images become video — orchestrated by AI. Built for solo creators who already know CapCut and need to go further without starting over.

> Not a replacement. An extension.

---

## The problem — the middle is empty

Every creator eventually hits a ceiling. The tool that got them here can't take them further.

| | Too sophisticated | Just right | Too simple |
|---|---|---|---|
| **Tool** | Node-graph editors · Higgsfield | **← Knowgrph fits here →** | CapCut |
| **Learning curve** | Hours to days | Minutes | Seconds |
| **Local context** | Possible but manual | Built-in to the brief | None |
| **Variants** | Manual wiring | Swap one field, N exports | Full re-edit |
| **Who it's for** | Technical users | **Solopreneurs · freelancers · creators** | Anyone |

CapCut is fast for one video. It breaks when a creator needs ten — same brand, three markets, two formats. Every variant is a full manual re-edit. No brand memory. No locale context. No pipeline.

Node-graph editors are too steep. Higgsfield is powerful but context-blind — it doesn't know that Eid gifting is not Christmas gifting, that a Wild West frontier aesthetic needs a different energy than a Caribbean island, or that your brand font is not the default.

**Knowgrph is the middle path** — structured enough to scale, simple enough to start in minutes.

---

## Who it's for — global emerging market creators

The ICP is not a geography. It's a situation: **a solo creator, freelancer, or one-person business in a fragmented emerging market who makes content for a local audience and needs local context baked in.**

This person exists in:
- Southeast Asia (Jakarta, Manila, Bangkok, Ho Chi Minh City, Singapore)
- Latin America (Mexico City, São Paulo, Bogotá, Buenos Aires)
- MENA (Cairo, Riyadh, Lagos, Dubai)
- South Asia (Mumbai, Dhaka, Karachi)
- Frontier markets everywhere — including the US creator economy's long tail and the Caribbean

What they share: they already use CapCut. They've hit a ceiling. They want to ship more, faster, without a learning curve. They want a tool that knows their market, their language, their cultural moment — without having to explain it every time.

**They don't want to replace CapCut. They want something that picks up where CapCut stops.**

---

## The insight — extend, don't replace

Knowgrph augments the CapCut workflow. It doesn't compete with it.

A CapCut creator already knows what good video looks like. Knowgrph handles the part that kills them: re-editing the same brief six times by hand for six markets.

If you can write a scene plan as structured Markdown, then:
- **AI becomes the orchestrator** — text node produces localised scene plans, image node renders culturally-grounded keyframes, video node composes the clip
- **The brief becomes brand memory** — palette, font, tone, cultural context, locale — locked once, inherited by every downstream node
- **Upstream change → downstream recompute** — swap one field, every variant updates automatically

```
CapCut creator → hits variant ceiling
→ gets Knowgrph template from a creator group
→ runs once → ships 6 variants
→ shares template forward → new creator joins
```

Template sharing is the distribution loop, same as CapCut templates spread today. Every share is a distribution event.

---

## What it does

One Markdown brief. Three pipeline stages. N variants.

```mermaid
flowchart LR
  subgraph Brief
    MD["Markdown brief\nbrand + locale + shots"]
  end
  subgraph Produce
    MD --> TG["Text Gen\nscene plan + captions"]
    TG --> IG["Image Gen\nlocal keyframes"]
    IG --> VG["Video Gen\n9:16 clip"]
  end
  subgraph Reuse
    VG --> RMP["Rich Media Panel\npreview + export"]
    SWAP["swap variant field"] --> TG
  end
```

The brief carries three locked layers:

```markdown
## Campaign brief · variant: US-WEST
Brand: SkyKids · Palette: amber, sand · Tone: frontier · adventurous
Product: RoboDrone X1 · Age: 8–14 · Price: $49
— parent layer —
Trust: obstacle-sense / 20-min flight / crash-proof shell
— child adventure layer —
Shot 1: boy on mesa cliff, sunrise, drone launches
Shot 2: ghost mustang herd charges across sky-plain above canyon
Shot 3: drone banks through cathedral arch light beams
CTA: "Ship it before school break!" · Format: 9:16 · Platform: TikTok US
```

Swap `variant: US-WEST` → `variant: CARIBBEAN`. Hook rewrites. Keyframes change. Video recomposes. **Zero manual re-edit.**

---

## Demo — RoboDrone X1 · Three Skies

Same drone. Three worlds. Three completely different children. Three completely different reasons a parent buys it.

**US · Wild West frontier mesa**
- Real scene: boy on sandstone cliff at sunrise, canyon below
- Multiverse: ghost mustang herd charges silver across a sky-plain above the canyon; spectral frontier town hangs inverted from the clouds; drone leads the stampede through cathedral light arches
- Parent trust: crash-proof shell, obstacle-sense, 20-min flight
- Hook: *"Lead the ghost herd. Own the frontier."*

**Caribbean · island tempest**
- Real scene: girl on white-sand beach, tropical storm rolling in off turquoise water
- Multiverse: drone punches through the rain wall; mermaid queen rises from the deep — coral crown, bioluminescent scales; drone descends as her herald through a cathedral of lightning-lit coral spires
- Parent trust: waterproof-rated, obstacle-sense, crash-proof shell
- Hook: *"Fly the tempest. Serve the queen."*

**Singapore · Marina Bay → RoboTown**
- Real scene: girl on Marina Bay promenade at blue-hour dusk
- Multiverse: Merlion morphs to 100m chrome AI sentinel with amber scanning eyes; city becomes RoboTown — sensor arrays, drone corridors, neural grid bay; girl's drone ascends to command position
- Parent trust: precision sensors, 20-min flight, crash-proof shell
- Hook: *"Command the future. Your city. Your drone."*

**Canvas reveal:** pull-back from SG command position — three locale scenes materialise as glowing nodes on a dark canvas, connected by luminous bezier threads. Three parent silhouettes at each node base. A cursor hovers. One brief. Three multiverses.

---

## Architecture

Client-first. The browser handles parsing, rendering, and orchestration. AI APIs called directly from the canvas. No heavy backend required.

```mermaid
flowchart LR
  MD[Markdown brief] --> FC[Flow Editor Canvas]
  FC --> BP["BytePlus OpenArk\nchat · image · video · Seed"]
  BP --> RMP[Rich Media Panel]
  FC --> RMP
  RMP --> EXP["Export: MP4 / PNG / JSON"]
```

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 |
| 2D / 3D | D3.js · Three.js + R3F |
| Markdown | markdown-it + Mermaid + KaTeX |
| AI runtime | BytePlus OpenArk (chat · image) + Seed (video) |
| Local DB | RxDB — offline-first |
| Parsers | Python 3.10+ — NetworkX · DuckDB |
| Payments | Stripe — subscription + usage |
| Deployment | Cloudflare Pages (PWA) — airvio.co/knowgrph |

Shell: ~248 KB gzip. Monaco, Mermaid, Three.js lazy-loaded.

---

## Business model

**Workspace subscription** — canvas, collaboration, storage, template library.  
**Usage-based compute** — per-image and per-second pricing with explicit budget caps. No surprise bills.  
**Template marketplace** — creators sell locale-aware pipeline templates; buyers get a proven brief-to-video workflow, not just a prompt.

---

## Roadmap

**Now** — brief→video pipeline, BytePlus OpenArk + Seed, Flow Editor Canvas, Stripe gating  
**Next** — batch variant generation, eval harness, scene template library, MCP server  
**Later** — mobile-first brief editor (form UI over Markdown), real-time collaboration, plugin system

---

## The ask

**Design partners** — solo creators and freelancers who've hit the CapCut ceiling and are shipping content across 2+ markets or languages.  
**Distribution intros** — creator community leads, influencer networks, TikTok Shop / Shopee seller communities in any emerging market.  
**Locale briefs** — real-world campaign specs to encode as Markdown pipelines and seed the template marketplace.

If you believe video creation should be as reusable as code — declarative, local-aware, automatable — let us build it together.

---

**Demo:** airvio.co/knowgrph  

> *"Write it. See it. Ship it."*