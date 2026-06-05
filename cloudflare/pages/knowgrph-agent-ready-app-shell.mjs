export const buildKnowgrphAppShellAssetRequest = (request, appBasePath) => {
  const appShellUrl = new URL(request.url);
  appShellUrl.pathname = `${appBasePath}/`;
  appShellUrl.search = "";
  appShellUrl.hash = "";
  return new Request(appShellUrl.toString(), request);
};

export const fetchKnowgrphAppShellAsset = async (context, appBasePath) => {
  const appShellRequest = buildKnowgrphAppShellAssetRequest(context.request, appBasePath);
  if (typeof context.env?.ASSETS?.fetch === "function") return context.env.ASSETS.fetch(appShellRequest);
  return context.next(appShellRequest);
};
