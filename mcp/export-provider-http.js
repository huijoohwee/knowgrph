const MAX_PROVIDER_MESSAGE_CHARS = 500;
const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;

const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429]);

export const sanitizeProviderMessage = (value, fallback) => {
  const text = String(value || fallback || "Provider request failed")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(
      /([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|private[_-]?key|assertion|authorization|password|secret|token|code|sig(?:nature)?)=)[^&\s#]+/gi,
      "$1[redacted]",
    )
    .replace(
      /(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|private[_-]?key|assertion|authorization(?:[_-]?code)?|password|secret|token|sig(?:nature)?)["']?\s*[:=]\s*)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,}&;]+)/gi,
      "$1[redacted]",
    )
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_PROVIDER_MESSAGE_CHARS);
};

const readProviderErrorMessage = async (response, fallback) => {
  const source = await response.text().catch(() => "");
  if (!source) return sanitizeProviderMessage(fallback, fallback);
  try {
    const payload = JSON.parse(source);
    return sanitizeProviderMessage(
      payload?.error?.message || payload?.error_description || payload?.message,
      fallback,
    );
  } catch {
    return sanitizeProviderMessage(source, fallback);
  }
};

export class ExportProviderError extends Error {
  constructor(message, options = {}) {
    super(sanitizeProviderMessage(message, "Provider request failed"));
    this.name = "ExportProviderError";
    this.code = String(options.code || "PROVIDER_REQUEST_FAILED");
    this.provider = String(options.provider || "");
    this.status = Number(options.status || 0);
    this.retryable = options.retryable === true;
    this.externalId = String(options.externalId || "");
  }
}

export const isRetryableProviderStatus = (status) => (
  RETRYABLE_HTTP_STATUSES.has(Number(status)) || Number(status) >= 500
);

const normalizeTimeoutMs = (value) => {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(Math.floor(timeoutMs), 120_000)
    : DEFAULT_PROVIDER_TIMEOUT_MS;
};

export const runProviderRequest = async ({
  provider,
  execute,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
  timeoutCode = "PROVIDER_TIMEOUT",
}) => {
  const controller = new AbortController();
  const durationMs = normalizeTimeoutMs(timeoutMs);
  let timedOut = false;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("Provider request timed out"));
      reject(new ExportProviderError(`${provider} request timed out after ${durationMs} ms`, {
        code: timeoutCode,
        provider,
        retryable: true,
      }));
    }, durationMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => execute(controller.signal)),
      timeout,
    ]);
  } catch (error) {
    if (error instanceof ExportProviderError) throw error;
    if (timedOut || controller.signal.aborted) {
      throw new ExportProviderError(`${provider} request timed out after ${durationMs} ms`, {
        code: timeoutCode,
        provider,
        retryable: true,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const requestProviderJson = async ({
  fetchImpl = globalThis.fetch,
  provider,
  url,
  method = "GET",
  accessToken = "",
  headers = {},
  body,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
}) => {
  if (typeof fetchImpl !== "function") {
    throw new ExportProviderError("No fetch implementation is available", {
      code: "PROVIDER_RUNTIME_UNAVAILABLE",
      provider,
    });
  }

  let response;
  try {
    return await runProviderRequest({
      provider,
      timeoutMs,
      execute: async (signal) => {
        response = await fetchImpl(url, {
          method,
          signal,
          headers: {
            Accept: "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(body !== undefined && !(body instanceof Uint8Array)
              ? { "Content-Type": "application/json" }
              : {}),
            ...headers,
          },
          ...(body === undefined
            ? {}
            : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
        });

        if (!response.ok) {
          const status = Number(response.status || 0);
          const message = await readProviderErrorMessage(
            response,
            `${provider} request failed with HTTP ${status}`,
          );
          const quotaOrTransient = /quota|rate.?limit|resource exhausted|temporar(?:y|ily) unavailable/i.test(message);
          throw new ExportProviderError(message, {
            code: "PROVIDER_HTTP_ERROR",
            provider,
            status,
            retryable: isRetryableProviderStatus(status) || quotaOrTransient,
          });
        }

        if (response.status === 204) return {};
        return response.json().catch(() => {
          throw new ExportProviderError(`${provider} returned an invalid JSON response`, {
            code: "PROVIDER_INVALID_RESPONSE",
            provider,
            status: Number(response.status || 0),
          });
        });
      },
    });
  } catch (error) {
    if (error instanceof ExportProviderError) throw error;
    throw new ExportProviderError(error instanceof Error ? error.message : String(error), {
      code: "PROVIDER_NETWORK_ERROR",
      provider,
      retryable: true,
    });
  }
};

export const deleteProviderResource = async ({
  fetchImpl = globalThis.fetch,
  provider,
  url,
  accessToken,
}) => {
  try {
    await requestProviderJson({
      fetchImpl,
      provider,
      url,
      method: "DELETE",
      accessToken,
    });
    return true;
  } catch {
    return false;
  }
};
