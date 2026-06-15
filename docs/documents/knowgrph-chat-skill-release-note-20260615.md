# Knowgrph Chat Skill Release Note 2026-06-15

## Summary

Knowgrph shipped the chat skill prompt modularization update from the Dev source repo through the generated Prod mirror and into the live Cloudflare Pages route.

- Source repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- Publish repo: `/Users/huijoohwee/Documents/GitHub/huijoohwee`
- Prod mirror: `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- Live route: `https://airvio.co/knowgrph/`

## Shipped Change

- Extracted chat skill prompt ownership into the dedicated `chatSkillRegistry` source owner.
- Kept FloatingPanel Chat submit and footer surfaces aligned with the new skill registry owner.
- Added focused source-level regression coverage for the modularized chat skill prompt path.
- Refreshed the generated technical-architecture document as part of the release build path.

## Commits

- Source repo `knowgrph`
  - `fcd0ea5f` `feat: modularize chat skill prompt handling`
- Publish repo `huijoohwee`
  - `f0422135` `chore: sync knowgrph production publish`

## Deployment

- Canonical deploy command:

```bash
cd /Users/huijoohwee/Documents/GitHub/knowgrph
npm run pages:deploy-cloudflare
```

- Cloudflare Pages preview URL returned by the deploy:
  - `https://84f45986.joohwee.pages.dev`
- Live route served after deploy:
  - `https://airvio.co/knowgrph/`

## Verification

### Build and mirror

```bash
cd /Users/huijoohwee/Documents/GitHub/knowgrph
npm run build
npm run pages:check-sync
```

Expected result:

```text
[knowgrph] publish sync is up to date
```

### Live route proof

```bash
curl -I -L --max-redirs 5 https://airvio.co/knowgrph
curl -I -L --max-redirs 5 https://airvio.co/knowgrph/
```

Expected result:

```text
https://airvio.co/knowgrph  -> 308
https://airvio.co/knowgrph/ -> 200
```

### Docs seed proof

The deploy also ran the bundled storage-doc seeding step:

```text
[knowgrph] push complete: applied=37, conflict=0, rejected=0
[knowgrph] export verification: documents=37
```

## Source Of Truth

- Chat skill registry owner:
  - `canvas/src/features/chat/chatSkillRegistry.ts`
- FloatingPanel Chat shell:
  - `canvas/src/features/chat/FloatingPanelChat.tsx`
- FloatingPanel Chat sections:
  - `canvas/src/features/chat/FloatingPanelChatSections.tsx`
- Submit request owner:
  - `canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest.ts`
- Publish topology owner:
  - `docs/documents/knowgrph-cross-repo-publish-topology.md`

## Guardrails

- Do not hand-edit mirrored publish output under `huijoohwee/content/knowgrph`; regenerate it from `knowgrph`.
- Do not hand-patch the AgenticRAG docs map; regenerate it from canonical `docs/documents/**` sources.
- Do not treat the Cloudflare Pages preview URL as the long-term SSOT route when the canonical public route is `https://airvio.co/knowgrph/`.
