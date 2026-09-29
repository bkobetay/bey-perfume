const scents = {
  woody: {
    number: "01",
    mood: "СПОКОЙНАЯ УВЕРЕННОСТЬ",
    title: "Глубина в каждой ноте.",
    description:
      "Сухое тепло кедра, мягкость сандала и землистые оттенки ветивера. Сдержанное звучание, которое остаётся в памяти.",
    notes: ["Кедр", "Сандал", "Ветивер"],
    character: "Тёплый.\nГлубокий.\nТвой.",
  },
  fresh: {
    number: "02",
    mood: "ЧИСТАЯ ЭНЕРГИЯ",
    title: "Навстречу новому дню.",
    description:
      "Искристые цитрусы, прохладные водные аккорды и зелёные оттенки. Лёгкое, чистое звучание для твоего повседневного ритма.",
    notes: ["Бергамот", "Морские ноты", "Зелёный чай"],
    character: "Лёгкий.\nЧистый.\nЖивой.",
  },
  oriental: {
    number: "03",
    mood: "ПРИТЯГАТЕЛЬНОЕ ТЕПЛО",
    title: "История с продолжением.",
    description:
      "Тёплая амбра, смолистые аккорды и мягкая сладость ванили. Обволакивающие сочетания с глубоким, чувственным шлейфом.",
    notes: ["Амбра", "Ваниль", "Смолы"],
    character: "Мягкий.\nТёплый.\nМанящий.",
  },
  leather: {
    number: "04",
    mood: "НЕЗАВИСИМЫЙ ХАРАКТЕР",
    title: "Оставаться собой.",
    description:
      "Бархатистая замша, дымные аккорды и сухие древесные ноты. Выразительное звучание для тех, кто выбирает свой путь.",
    notes: ["Кожа", "Замша", "Дымные ноты"],
    character: "Смелый.\nСухой.\nОсобенный.",
  },
  spicy: {
    number: "05",
    mood: "ТЁПЛЫЙ АКЦЕНТ",
    title: "Искра в привычном.",
    description:
      "Пряное тепло кардамона, острота перца и свежесть имбиря. Живые, контрастные сочетания, которые раскрываются постепенно.",
    notes: ["Кардамон", "Чёрный перец", "Имбирь"],
    character: "Пряный.\nЯркий.\nЖивой.",
  },
  intense: {
    number: "06",
    mood: "ВЫРАЗИТЕЛЬНОЕ ЗВУЧАНИЕ",
    title: "Впечатление надолго.",
    description:
      "Насыщенные древесные и смолистые аккорды с глубокими оттенками пачули. Плотное, многогранное звучание с заметным характером.",
    notes: ["Уд", "Пачули", "Лабданум"],
    character: "Густой.\nСложный.\nЗаметный.",
  },
};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panel = document.querySelector("#scent-panel");
const photo = document.querySelector(".scent-photo");
const nextPhoto = document.querySelector(".scent-photo-next");
let photoTransition;
function selectScent(tab) {
  const scent = scents[tab.dataset.scent];
  if (!scent || panel.dataset.scent === tab.dataset.scent) return;
  photoTransition?.finish();
  panel.dataset.scent = tab.dataset.scent;
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute("aria-labelledby", tab.id);
  document.querySelector(".scent-number").firstChild.textContent = scent.number;
  for (const key of ["mood", "title", "description", "character"]) {
    document.querySelector(`#scent-${key}`).textContent = scent[key].replaceAll(
      "\n",
      " ",
    );
  }
  document.querySelector("#scent-notes").replaceChildren(
    ...scent.notes.map((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      return li;
    }),
  );
  const material = tab.dataset.scent;
  if (reducedMotion.matches) {
    photo.dataset.material = material;
    nextPhoto.dataset.material = material;
    return;
  }
  nextPhoto.dataset.material = material;
  photoTransition = nextPhoto.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 550,
    easing: "ease-out",
  });
  photoTransition.onfinish = () => {
    photo.dataset.material = material;
  };
  for (const element of document.querySelectorAll(".scent-copy, .scent-side")) {
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        { opacity: 0, transform: "translateY(9px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" },
    );
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectScent(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    selectScent(tabs[next]);
  });
});
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
];
const header = document.querySelector(".header");
function updateNavigation() {
  let current = "#top";
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= header.offsetHeight + 65)
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
  if (link.dataset.pick)
    selectScent(
      document.querySelector(`[data-scent="${link.dataset.pick}"][role="tab"]`),
    );
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
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 850, easing: "cubic-bezier(.22,1,.36,1)" },
        );
      });
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal, .scent-panel")
    .forEach((element) => observer.observe(element));
}
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  stopScroll();
  document.getAnimations().forEach((animation) => animation.finish());
});
updateNavigation();
document.querySelector("#year").textContent = new Date().getFullYear();
