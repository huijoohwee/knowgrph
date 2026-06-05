export const STRUCTURED_SURFACE_INLINE_COMPUTE_NODE_ID = 'mcp-response-structured-compute'

export const STRUCTURED_SURFACE_INLINE_COMPUTE_SOURCE = `inputs => {
  const rawFirst = value => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        if (value[i] != null && value[i] !== "") return value[i];
      }
      return null;
    }
    return value == null ? null : value;
  };
  const asText = value => {
    const raw = rawFirst(value);
    if (raw == null) return "";
    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "object") {
      try { return JSON.stringify(raw); } catch { return ""; }
    }
    return String(raw).trim();
  };
  const first = value => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const item = first(value[i]);
        if (item) return item;
      }
      return "";
    }
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  const escape = value => String(value || "").replace(/[&<>"']/g, ch => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
  const parseJsonLike = value => {
    const raw = rawFirst(value);
    if (raw && typeof raw === "object") return raw;
    const text = asText(raw);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  };
  const geoRaw = rawFirst(inputs.geoJson) || rawFirst(inputs.geojson) || rawFirst(inputs.geo_json) || rawFirst(inputs.featureCollection) || rawFirst(inputs.feature_collection) || rawFirst(inputs.features) || rawFirst(inputs.coordinates);
  const geoParsed = parseJsonLike(geoRaw);
  const geoText = asText(geoRaw);
  const geoFeatureCount = geoParsed && typeof geoParsed === "object" && Array.isArray(geoParsed.features)
    ? geoParsed.features.length
    : Array.isArray(geoParsed) ? geoParsed.length : geoText ? 1 : 0;
  const geoSummary = geoText
    ? "Geospatial features: " + geoFeatureCount + "."
    : "";
  const sourceSrcDoc = first(inputs.outputSrcDoc);
  const text = first(inputs.prompt_in) || first(inputs.output) || first(inputs.text_out) || sourceSrcDoc || geoSummary || first(inputs.imageUrl) || first(inputs.audioUrl) || first(inputs.videoUrl);
  const result = {};
  if (text) result.output = text;
  if (sourceSrcDoc) result.outputSrcDoc = sourceSrcDoc;
  else if (geoText) result.outputSrcDoc = "<section data-kg-structured-compute=\\"1\\" data-kg-structured-geospatial=\\"1\\"><h1>Geospatial output</h1><p>" + escape(geoSummary) + "</p><pre>" + escape(geoText.slice(0, 6000)) + "</pre></section>";
  else if (text) result.outputSrcDoc = "<section data-kg-structured-compute=\\"1\\"><pre>" + escape(text) + "</pre></section>";
  const imageUrl = first(inputs.imageUrl);
  const audioUrl = first(inputs.audioUrl);
  const videoUrl = first(inputs.videoUrl);
  if (imageUrl) result.imageUrl = imageUrl;
  if (audioUrl) result.audioUrl = audioUrl;
  if (videoUrl) result.videoUrl = videoUrl;
  return result;
}`
