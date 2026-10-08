/** Apply gesture restrictions only to the installed app, retaining normal scrolling. */
export function configurePwaViewport() {
  const display = window.matchMedia("(display-mode: standalone)");
  const viewport = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  const browserViewport =
    viewport?.content || "width=device-width, initial-scale=1.0";
  const installed = () =>
    display.matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const update = () => {
    const standalone = installed();
    document.documentElement.classList.toggle("pwa-standalone", standalone);
    if (viewport)
      viewport.content = standalone
        ? "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        : browserViewport;
  };
  const preventGesture = (event: Event) => {
    if (installed()) event.preventDefault();
  };
  const preventPinch = (event: TouchEvent) => {
    if (installed() && event.touches.length > 1) event.preventDefault();
  };
  const preventWheelZoom = (event: WheelEvent) => {
    if (installed() && event.ctrlKey) event.preventDefault();
  };
  const preventKeyZoom = (event: KeyboardEvent) => {
    if (
      installed() &&
      (event.ctrlKey || event.metaKey) &&
      ["+", "=", "-", "_"].includes(event.key)
    )
      event.preventDefault();
  };
  update();
  display.addEventListener("change", update);
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, {
    passive: false,
  });
  document.addEventListener("touchmove", preventPinch, { passive: false });
  document.addEventListener("wheel", preventWheelZoom, { passive: false });
  document.addEventListener("keydown", preventKeyZoom);
  return () => {
    display.removeEventListener("change", update);
    document.removeEventListener("gesturestart", preventGesture);
    document.removeEventListener("gesturechange", preventGesture);
    document.removeEventListener("touchmove", preventPinch);
    document.removeEventListener("wheel", preventWheelZoom);
    document.removeEventListener("keydown", preventKeyZoom);
    document.documentElement.classList.remove("pwa-standalone");
    if (viewport) viewport.content = browserViewport;
  };
}
