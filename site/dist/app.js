const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const toggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
function closeMenu() {
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Открыть меню");
  navigation.classList.remove("is-open");
}
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  navigation.classList.toggle("is-open", open);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    toggle.getAttribute("aria-expanded") === "true"
  ) {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".header")) closeMenu();
});
matchMedia("(min-width: 761px)").addEventListener("change", closeMenu);
const navLinks = [...navigation.querySelectorAll("a")];
const sections = [
  document.querySelector(".hero"),
  ...document.querySelectorAll("main section[id]"),
].filter(Boolean);
const header = document.querySelector(".header");
function updateNavigation() {
  if (document.body.dataset.page === "catalog") {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
    return;
  }
  let current = "#top";
  for (const section of sections) {
    if (
      section.getBoundingClientRect().top <= header.offsetHeight + 65 &&
      (!section.id ||
        navLinks.some((link) => link.getAttribute("href") === `#${section.id}`))
    )
      current = section.id ? `#${section.id}` : "#top";
  }
  navLinks.forEach((link) => {
    const active = link.getAttribute("href") === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}
let scheduled = false;
window.addEventListener(
  "scroll",
  () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      updateNavigation();
      scheduled = false;
    });
  },
  { passive: true },
);

// Ease only intentional anchor navigation; ordinary scrolling stays native.
let scrollFrame;
function stopScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = undefined;
}
for (const event of ["wheel", "touchstart", "pointerdown"])
  window.addEventListener(event, stopScroll, { passive: true });
window.addEventListener("keydown", (event) => {
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
      "Tab",
      "Escape",
    ].includes(event.key)
  )
    stopScroll();
});
window.addEventListener("popstate", stopScroll);
function scrollToSection(target) {
  stopScroll();
  const from = window.scrollY;
  const desired =
    target === document.body
      ? 0
      : target.getBoundingClientRect().top + from - header.offsetHeight - 22;
  const to = Math.max(
    0,
    Math.min(
      desired,
      document.documentElement.scrollHeight - window.innerHeight,
    ),
  );
  const finish = () => {
    if (target !== document.body) {
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    } else
      document.querySelector(".header .brand").focus({ preventScroll: true });
    updateNavigation();
  };
  if (reducedMotion.matches || Math.abs(to - from) < 2) {
    window.scrollTo(0, to);
    finish();
    return;
  }
  const start = performance.now();
  const duration = Math.min(1050, 650 + Math.abs(to - from) * 0.12);
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const ease =
      progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    window.scrollTo(0, from + (to - from) * ease);
    if (progress < 1) scrollFrame = requestAnimationFrame(frame);
    else {
      scrollFrame = undefined;
      finish();
    }
  }
  scrollFrame = requestAnimationFrame(frame);
}
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const hash = link.getAttribute("href");
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  event.preventDefault();
  closeMenu();
  if (location.hash !== hash) history.pushState(null, "", hash);
  scrollToSection(target);
});

// Animate once as a section enters the viewport. Content remains visible without JS.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (reducedMotion.matches) return;
        entry.target.animate(
          [
            { opacity: 0, translate: "0 24px" },
            { opacity: 1, translate: "0 0" },
          ],
          { duration: 850, easing: "cubic-bezier(.22,1,.36,1)" },
        );
      });
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => observer.observe(element));
}
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  stopScroll();
  document.getAnimations().forEach((animation) => animation.finish());
});
updateNavigation();
document.querySelector("#year").textContent = new Date().getFullYear();
