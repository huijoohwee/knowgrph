export const PUBLISHED_DOC_SHARE_TOKEN_PARAM = "kgShare";

const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

const toBase64 = (bytes) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toBase64Url = (value) => value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromBase64Url = (value) => {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized) return "";
  const padLength = normalized.length % 4;
  return padLength ? `${normalized}${"=".repeat(4 - padLength)}` : normalized;
};

const encodeUtf8Base64Url = (value) => {
  if (!textEncoder) {
    throw new Error("TextEncoder is required to encode published doc share tokens");
  }
  return toBase64Url(toBase64(textEncoder.encode(String(value || ""))));
};

const decodeUtf8Base64Url = (value) => {
  if (!textDecoder) {
    throw new Error("TextDecoder is required to decode published doc share tokens");
  }
  return textDecoder.decode(fromBase64(fromBase64Url(value)));
};

const normalizeWorkspaceId = (value) => {
  const workspaceId = String(value || "").trim();
  return workspaceId || null;
};

const normalizeCanonicalPath = (value) => String(value || "").trim();

export const encodePublishedDocShareToken = (args) => {
  const canonicalPath = normalizeCanonicalPath(args?.canonicalPath);
  if (!canonicalPath) return "";
  const payload = {
    canonicalPath,
    workspaceId: normalizeWorkspaceId(args?.workspaceId),
  };
  return encodeUtf8Base64Url(JSON.stringify(payload));
};

export const decodePublishedDocShareToken = (token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;
  try {
    const payload = JSON.parse(decodeUtf8Base64Url(normalizedToken));
    const canonicalPath = normalizeCanonicalPath(payload?.canonicalPath);
    if (!canonicalPath) return null;
    return {
      canonicalPath,
      workspaceId: normalizeWorkspaceId(payload?.workspaceId),
    };
  } catch {
    return null;
  }
};
