// Decorative pointer effects are optional; all links work without this file.
(() => {
  const enabled = matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  const surfaces = [
    ...document.querySelectorAll(
      ".hero, .product-card, .about-image, .button-accent",
    ),
  ];
  const controllers = [];
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const properties = [
    "--pointer-x",
    "--pointer-y",
    "--tilt-x",
    "--tilt-y",
    "--hero-x",
    "--hero-y",
    "--light-x",
    "--light-y",
  ];

  for (const element of surfaces) {
    let frame;
    let bounds;
    let point;
    const hero = element.classList.contains("hero");
    const card = element.classList.contains("featured-card");
    function reset() {
      cancelAnimationFrame(frame);
      frame = undefined;
      bounds = undefined;
      point = undefined;
      element.removeAttribute("data-pointer-active");
      properties.forEach((property) => element.style.removeProperty(property));
    }
    function render() {
      frame = undefined;
      if (!enabled.matches || !point || document.hidden) return;
      bounds ??= element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = clamp((point.x - bounds.left) / bounds.width);
      const y = clamp((point.y - bounds.top) / bounds.height);
      element.style.setProperty("--pointer-x", `${(x * 100).toFixed(2)}%`);
      element.style.setProperty("--pointer-y", `${(y * 100).toFixed(2)}%`);
      element.setAttribute("data-pointer-active", "");
      if (card) {
        // At most 3 degrees: depth stays subtle and text stays readable.
        element.style.setProperty(
          "--tilt-x",
          `${((0.5 - y) * 6).toFixed(2)}deg`,
        );
        element.style.setProperty(
          "--tilt-y",
          `${((x - 0.5) * 6).toFixed(2)}deg`,
        );
      }
      if (hero) {
        element.style.setProperty(
          "--hero-x",
          `${((x - 0.5) * 12).toFixed(2)}px`,
        );
        element.style.setProperty(
          "--hero-y",
          `${((y - 0.5) * 8).toFixed(2)}px`,
        );
        element.style.setProperty(
          "--light-x",
          `${((x - 0.5) * 42).toFixed(2)}px`,
        );
        element.style.setProperty(
          "--light-y",
          `${((y - 0.5) * 24).toFixed(2)}px`,
        );
      }
    }
    function move(event) {
      // A hybrid device may have both a mouse and a touchscreen.
      if (!enabled.matches || event.pointerType === "touch") return;
      point = { x: event.clientX, y: event.clientY };
      if (frame === undefined) frame = requestAnimationFrame(render);
    }
    element.addEventListener("pointerenter", move, { passive: true });
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", reset);
    element.addEventListener("pointercancel", reset);
    controllers.push({
      reset,
      invalidate: () => {
        bounds = undefined;
      },
    });
  }
  const resetAll = () =>
    controllers.forEach((controller) => controller.reset());
  enabled.addEventListener("change", resetAll);
  window.addEventListener("blur", resetAll);
  window.addEventListener("resize", resetAll, { passive: true });
  window.addEventListener(
    "scroll",
    () => controllers.forEach((controller) => controller.invalidate()),
    { passive: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetAll();
  });
})();
