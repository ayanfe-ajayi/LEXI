/// <reference lib="webworker" />
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[];
};
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/auth/, /^\/functions/],
  }),
);
// User data is never cached in the shared service-worker cache.
self.addEventListener("push", (event) => {
  let value = {
    title: "Lexi",
    body: "Your words are ready for review.",
    url: "/review",
  };
  try {
    value = { ...value, ...event.data?.json() };
  } catch {
    /* Fall back to a generic reminder. */
  }
  event.waitUntil(
    self.registration.showNotification(value.title, {
      body: value.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "lexi-review",
      data: { url: "/review" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clients.find(
        (c) => new URL(c.url).origin === self.location.origin,
      ) as WindowClient | undefined;
      if (existing) {
        await existing.navigate("/review");
        return existing.focus();
      }
      return self.clients.openWindow("/review");
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
