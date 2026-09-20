const STT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const unloadTimers = new Map<string, ReturnType<typeof setTimeout>>();

function modelEndpoint(serverUrl: string, path: string): string {
  return serverUrl
    .replace(/\/v1\/chat\/completions\/?$/, path)
    .replace(/\/chat\/completions\/?$/, path);
}

export function scheduleSttModelUnload(serverUrl: string, model: string) {
  const key = `${serverUrl}\n${model}`;
  const previousTimer = unloadTimers.get(key);
  if (previousTimer) clearTimeout(previousTimer);

  const timer = setTimeout(() => {
    unloadTimers.delete(key);
    void fetch(modelEndpoint(serverUrl, '/v1/models/unload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      cache: 'no-store',
    }).catch(() => undefined);
  }, STT_IDLE_TIMEOUT_MS);

  unloadTimers.set(key, timer);
}
