// The catalog owns its URL state; the homepage stays independent of assortment size.
(() => {
  const grid = document.querySelector("#product-grid");
  if (!grid) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const tabs = [...document.querySelectorAll("[data-filter]")];
  const cards = [...grid.querySelectorAll(".product-card")];
  const search = document.querySelector("#fragrance-search");
  const clear = document.querySelector(".search-clear");
  const reset = document.querySelector(".filter-reset");
  const pagination = document.querySelector(".catalog-pagination");
  const results = document.querySelector("#catalog-results");
  const sortSelect = document.querySelector("#catalog-sort");
  const sorts = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    longevity: (a, b) => b.longevity - a.longevity,
    name: (a, b) => a.name.localeCompare(b.name, "ru"),
  };
  const pageSize = 12;
  const descriptions = {
    all: "Выберите аромат и объём.",
    female: "Женская разливная парфюмерия.",
    male: "Мужская разливная парфюмерия.",
    niche: "Нишевая разливная парфюмерия.",
    universal: "Универсальная разливная парфюмерия.",
    woody: "Кедр, сандал и ветивер — глубина в нескольких нотах.",
    fresh: "Цитрусовые и зелёные акценты для лёгкого звучания.",
    oriental: "Тёплая амбра и мягкие ванильные оттенки.",
    floral: "Жасмин, роза и белые цветы в многогранных сочетаниях.",
    leather: "Мягкая замша и кожаные оттенки.",
    spicy: "Имбирь, специи и пряные акценты.",
  };
  const normalize = (text) =>
    text.normalize("NFKC").toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
  const entries = cards.map((card, index) => ({
    card,
    index,
    price: Number(card.dataset.price) || 0,
    longevity: Number(card.dataset.longevity) || 0,
    name: card.querySelector("h3")?.textContent.trim() || "",
    categories: card.dataset.categories.split(" "),
    text: normalize(
      [
        ...card.querySelectorAll(
          ".product-brand, h3, .product-notes, .product-tags span, .sku",
        ),
      ]
        .map((element) => element.textContent)
        .join(" "),
    ),
  }));
  const label = (count) =>
    `${count} ${count % 10 === 1 && count % 100 !== 11 ? "аромат" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "аромата" : "ароматов"}`;
  let family = "all",
    sort = "",
    page = 1;
  function readURL() {
    const params = new URL(location.href).searchParams;
    family = tabs.some((tab) => tab.dataset.filter === params.get("family"))
      ? params.get("family")
      : "all";
    search.value = (params.get("q") || "").slice(0, 120);
    sort = sorts[params.get("sort")] ? params.get("sort") : "";
    if (sortSelect) sortSelect.value = sort;
    const requested = Number(params.get("page") || 1);
    page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  }
  function saveURL(mode) {
    const url = new URL(location.href);
    for (const [key, value] of [
      ["family", family === "all" ? "" : family],
      ["q", search.value.trim()],
      ["sort", sort],
      ["page", page > 1 ? String(page) : ""],
    ]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== location.href)
      history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }
  function render({
    historyMode = "replace",
    animate = true,
    scroll = false,
  } = {}) {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    const matches = [...entries]
      .sort((a, b) => (sorts[sort]?.(a, b) || 0) || a.index - b.index)
      .filter(
      (entry) =>
        (family === "all" || entry.categories.includes(family)) &&
        words.every((word) => entry.text.includes(word)),
    );
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pageCount);
    const visible = matches.slice((page - 1) * pageSize, page * pageSize);
    const visibleCards = new Set(visible.map((entry) => entry.card));
    // Reorder only when the visible sequence differs, so filtering never reflows idle cards.
    const order = visible.map((entry) => entry.card);
    const current = [...grid.children].filter((card) => visibleCards.has(card));
    if (order.some((card, i) => current[i] !== card)) grid.prepend(...order);
    for (const card of cards) {
      card.getAnimations().forEach((animation) => animation.cancel());
      card.hidden = !visibleCards.has(card);
    }
    tabs.forEach((tab) => {
      const selected = tab.dataset.filter === family;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) results.setAttribute("aria-labelledby", tab.id);
    });
    document.querySelector("#filter-description").textContent =
      descriptions[family];
    document.querySelector("#catalog-count").textContent =
      matches.length > pageSize
        ? `${label(matches.length)} · ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matches.length)}`
        : label(matches.length);
    document.querySelector(".catalog-empty").hidden = matches.length > 0;
    clear.hidden = search.value.length === 0;
    reset.hidden = family === "all" && !search.value;
    pagination.hidden = pageCount <= 1;
    document.querySelector("#page-indicator").textContent =
      `${page} / ${pageCount}`;
    document.querySelector('[data-page-step="-1"]').disabled = page === 1;
    document.querySelector('[data-page-step="1"]').disabled =
      page === pageCount;
    saveURL(historyMode);
    if (scroll) {
      results.focus({ preventScroll: true });
      results.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }
  tabs.forEach((tab, index) => {
    const select = (event) => {
      if (family === tab.dataset.filter) return;
      family = tab.dataset.filter;
      page = 1;
      render({ historyMode: "push", animate: event.detail !== 0 });
    };
    tab.addEventListener("click", select);
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus({ preventScroll: true });
      tabs[next].click();
    });
  });
  document
    .querySelector("#header-search-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const menu = document.querySelector(".menu-toggle");
      if (menu?.getAttribute("aria-expanded") === "true") menu.click();
      page = 1;
      render({ historyMode: "push", animate: false, scroll: true });
    });
  sortSelect?.addEventListener("change", () => {
    sort = sorts[sortSelect.value] ? sortSelect.value : "";
    page = 1;
    render({ historyMode: "push", animate: false });
  });
  search.addEventListener("input", () => {
    page = 1;
    render({ animate: false });
  });
  clear.addEventListener("click", () => {
    search.value = "";
    page = 1;
    render();
    search.focus();
  });
  reset.addEventListener("click", () => {
    family = "all";
    search.value = "";
    page = 1;
    render({ historyMode: "push" });
    search.focus();
  });
  document.querySelectorAll("[data-page-step]").forEach((button) =>
    button.addEventListener("click", () => {
      page += Number(button.dataset.pageStep);
      render({ historyMode: "push", scroll: true });
    }),
  );
  window.addEventListener("popstate", () => {
    readURL();
    render({ animate: false });
  });
  readURL();
  render({ animate: false });
})();
