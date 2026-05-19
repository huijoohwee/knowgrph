export const BROWSER_API_NATIVE_BROWSER_OPERATIONS = /** @type {const} */ ([
  "go",
  "snap",
  "click",
  "fill",
  "type",
  "press",
  "select",
  "scroll",
  "submit",
  "screenshot",
  "text",
  "markdown",
  "cookies",
  "eval",
  "sync",
  "close",
  "skill",
  "sessions",
]);

const NATIVE_BROWSER_MUTATION_OPERATIONS = new Set([
  "go",
  "click",
  "fill",
  "type",
  "press",
  "select",
  "scroll",
  "submit",
  "eval",
  "sync",
  "close",
]);

function readOptionalStringArg(value) {
  const next = typeof value === "string" ? value.trim() : "";
  return next || undefined;
}

function readNumberArg(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== "undefined" && item !== null));
}

function nativeBrowserPathForOperation(operation) {
  if (operation === "sessions") return "/v1/sessions";
  return `/v1/browser/${encodeURIComponent(operation)}`;
}

export function buildNativeBrowserRequest({
  operation,
  runtimeUrl,
  runtimePath,
  payload,
  targetUrl,
  sessionId,
  skillId,
  dryRun,
  confirmUnsafe,
  confirmThirdPartyTerms,
  confirmCookieImport,
  inputArgs,
  joinRuntimePath,
  requireSkillId,
  assertConfirmedExecution,
}) {
  if (operation === "sessions") {
    return {
      operation,
      method: "GET",
      url: joinRuntimePath(runtimeUrl, runtimePath || nativeBrowserPathForOperation(operation)),
      body: null,
      dryRun,
      confirmUnsafe,
      confirmThirdPartyTerms,
      confirmCookieImport,
    };
  }
  if (operation === "skill") {
    const requiredSkillId = requireSkillId(skillId, operation);
    return {
      operation,
      method: "GET",
      url: joinRuntimePath(runtimeUrl, runtimePath || `/v1/skills/${encodeURIComponent(requiredSkillId)}`),
      body: null,
      dryRun,
      confirmUnsafe,
      confirmThirdPartyTerms,
      confirmCookieImport,
    };
  }
  if (operation === "cookies" && !confirmCookieImport) {
    throw new Error("cookies requires confirmCookieImport=true.");
  }
  if (operation === "go" && !targetUrl && typeof payload.url !== "string") {
    throw new Error("go requires targetUrl or payload.url.");
  }
  if (NATIVE_BROWSER_MUTATION_OPERATIONS.has(operation)) {
    assertConfirmedExecution(operation, { dryRun, confirmUnsafe });
  }
  const body = compactObject({
    ...payload,
    ...(targetUrl ? { url: targetUrl } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
    selector: readOptionalStringArg(inputArgs.selector),
    text: readOptionalStringArg(inputArgs.text),
    value: readOptionalStringArg(inputArgs.value),
    key: readOptionalStringArg(inputArgs.key),
    x: readNumberArg(inputArgs.x),
    y: readNumberArg(inputArgs.y),
    dry_run: dryRun,
    confirm_unsafe: confirmUnsafe,
    confirm_third_party_terms: confirmThirdPartyTerms,
    confirm_cookie_import: confirmCookieImport,
  });
  return {
    operation,
    method: "POST",
    url: joinRuntimePath(runtimeUrl, runtimePath || nativeBrowserPathForOperation(operation)),
    body,
    dryRun,
    confirmUnsafe,
    confirmThirdPartyTerms,
    confirmCookieImport,
  };
}
