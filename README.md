---
title: "Knowgrph — AI-assisted Programmatic Video Generation"
id: md:knowgrph-pitchdeck
author: joohwee
institution: "Knowgrph — airvio.co/knowgrph"
date: "2026-04-28"
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
      user_flow: "solid #2980b9  2px  — actor interacts with / uses product surface"
      work_flow: "dashed #d68910 2px  — pitch section narrative progression"
      data_flow: "dotted #7d3c98 1.5px — artifact / data passes between pipeline nodes"
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

      %% ════ NODE CLASS DEFINITIONS ════════════════════════════════
      classDef problem   fill:#c0392b,color:#fff,stroke:#922b21,stroke-width:1.5px
      classDef insight   fill:#d68910,color:#fff,stroke:#9a6301,stroke-width:1.5px
      classDef product   fill:#1a6fa8,color:#fff,stroke:#154f7a,stroke-width:1.5px
      classDef actor     fill:#1e8449,color:#fff,stroke:#145a32,stroke-width:1.5px
      classDef output    fill:#7d3c98,color:#fff,stroke:#5b2c6f,stroke-width:1.5px
      classDef business  fill:#117a65,color:#fff,stroke:#0e6655,stroke-width:1.5px
      classDef milestone fill:#5d6d7e,color:#fff,stroke:#424f5c,stroke-width:1.5px

      %% ════ S0 · HOOK ═════════════════════════════════════════════
      subgraph S0["① Hook"]
        TAGLINE["Write it. See it. Ship it."]:::insight
        CANVAS_IS["Canvas = product · AI = runtime"]:::insight
      end

      %% ════ S1 · PROBLEM ══════════════════════════════════════════
      subgraph S1["② Problem — CapCut Ceiling"]
        subgraph S1A["Creator pain"]
          P_VARIANT["Variant tax — 5 langs × 3 SKUs = 15 re-edits"]:::problem
          P_MEMORY["No brand memory — resets every project"]:::problem
          P_MANUAL["Timeline-first — not automatable"]:::problem
        end
        subgraph S1B["Tool gap"]
          P_STEEP["Node-graph tools — too steep"]:::problem
          P_BLIND["Higgsfield — context-blind, one-click only"]:::problem
          P_TABS["3 disconnected tabs, context lost at handoff"]:::problem
        end
      end

      %% ════ S2 · MARKET ═══════════════════════════════════════════
      subgraph S2["③ Market — SEA Creator Economy"]
        subgraph S2A["Geography"]
          MKT_SEA["SEA — 500M social users"]:::actor
          MKT_ID["Indonesia · TikTok Shop"]:::actor
          MKT_PH["Philippines · Shopee"]:::actor
          MKT_TH["Thailand · LINE / TikTok"]:::actor
          MKT_VN["Vietnam · TikTok / Zalo"]:::actor
          MKT_SG["Singapore · aspirational tier"]:::actor
        end
        subgraph S2B["Segments"]
          SEG_CREATOR["Micro-influencers / digital creators"]:::actor
          SEG_ECOM["E-commerce sellers"]:::actor
          SEG_BRAND["Brand marketing teams"]:::actor
        end
        subgraph S2C["Existing behaviour"]
          GTM_CC["CapCut-native mobile creators"]:::actor
          GTM_LOOP["Share template → hit ceiling → Knowgrph"]:::insight
        end
      end

      %% ════ S3 · INSIGHT ══════════════════════════════════════════
      subgraph S3["④ Insight — The Middle Path"]
        I_MD["Markdown = control plane"]:::insight
        I_AI["AI = orchestrator (not sidebar)"]:::insight
        I_WIDGET["Widgets = compiled pipeline stages"]:::insight
        I_SSOT["Brief = brand memory + local context"]:::insight
        I_DEPS["Upstream change → downstream recompute"]:::insight
        I_POS["CapCut for one video · Knowgrph for sixty"]:::insight
      end

      %% ════ S4 · PRODUCT ══════════════════════════════════════════
      subgraph S4["⑤ Product — Widget Canvas"]
        subgraph S4A["Core Pipeline Widgets"]
          W_TEXT["Text Gen widget"]:::product
          W_IMG["Image Gen widget"]:::product
          W_VID["Video Gen widget"]:::product
          W_PANEL["Rich Media Panel"]:::product
        end
        subgraph S4B["Canvas Surfaces"]
          L_FLOW["Flow Editor Canvas"]:::product
          L_MD["Markdown Workspace / Brief Editor"]:::product
          L_CHAT["Side Panel Chat"]:::product
          L_2D["2D Graph Canvas — D3"]:::product
          L_3D["3D Canvas — Three.js"]:::product
          L_GEO["Geospatial — MapLibre"]:::product
        end
        subgraph S4C["Brief Structure"]
          BR_BRAND["Brand memory — palette · font · tone"]:::output
          BR_LOCALE["Locale layer — language · cultural calendar · format"]:::output
          BR_VARIANT["Variant field — swap market → full recompute"]:::output
        end
      end

      %% ════ S5 · WORKFLOW ═════════════════════════════════════════
      subgraph S5["⑥ End-to-End Workflow"]
        subgraph S5A["INGEST"]
          WF_SRC["MD brief — brand + locale + shots"]:::product
          WF_PARSE["Parser + Validator"]:::product
          WF_GD[("GraphData SSOT")]:::output
        end
        subgraph S5B["PRODUCE"]
          WF_TG["Text Gen — scene plan + localised captions"]:::product
          WF_IG["Image Gen — culturally-grounded keyframes"]:::product
          WF_VG["Video Gen — 9:16 TikTok-ready clip"]:::product
        end
        subgraph S5C["REUSE"]
          WF_RMP["Rich Media Panel — preview + scrub"]:::product
          WF_BRANCH["Variant branch — swap one field, N exports"]:::product
          WF_EXP["Export: MP4 / PNG / JSON / HTML"]:::output
        end
      end

      %% ════ S6 · ARCHITECTURE ═════════════════════════════════════
      subgraph S6["⑦ Architecture"]
        subgraph S6A["Frontend — React 18 + TS + Vite"]
          A_FC["Flow Editor Canvas"]:::product
          A_MC["Markdown Workspace"]:::product
          A_RMP["Rich Media Panel"]:::product
          A_ZU["Zustand state slices"]:::product
        end
        subgraph S6B["AI Runtime — BytePlus"]
          A_CHAT["OpenArk Chat — seed-2-0-lite"]:::product
          A_IMG["OpenArk Image — seedream-4-0"]:::product
          A_VID["Seed Video — seedance-1-0-pro"]:::product
        end
        subgraph S6C["Parser Engine — Python"]
          A_KG["NetworkX Knowledge Graph"]:::product
          A_GN["Graph Normalizer — DuckDB / RDFLib"]:::product
        end
        subgraph S6D["Infra"]
          A_CF["Cloudflare Pages — PWA"]:::product
          A_STR["Stripe — subscription + usage billing"]:::business
          A_RXD["RxDB — offline-first local store"]:::product
        end
      end

      %% ════ S7 · DEMO ═════════════════════════════════════════════
      subgraph S7["⑧ Multiverse Demo — RoboDrone X1"]
        subgraph S7A["Locale Briefs — real scene + imagination layer"]
          DM_VN["VN · paddy field → rice spirit village"]:::output
          DM_PH["PH · mango grove → floating island kingdom"]:::output
          DM_TH["TH · water market → neon sky-barge arena"]:::output
          DM_ID["ID · island coast → sea serpent canyon battle"]:::output
          DM_SG["SG · Marina Bay → RoboTown AI sentinel"]:::output
        end
        subgraph S7B["Dual Audience Layer"]
          DM_PAR["Parent — trust signals: safety · flight time · crash-proof"]:::actor
          DM_KID["Child — multiverse adventure scene"]:::actor
        end
        subgraph S7C["Canvas Reveal"]
          DM_NODE["Five locale scenes as canvas nodes"]:::product
          DM_CURSOR["Cursor hovers — pipeline visible"]:::insight
        end
      end

      %% ════ S8 · DIFFERENTIATION ══════════════════════════════════
      subgraph S8["⑨ Differentiation"]
        D_CC["CapCut — one video, manual variants"]:::problem
        D_HF["Higgsfield — one click, context-blind"]:::problem
        D_STEEP["Node-graph editors — full control, no creators"]:::problem
        D_US["Knowgrph — automatable · inspectable · local-aware"]:::insight
        D_EDGE["The seam between stages is the product"]:::insight
      end

      %% ════ S9 · TECH STACK ═══════════════════════════════════════
      subgraph S9["⑩ Tech Stack"]
        subgraph S9A["Frontend"]
          T_REACT["React 18 + TypeScript + Vite 6"]:::product
          T_D3["D3.js — 2D force graph"]:::product
          T_THREE["Three.js + R3F — 3D WebGL"]:::product
          T_MAP["MapLibre GL JS — geospatial"]:::product
          T_MON["Monaco Editor — code"]:::product
          T_MD["markdown-it + Mermaid + KaTeX"]:::product
        end
        subgraph S9B["Backend + Infra"]
          T_PY["Python 3.10+ — NetworkX · RDFLib · DuckDB"]:::product
          T_RXD["RxDB — offline-first"]:::product
          T_CF["Cloudflare Pages — PWA · R2 · AI Gateway"]:::product
          T_STR["Stripe — subscription + usage"]:::business
          T_MCP["@modelcontextprotocol/sdk"]:::product
        end
      end

      %% ════ S10 · BUSINESS MODEL ══════════════════════════════════
      subgraph S10["⑪ Business Model"]
        B_SUB["Workspace subscription — canvas · storage · templates"]:::business
        B_USE["Usage-based compute — per-image · per-second"]:::business
        B_MKT["Template marketplace — locale pipeline templates"]:::business
        B_ENT["Enterprise — SSO · audit logs · on-prem"]:::business
      end

      %% ════ S11 · ROADMAP ═════════════════════════════════════════
      subgraph S11["⑫ Roadmap"]
        subgraph S11A["Now — shipping"]
          R_CORE["MD→widget orchestration · BytePlus integration"]:::milestone
          R_FLOW["Flow Editor Canvas · widget registry · Stripe"]:::milestone
        end
        subgraph S11B["Next"]
          R_BATCH["Batch variant generation · eval harness"]:::milestone
          R_TMPL["Scene template + subgraph library"]:::milestone
          R_MCP["MCP server — AI-IDE canvas control"]:::milestone
        end
        subgraph S11C["Later"]
          R_COLLAB["Real-time collab — WebSocket + CRDT"]:::milestone
          R_PLUG["Plugin system — sandboxed widget extensions"]:::milestone
          R_AUDIO["Multi-track — audio stems · captions · overlays"]:::milestone
        end
      end

      %% ════ S12 · ASK ═════════════════════════════════════════════
      subgraph S12["⑬ The Ask"]
        ASK_DP["Design partners — CapCut creators at variant ceiling"]:::actor
        ASK_FB["Domain feedback — brand guidelines · locale constraints"]:::actor
        ASK_DATA["Real-world briefs + locale templates"]:::output
        ASK_DIST["Distribution intros — SEA creator communities"]:::actor
      end

      %% ════ USER FLOW EDGES — solid #2980b9 ═══════════════════════
      %% actor → product surface interactions
      GTM_CC -->|"hits variant ceiling"| L_MD
      SEG_CREATOR -->|"writes brief"| L_MD
      SEG_ECOM -->|"authors campaign"| L_MD
      SEG_BRAND -->|"scripts pipeline"| L_FLOW
      DM_PAR -->|"buys drone via"| W_PANEL
      DM_KID -->|"imagines world in"| DM_NODE
      ASK_DP -->|"validates product with"| W_PANEL

      %% ════ WORK FLOW EDGES — dashed #d68910 ══════════════════════
      %% narrative section progression
      S0 -.->|"frames problem"| S1
      S1 -.->|"scopes market"| S2
      S2 -.->|"motivates insight"| S3
      S3 -.->|"enables product"| S4
      S4 -.->|"executes workflow"| S5
      S5 -.->|"runs on"| S6
      S4 -.->|"demonstrated by"| S7
      S7 -.->|"validated against"| S8
      S8 -.->|"built with"| S9
      S9 -.->|"monetised via"| S10
      S10 -.->|"delivered by"| S11
      S11 -.->|"closes with"| S12

      %% ════ DATA FLOW EDGES — dotted #7d3c98 ══════════════════════
      %% artifact / data passing through pipeline nodes
      WF_SRC -->|"raw brief"| WF_PARSE
      WF_PARSE -->|"validated graph"| WF_GD
      WF_GD -->|"schema pass"| WF_TG
      WF_TG -->|"text_out · scene plan"| WF_IG
      WF_IG -->|"imageUrl · keyframes"| WF_VG
      WF_VG -->|"videoUrl · 9:16 clip"| WF_RMP
      WF_TG -->|"text_out"| WF_RMP
      WF_IG -->|"imageUrl"| WF_RMP
      WF_BRANCH -->|"variant field swap"| WF_TG
      WF_RMP -->|"export trigger"| WF_EXP
      BR_BRAND -->|"locked context"| WF_SRC
      BR_LOCALE -->|"locale context"| WF_SRC
      BR_VARIANT -->|"market swap"| WF_BRANCH
      W_TEXT -->|"text_out → prompt_in"| W_IMG
      W_IMG -->|"imageUrl → reference_image"| W_VID
      W_VID -->|"videoUrl"| W_PANEL
      A_CHAT -->|"completions"| W_TEXT
      A_IMG -->|"generations"| W_IMG
      A_VID -->|"renders"| W_VID
---

# Knowgrph

**AI-assisted programmatic video generation.** A widget-based canvas where AI-orchestrated Markdown responses become images — and images become video.

> The canvas is the product. The AI is the runtime.

---

## The problem

Video production is still timeline-first, which makes it slow, hard to automate, hard to audit, and hard to scale. Teams want video to behave like software: versioned, testable, composable, diffable.

Today's toolchain gives you three disconnected tabs — a chat window, an image generator, a timeline editor — and every handoff loses context.

---

## The insight

If you can represent a scene plan as structured Markdown, then:

- **AI becomes the orchestrator** — not just a chat sidebar, but the runtime that drives each stage
- **Widgets become compiled stages** — text node produces structured narrative; image node renders keyframes; video node composes clips
- **The canvas becomes a single source of truth** for prompts, intermediate artifacts, final outputs, and provenance

Markdown is the control plane. Media generation is the data plane.

Every connection on the canvas is an explicit data dependency. Change one prompt upstream, and all downstream nodes re-execute automatically.

---

## What we are building

Knowgrph is a widget-based node canvas for AI-assisted media pipelines — where the entire text → image → video workflow lives as an inspectable, executable graph.

| Widget | Role | Output |
|---|---|---|
| Text Generation | AI produces structured scene plans, shot lists, captions from Markdown brief | Structured text |
| Image Generation | Renders keyframes, storyboards, overlays from plan-derived prompts | Image URL |
| Video Generation | Composes images + motion prompts into clips with resolution, duration, audio | Video URL |
| Rich Media Panel | Canonical preview surface for all outputs | Rendered preview |

---

## The workflow (end-to-end)

```mermaid
flowchart LR
  subgraph Ingest ["1. INGEST"]
    MD[Markdown brief] --> P[Parser]
  end
  subgraph Produce ["2. PRODUCE"]
    P --> TG[Text Gen]
    TG --> IG[Image Gen]
    IG --> VG[Video Gen]
  end
  subgraph Reuse ["3. REUSE"]
    TG --> RMP[Rich Media Panel]
    IG --> RMP
    VG --> RMP
    RMP --> EXP[Export: JSON / PNG / HTML / MP4]
  end
```

---

## Architecture

```mermaid
flowchart TB
  subgraph Frontend ["Canvas App (React + Vite + TS)"]
    FC[Flow Editor Canvas]
    GC[Graph Canvas]
    MC[Markdown Workspace]
    RMP[Rich Media Panel]
    SP[Side Panel Chat]
  end
  subgraph AI ["AI Providers"]
    BPChat[Text API]
    BPImg[Image API]
    BPVid[Video API]
  end
  subgraph Backend ["Parser Engine (Python)"]
    KB[Knowledge Graph Builder]
    GP[Graph Data Normalizer]
  end
  FC --> SP --> BPChat
  FC --> BPImg
  FC --> BPVid
  FC --> RMP
  MC --> Frontend
```

Key principle: **Client-First.** The browser handles parsing, rendering, and orchestration — AI APIs called directly from the canvas via serverless endpoints.

---

## System design — INGEST / PRODUCE / REUSE

```mermaid
flowchart LR
  subgraph INGEST
    SRC[MD / JSON / CSV / PDF / HTML / URL] --> LD[Loaders]
    LD --> VAL[Validator]
    VAL --> GD[(GraphData SSOT)]
  end
  subgraph PRODUCE
    GD --> SCH[Schema Engine]
    SCH --> DER[Deriver]
  end
  subgraph REUSE
    DER --> R2D[2D Renderer — D3 SVG]
    DER --> R3D[3D Renderer — Three.js]
    DER --> RFLOW[Flow Editor]
    R2D & R3D & RFLOW --> EXP[Exporters]
  end
```

Six design principles: Client-First, Performance, Neutrality, Modularity, Observability, Scalability (10k+ nodes).

---

## Why the canvas matters

The canvas transforms a "creative" into an explicit directed graph of stages — giving media creation software-like guarantees:

- **Reproducibility** — same Markdown + same parameters + same seed = identical artifacts
- **Traceability** — every output carries upstream provenance
- **Composable reuse** — save subgraphs as templates; wire into new pipelines in one click
- **Safe iteration** — diff a single prompt without breaking the project; downstream nodes re-execute
- **Variant branching** — one brief branches into style variants without duplicating work

---

## Differentiation

| Approach | Strength | Weakness |
|---|---|---|
| Timeline editors (Premiere, CapCut) | Fine-grained control | Not automatable; variants = manual labor |
| Prompt-only image tools | Fast single output | No pipeline; poor reproducibility |
| Agent chains (LangGraph, n8n) | Flexible reasoning | Hard to visually inspect |
| **Knowgrph** | **Automatable + Inspectable + Reusable + Visual** | Requires template discipline; early-stage UX |

The canvas is the build log.

---

## Target users

- **Growth & marketing teams** — campaign variants at scale: 10 languages × 3 CTAs × 2 styles = 60 videos from one Markdown brief
- **Product teams** — feature launch explainers, onboarding walkthroughs from PRDs
- **Education creators** — course clips, lesson summaries from structured lesson Markdown
- **Internal comms** — weekly update videos generated from status Markdown
- **Developers & DevRel** — programmatic media as part of CI/CD: docs → diagrams → explainer videos on every merge

Common thread: teams needing many videos with consistent structure and zero-friction iteration.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 6 |
| State | Zustand (slice-based stores) |
| 2D visualization | D3.js force-directed + ELK/Dagre layouts |
| 3D visualization | Three.js + @react-three/fiber (WebGL) |
| Geospatial | MapLibre GL JS + Turf.js |
| Code editing | Monaco Editor |
| Markdown engine | markdown-it + remark/rehype + Mermaid + KaTeX |
| Local DB | RxDB (offline-first) |
| Backend parsers | Python 3.10+ (NetworkX, RDFLib, DuckDB, NLTK) |
| AI providers | BytePlus OpenArk + OpenAI Responses API |
| Payments | Stripe (subscriptions, usage-based billing) |
| MCP protocol | @modelcontextprotocol/sdk |
| Deployment | Cloudflare Pages (PWA) — airvio.co/knowgrph |

Shell size: ~248 KB gzip; Monaco, Mermaid, Three.js lazy-loaded on demand.

---

## Business model

- **Workspace subscription** — authoring canvas, collaboration, storage, template library
- **Usage-based compute** — per-image and per-second-of-output pricing with budget caps
- **Template marketplace** (future) — branded subgraph templates sold per pipeline
- **Enterprise tier** — SSO/SAML, audit logs, on-prem/VPC, policy controls

Principle: cost and quality fully predictable with explicit, user-visible parameters.

---

## Roadmap

**Now (shipping)**
- Markdown-to-widget orchestration via frontmatter flow parser
- BytePlus OpenArk integration (chat, image, video)
- Flow Editor Canvas with widget registry, port handles, typed envelopes
- Stripe paywall and subscription gating

**Next**
- Scene templates + subgraph library
- Batch variant generation
- Evaluation harness (quality, brand compliance, regression)
- MCP server enhancement for AI-IDE canvas control

**Later**
- Multi-track composition (audio stem, captions, overlays)
- Real-time collaboration (WebSocket + CRDT)
- Plugin system (sandboxed custom widget extensions)

---

## The ask

- **Design partners** — teams generating video content variants weekly frustrated by timeline-tool friction
- **Domain feedback** — brand guidelines, compliance review, localization workflow constraints
- **Real-world data** — briefs, creative specs, existing output templates to encode as Markdown pipelines
- **Distribution intros** — growth teams, product marketing leads, education creators, DevRel communities

If you believe video creation should feel like writing software — declarative, versionable, composable, inspectable — let us build it together.

---

**Live demo**: airvio.co/knowgrph
**Contact**: joohwee @ airvio.co

> *"Write it. See it. Ship it."*