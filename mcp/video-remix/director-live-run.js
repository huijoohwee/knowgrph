// Async Director live stage-execution path (knowgrph-acos-mcp-connector spec,
// task 12.5a). Composes the already-verified Director gate enforcers
// (`enforceDirectorRenderGate` / `enforceDirectorCheckoutGate`, which call the
// async harness variants from task 12.4a) with the env-gated live-client → deps
// mapping (`resolveGateClientDeps`, task 12.5) into ONE async entry point that
// executes the gated render → checkout spend boundaries against LIVE clients
// when configured, and against the deterministic mocks otherwise.
//
// WHY THIS IS SEPARATE FROM `runVideoRemix`: the synchronous `runVideoRemix`
// builds the planning Run_Manifest (validation, approval gates, evidence,
// storyboard, planned shots, dry-run/halt resolution) and SYNTHESIZES the
// render/checkout artifacts — it is the single source of truth for the contract
// tests and the dry-run/gated-halt behavior, and stays synchronous. This module
// is the DEPLOYED, approval-gated EXECUTION layer that runs on top of that base
// manifest: given verified Approval_Tokens it executes the real spend-bearing
// stages and merges the results back into the manifest. It performs ZERO live
// network calls unless a live client is injected via `clients` (env-resolved by
// `resolveStageClients`), so it is fully unit-testable with mocks.
//
// Boundary preserved (R4.2 / R4.3 / R9.3 / Property 1 / Property 17): the gate
// enforcers own the single spend-boundary verification; a missing/invalid token
// blocks the stage, records the rejection, and leaves spend-bearing state
// unchanged. This module never re-verifies and never bypasses a gate.

import {
  enforceDirectorRenderGate,
  enforceDirectorCheckoutGate,
} from "./director-gates.js";
import { resolveGateClientDeps } from "./live-clients.js";

/**
 * Derive the planned shots the render stage dispatches from a Run_Manifest's
 * storyboard. The storyboard flow nodes (one per planned shot, R7.2) carry the
 * shot ids; prompts come from `plannedShots` when present. Returns `[]` when no
 * storyboard is available (the render stage is then skipped).
 *
 * @param {object} manifest
 * @returns {Array<{ shotId: string, prompt: string }>}
 */
export function plannedShotsFromManifest(manifest) {
  const storyboard = manifest && typeof manifest === "object" ? manifest.storyboard : null;
  const planned = Array.isArray(storyboard?.plannedShots) ? storyboard.plannedShots : null;
  if (planned && planned.length) {
    return planned.map((shot) => ({
      shotId: String(shot.shotId ?? shot.id ?? ""),
      prompt: String(shot.prompt ?? shot.label ?? ""),
    })).filter((s) => s.shotId);
  }
  const nodes = Array.isArray(storyboard?.flow?.nodes) ? storyboard.flow.nodes : [];
  return nodes
    .map((node) => ({ shotId: String(node.id ?? ""), prompt: String(node.label ?? "") }))
    .filter((s) => s.shotId);
}

/**
 * Execute the gated, spend-bearing Director stages (render → checkout) against
 * a base Run_Manifest, using env-resolved live clients when configured.
 *
 * Tokens are the verified Approval_Tokens issued by the Hitl_Gate_Service:
 *   - `renderToken` authorizes the render spend boundary (`render-action`);
 *   - `paymentToken` authorizes the checkout/payout boundary (`payment-action`).
 * When a token is absent the corresponding stage is enforced with `undefined`
 * (the harness fail-closes: rejection recorded, no spend, state unchanged), so
 * the live-without-approvals invariant (AC-1 / Property 2) is preserved.
 *
 * @param {object} manifest base Run_Manifest (from the synchronous `runVideoRemix`)
 * @param {object} [params]
 * @param {ReturnType<import("./live-clients.js").resolveStageClients>} [params.clients]
 *   env-resolved stage clients; live render/commerce clients are mapped into the
 *   gate deps via `resolveGateClientDeps`. Omit/mock → deterministic mock path.
 * @param {object|string} [params.renderToken] verified render Approval_Token
 * @param {object|string} [params.paymentToken] verified payment Approval_Token
 * @param {Array} [params.shots] override planned shots (defaults to the
 *   storyboard-derived shots from the manifest)
 * @param {{ assetUrl?: string, priceId?: string }} [params.checkout] checkout input;
 *   `assetUrl` defaults to the first rendered asset's url when omitted
 * @param {(args: object) => any} [params.consume] issuer single-use consume seam
 * @param {() => number} [params.now] clock seam
 * @param {string} [params.runId] run id (scopes ids/keys)
 * @param {boolean} [params.skipRender] skip the render stage (e.g. already done)
 * @param {boolean} [params.skipCheckout] skip the checkout stage
 * @returns {Promise<{ manifest: object, render: object|null, checkout: object|null }>}
 */
export async function executeLiveStages(manifest, params = {}) {
  const {
    clients,
    renderToken,
    paymentToken,
    checkout,
    consume,
    now,
    runId,
    skipRender = false,
    skipCheckout = false,
  } = params;

  const { renderDeps, checkoutDeps } = resolveGateClientDeps(clients, { now, runId });
  const shots = Array.isArray(params.shots) && params.shots.length
    ? params.shots
    : plannedShotsFromManifest(manifest);

  let next = manifest && typeof manifest === "object" ? manifest : {};
  let renderEnforcement = null;
  let checkoutEnforcement = null;

  // ── Render spend boundary (R4.2 / R8.x) ────────────────────────────────────
  if (!skipRender && shots.length > 0) {
    const r = await enforceDirectorRenderGate(next, {
      token: renderToken,
      shots,
      consume,
      deps: renderDeps,
    });
    next = r.manifest;
    renderEnforcement = r.enforcement;
  }

  // ── Checkout / payout spend boundary (R4.3 / R9.x) ──────────────────────────
  if (!skipCheckout) {
    // Default the checkout asset to the first rendered asset when not supplied.
    const firstAsset = Array.isArray(next?.render?.assets) ? next.render.assets[0] : null;
    const checkoutInput = {
      ...(checkout ?? {}),
      assetUrl: (checkout && checkout.assetUrl) || (firstAsset && firstAsset.assetUrl) || "",
    };
    // Only attempt checkout when there is an asset url to sell (or an explicit
    // payment token forcing the gate to be exercised/recorded).
    if (checkoutInput.assetUrl || paymentToken !== undefined) {
      const c = await enforceDirectorCheckoutGate(next, {
        token: paymentToken,
        checkout: checkoutInput,
        consume,
        deps: checkoutDeps,
      });
      next = c.manifest;
      checkoutEnforcement = c.enforcement;
    }
  }

  return { manifest: next, render: renderEnforcement, checkout: checkoutEnforcement };
}
