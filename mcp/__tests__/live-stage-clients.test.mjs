// Tests for the LIVE stage clients (task 12.4): BytePlus storyboard (usable now,
// wired through the async runStoryboardHarness), and the Strytree render +
// Stripe commerce SCAFFOLDS (correct seam shape, fail-closed). ZERO live calls —
// a fake `fetch` backs every client.

import test from "node:test";
import assert from "node:assert/strict";

import {
  createByteplusStoryboardClient,
  parseStoryboardCompletion,
  createStrytreeRenderQueueClient,
  createStripeCommerceClients,
  StoryboardClientError,
  RenderClientError,
  CommerceClientError,
} from "../video-remix/live-stage-clients.js";
import { runStoryboardHarness } from "../video-remix/storyboard-harness.js";
import { resolveStageClients } from "../video-remix/live-clients.js";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    status,
    headers: { get: () => "application/json" },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function chatCompletion(shots) {
  return {
    choices: [{ message: { content: JSON.stringify({ shots }) } }],
  };
}

// ── Storyboard completion parsing ───────────────────────────────────────────

test("parseStoryboardCompletion: maps choices[0].message.content JSON to shots", () => {
  const shots = parseStoryboardCompletion(
    chatCompletion([
      { prompt: "scene 1", sourceCardIds: ["s-1"] },
      { prompt: "scene 2", sourceCardIds: [] },
    ]),
  );
  assert.equal(shots.length, 2);
  assert.equal(shots[0].prompt, "scene 1");
  assert.deepEqual(shots[0].sourceCardIds, ["s-1"]);
});

// ── Storyboard live client (USABLE NOW via async harness) ───────────────────

test("createByteplusStoryboardClient: posts a chat completion and returns shots", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return jsonResponse(chatCompletion([{ prompt: "a", sourceCardIds: ["s-1"] }]));
  };
  const client = createByteplusStoryboardClient({
    fetchImpl,
    endpoint: "https://gateway.ai.cloudflare.com/v1/acct/gw/chat/completions",
    model: "skylark-chat",
    apiKey: "byteplus-key",
  });

  const out = await client.plan({ brief: "Promo", sourceIds: ["s-1"], shotCount: 1 });

  assert.equal(client.isDeterministicMock, false);
  assert.equal(client.requiresAsyncHarness, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, "skylark-chat");
  assert.equal(out.shots.length, 1);
});

test("createByteplusStoryboardClient: throws (→ harness fallback) on HTTP error", async () => {
  const client = createByteplusStoryboardClient({
    fetchImpl: async () => jsonResponse({ error: "x" }, { status: 500 }),
    endpoint: "https://gw/chat/completions",
  });
  await assert.rejects(
    () => client.plan({ brief: "b", sourceIds: [], shotCount: 1 }),
    (err) => err instanceof StoryboardClientError,
  );
});

test("createByteplusStoryboardClient: throws when unconfigured (no endpoint)", async () => {
  const client = createByteplusStoryboardClient({ fetchImpl: async () => jsonResponse({}) });
  await assert.rejects(() => client.plan({ brief: "b", sourceIds: [], shotCount: 1 }));
});

test("runStoryboardHarness consumes the live storyboard client and emits a valid Kgc_Document", async () => {
  const evidencePack = {
    sources: [
      { sourceId: "s-1", url: "https://a.example/1" },
      { sourceId: "s-2", url: "https://b.example/2" },
      { sourceId: "s-3", url: "https://c.example/3" },
    ],
  };
  const fetchImpl = async () =>
    jsonResponse(
      chatCompletion([
        { prompt: "scene 1", sourceCardIds: ["s-1"] },
        { prompt: "scene 2", sourceCardIds: ["s-2"] },
      ]),
    );
  const chatClient = createByteplusStoryboardClient({
    fetchImpl,
    endpoint: "https://gw/chat/completions",
  });

  const result = await runStoryboardHarness(
    { brief: "Promo remix", evidencePack, shotCount: 2 },
    { chatClient },
  );

  assert.equal(result.status, "complete");
  assert.equal(result.schemaValid, true);
  assert.equal(result.flow.nodes.length, 2, "one node per planned shot");
  assert.equal(result.fallbackSubstituted, false);
});

test("runStoryboardHarness falls back to a single node when the live client fails", async () => {
  const evidencePack = { sources: [{ sourceId: "s-1", url: "https://a.example/1" }] };
  const chatClient = createByteplusStoryboardClient({
    fetchImpl: async () => jsonResponse({ error: "down" }, { status: 502 }),
    endpoint: "https://gw/chat/completions",
  });
  const result = await runStoryboardHarness(
    { brief: "Promo", evidencePack, shotCount: 3 },
    { chatClient },
  );
  assert.equal(result.status, "fallback");
  assert.equal(result.fallbackSubstituted, true);
  assert.equal(result.flow.nodes.length, 1, "single-node fallback (R7.5)");
});

// ── Render scaffold (correct seam shape, fail-closed) ───────────────────────

test("createStrytreeRenderQueueClient: dispatches and maps an asset (scaffold)", async () => {
  const client = createStrytreeRenderQueueClient({
    fetchImpl: async () => jsonResponse({ assetUrl: "https://r2/asset.mp4", costCents: 42, provider: "byteplus-video" }),
    endpoint: "https://pay/render",
  });
  assert.equal(client.requiresAsyncHarness, true, "flags the async-harness follow-up");
  const out = await client.dispatch({ shot: { shotId: "shot-1", prompt: "p" }, runId: "run-1" });
  assert.equal(out.assetUrl, "https://r2/asset.mp4");
  assert.equal(out.costCents, 42);
});

test("createStrytreeRenderQueueClient: throws on a no-asset response (→ R8.6 fallback)", async () => {
  const client = createStrytreeRenderQueueClient({
    fetchImpl: async () => jsonResponse({ costCents: 0 }),
    endpoint: "https://pay/render",
  });
  await assert.rejects(
    () => client.dispatch({ shot: { shotId: "shot-1" }, runId: "run-1" }),
    (err) => err instanceof RenderClientError,
  );
});

// ── Commerce scaffold (correct seam shape, fail-closed) ─────────────────────

test("createStripeCommerceClients: creates a session, settles, and publishes (scaffold)", async () => {
  const clients = createStripeCommerceClients({
    fetchImpl: async (url) => {
      if (url.endsWith("/checkout/session")) return jsonResponse({ id: "cs_live_1", amount_total: 500, currency: "usd" });
      if (url.endsWith("/payout/settle")) return jsonResponse({ settled: true, payoutState: "settled" });
      if (url.endsWith("/publish")) return jsonResponse({ publishedUrl: "https://cdn/pub.mp4" });
      return jsonResponse({});
    },
    endpoint: "https://pay.example",
  });
  assert.equal(clients.requiresAsyncHarness, true);

  const created = await clients.stripeClient.createCheckoutSession({ runId: "r", assetUrl: "https://a/x.mp4" });
  assert.equal(created.session.id, "cs_live_1");
  assert.equal(created.session.amountTotal, 500);

  const settled = await clients.payoutClient.settle({ sessionId: "cs_live_1", runId: "r" });
  assert.equal(settled.settled, true);

  const pub = await clients.publishClient.publish({ asset: { assetUrl: "https://a/x.mp4" }, runId: "r" });
  assert.equal(pub.publishedUrl, "https://cdn/pub.mp4");
});

test("createStripeCommerceClients: session create with no id throws (→ R9.4)", async () => {
  const clients = createStripeCommerceClients({
    fetchImpl: async () => jsonResponse({ amount_total: 100 }),
    endpoint: "https://pay.example",
  });
  await assert.rejects(
    () => clients.stripeClient.createCheckoutSession({ runId: "r", assetUrl: "https://a/x.mp4" }),
    (err) => err instanceof CommerceClientError,
  );
});

// ── resolveStageClients surfaces the live clients per-credential ────────────

test("resolveStageClients: populates storyboard/render/commerce slots when endpoints are set", () => {
  const clients = resolveStageClients(
    {
      KNOWGRPH_LIVE_CLIENTS: "1",
      AI_GATEWAY_CHAT_URL: "https://gw/chat/completions",
      STRYTREE_RENDER_URL: "https://pay/render",
      KNOWGRPH_PAYMENT_URL: "https://pay.example",
    },
    { fetchImpl: async () => jsonResponse({}) },
  );
  assert.equal(clients.live, true);
  assert.ok(clients.storyboardClient && clients.storyboardClient.isDeterministicMock === false);
  assert.ok(clients.renderClient && clients.renderClient.requiresAsyncHarness === true);
  assert.ok(clients.commerceClient && clients.commerceClient.requiresAsyncHarness === true);
});

test("resolveStageClients: live with no stage endpoints leaves stage slots null (mock fallback)", () => {
  const clients = resolveStageClients({ KNOWGRPH_LIVE_CLIENTS: "1" }, { fetchImpl: async () => jsonResponse({}) });
  assert.equal(clients.live, true);
  assert.ok(clients.exaClient, "exa is hosted-free capable");
  assert.equal(clients.storyboardClient, null);
  assert.equal(clients.renderClient, null);
  assert.equal(clients.commerceClient, null);
});
