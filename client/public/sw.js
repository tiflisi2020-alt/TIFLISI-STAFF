self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  const fallback = {
    title: "ტიფლისი",
    body: "ახალი შეტყობინება",
    url: "/",
  };
  let payload = fallback;
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() };
  } catch {
    payload = fallback;
  }
  const title = typeof payload.title === "string" ? payload.title : fallback.title;
  const body = typeof payload.body === "string" ? payload.body : fallback.body;
  const url =
    typeof payload.url === "string" &&
    payload.url.startsWith("/") &&
    !payload.url.startsWith("//")
      ? payload.url
      : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const path =
    event.notification.data &&
    typeof event.notification.data.url === "string" &&
    event.notification.data.url.startsWith("/") &&
    !event.notification.data.url.startsWith("//")
      ? event.notification.data.url
      : "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (!client.url.startsWith(self.location.origin)) continue;
        client.postMessage({ type: "tiflisi-open", url: path });
        if ("focus" in client) await client.focus();
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
