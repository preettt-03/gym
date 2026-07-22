// Minimal service worker: handles incoming Web Push events and notification
// clicks. Registered from src/lib/push-client.ts.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Gym Platform Admin", body: event.data.text() };
  }

  const title = payload.title || "Gym Platform Admin";
  const options = {
    body: payload.body,
    icon: "/favicon.svg",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
