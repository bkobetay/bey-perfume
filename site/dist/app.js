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
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panel = document.querySelector("#scent-panel");
function selectScent(tab) {
  const scent = scents[tab.dataset.scent];
  if (!scent) return;
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute("aria-labelledby", tab.id);
  document.querySelector(".scent-number").firstChild.textContent = scent.number;
  for (const key of ["mood", "title", "description", "character"])
    document.querySelector(`#scent-${key}`).textContent = scent[key];
  document.querySelector("#scent-notes").replaceChildren(
    ...scent.notes.map((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      return li;
    }),
  );
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
navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
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
function updateNavigation() {
  let current = "#top";
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= 160)
      current = section.id ? `#${section.id}` : "#top";
  }
  navLinks.forEach((link) => {
    const active = link.getAttribute("href") === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
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
updateNavigation();
document.querySelector("#year").textContent = new Date().getFullYear();
