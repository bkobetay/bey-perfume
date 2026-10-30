// The catalog owns its URL state; the homepage stays independent of assortment size.
(() => {
  const grid = document.querySelector("#product-grid");
  if (!grid) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const familyInputs = [...document.querySelectorAll('input[name="family"]')];
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
    discount: (a, b) => b.off - a.off,
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
    brand: card.querySelector(".product-brand")?.textContent.trim() || "",
    available: true,
    off: 0,
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
    page = 1,
    loaded = false;
  const emptyFilters = () => ({
    stock: false,
    sale: false,
    min: null,
    max: null,
    brands: new Set(),
    scents: new Set(),
  });
  let filters = emptyFilters();
  const scentNames = {
    floral: "Цветочные",
    fresh: "Свежие",
    woody: "Древесные",
    oriental: "Восточные",
    spicy: "Пряные",
    leather: "Кожаные",
  };
  const price5 = (entry) => entry.price * 5;
  // `skip` leaves one facet out, so its own options still show what they would add.
  const passesFilters = (entry, skip) =>
    (!filters.stock || entry.available) &&
    (!filters.sale || entry.off > 0) &&
    (filters.min === null || price5(entry) >= filters.min) &&
    (filters.max === null || price5(entry) <= filters.max) &&
    (skip === "brands" ||
      !filters.brands.size ||
      filters.brands.has(entry.brand)) &&
    (skip === "scents" ||
      !filters.scents.size ||
      entry.categories.some((c) => filters.scents.has(c)));
  const filtersActive = () =>
    filters.stock ||
    filters.sale ||
    filters.min !== null ||
    filters.max !== null ||
    filters.brands.size > 0 ||
    filters.scents.size > 0;
  const priceParam = (value) => {
    const n = Number(value);
    return value !== "" && value !== null && Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : null;
  };
  function readURL() {
    const params = new URL(location.href).searchParams;
    family = familyInputs.some((input) => input.value === params.get("family"))
      ? params.get("family")
      : "all";
    search.value = (params.get("q") || "").slice(0, 120);
    sort = sorts[params.get("sort")] ? params.get("sort") : "";
    if (sortSelect) sortSelect.value = sort;
    filters = {
      stock: params.get("stock") === "1",
      sale: params.get("sale") === "1",
      min: priceParam(params.get("min")),
      max: priceParam(params.get("max")),
      brands: new Set(
        params.getAll("brand").filter((b) => entries.some((e) => e.brand === b)),
      ),
      scents: new Set(params.getAll("scent").filter((s) => scentNames[s])),
    };
    const requested = Number(params.get("page") || 1);
    page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  }
  function saveURL(mode) {
    const url = new URL(location.href);
    for (const [key, value] of [
      ["family", family === "all" ? "" : family],
      ["q", search.value.trim()],
      ["sort", sort],
      ["stock", filters.stock ? "1" : ""],
      ["sale", filters.sale ? "1" : ""],
      ["min", filters.min === null ? "" : String(filters.min)],
      ["max", filters.max === null ? "" : String(filters.max)],
      ["page", page > 1 ? String(page) : ""],
    ]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    url.searchParams.delete("brand");
    url.searchParams.delete("scent");
    filters.brands.forEach((b) => url.searchParams.append("brand", b));
    filters.scents.forEach((s) => url.searchParams.append("scent", s));
    if (url.href !== location.href)
      history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }
  const matchesWords = (entry, words) =>
    words.every((word) => entry.text.includes(word));
  const matchesBase = (entry, words) =>
    (family === "all" || entry.categories.includes(family)) &&
    matchesWords(entry, words);
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
        matchesBase(entry, words) && passesFilters(entry),
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
    document.querySelector("#filter-description").textContent =
      descriptions[family];
    document.querySelector("#catalog-count").textContent =
      matches.length > pageSize
        ? `${label(matches.length)} · ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matches.length)}`
        : label(matches.length);
    // Sale and stock are known only after the prices arrive; avoid a false "nothing found".
    const waiting = !loaded && (filters.stock || filters.sale);
    results.classList.toggle("is-waiting", waiting);
    document.querySelector(".catalog-empty").hidden =
      waiting || matches.length > 0;
    drawFilters(matches.length, words);
    clear.hidden = search.value.length === 0;
    reset.hidden = family === "all" && !search.value && !filtersActive();
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
    filters = emptyFilters();
    syncFilterControls();
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
    syncFilterControls();
    render({ animate: false });
  });
  const dialog = document.querySelector("#catalog-filters");
  // Wide screens keep this same element open as a sidebar; phones show it as a sheet.
  const sidebar = matchMedia("(min-width: 1051px)");
  sidebar.addEventListener("change", () => {
    if (dialog?.open) dialog.close();
  });
  const openFilters = document.querySelector("#catalog-filter-open");
  const filterCount = document.querySelector("#catalog-filter-count");
  const activeList = document.querySelector("#catalog-active");
  const brandBox = document.querySelector("#filter-brands");
  const brandSearch = document.querySelector("#filter-brand-search");
  const fields = {
    stock: document.querySelector("#filter-stock"),
    sale: document.querySelector("#filter-sale"),
    min: document.querySelector("#filter-min"),
    max: document.querySelector("#filter-max"),
  };
  function syncFilterControls() {
    if (!dialog) return;
    familyInputs.forEach((input) => {
      input.checked = input.value === family;
    });
    fields.stock.checked = filters.stock;
    fields.sale.checked = filters.sale;
    fields.min.value = filters.min ?? "";
    fields.max.value = filters.max ?? "";
    dialog.querySelectorAll("[data-group]").forEach((input) => {
      input.checked = filters[input.dataset.group].has(input.value);
    });
  }
  function drawFilters(found, words) {
    if (!dialog) return;
    const active = [
      ...(family !== "all"
        ? [["family", "", familyInputs.find((i) => i.value === family).parentElement.querySelector("span").textContent]]
        : []),
      ...(filters.stock ? [["stock", "", "В наличии"]] : []),
      ...(filters.sale ? [["sale", "", "Со скидкой"]] : []),
      ...(filters.min !== null || filters.max !== null
        ? [
            [
              "price",
              "",
              `5 мл: ${filters.min !== null ? "от " + filters.min + " " : ""}${filters.max !== null ? "до " + filters.max + " " : ""}₸`,
            ],
          ]
        : []),
      ...[...filters.scents].map((s) => ["scents", s, scentNames[s]]),
      ...[...filters.brands].map((b) => ["brands", b, b]),
    ];
    activeList.hidden = !active.length;
    activeList.replaceChildren(
      ...active.map(([group, value, text]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.dataset.chip = group;
        chip.dataset.value = value;
        chip.textContent = text;
        chip.setAttribute("aria-label", "Убрать фильтр: " + text);
        return chip;
      }),
    );
    filterCount.hidden = !active.length;
    filterCount.textContent = active.length;
    document.querySelector("#filter-show").textContent = "Показать " + label(found);
    document.querySelector("#filter-clear").hidden = !active.length;
    familyInputs.forEach((input) => {
      const n = entries.filter(
        (entry) =>
          (input.value === "all" || entry.categories.includes(input.value)) &&
          matchesWords(entry, words) &&
          passesFilters(entry),
      ).length;
      input.parentElement.querySelector("small").textContent = n;
      input.parentElement.classList.toggle("is-empty", !n && !input.checked);
    });
    for (const group of ["scents", "brands"]) {
      const counts = new Map();
      for (const entry of entries) {
        if (!matchesBase(entry, words) || !passesFilters(entry, group)) continue;
        const keys = group === "brands" ? [entry.brand] : entry.categories;
        keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
      }
      dialog.querySelectorAll(`[data-group="${group}"]`).forEach((input) => {
        const n = counts.get(input.value) || 0;
        input.parentElement.querySelector("small").textContent = n;
        input.parentElement.classList.toggle("is-empty", !n && !input.checked);
      });
    }
  }
  function filtersChanged() {
    page = 1;
    render({ animate: false });
  }
  openFilters?.addEventListener("click", () => dialog.showModal());
  dialog?.addEventListener("click", (event) => {
    if (
      dialog.open &&
      (event.target === dialog || event.target.closest("[data-filters-close]"))
    )
      dialog.close();
  });
  dialog?.addEventListener("submit", (event) => event.preventDefault());
  dialog?.addEventListener("change", (event) => {
    const input = event.target;
    if (input.name === "family") {
      family = input.value;
      page = 1;
      render({ historyMode: "push", animate: false });
      return;
    }
    if (input.dataset.group) {
      const set = filters[input.dataset.group];
      if (input.checked) set.add(input.value);
      else set.delete(input.value);
    } else if (input === fields.stock || input === fields.sale) {
      filters[input === fields.stock ? "stock" : "sale"] = input.checked;
    } else return;
    filtersChanged();
  });
  [fields.min, fields.max].forEach((field) =>
    field?.addEventListener("input", () => {
      filters[field === fields.min ? "min" : "max"] = priceParam(field.value);
      filtersChanged();
    }),
  );
  brandSearch?.addEventListener("input", () => {
    const word = normalize(brandSearch.value);
    brandBox.querySelectorAll("label").forEach((option) => {
      option.hidden = !normalize(option.textContent).includes(word);
    });
  });
  document.querySelector("#filter-clear")?.addEventListener("click", () => {
    filters = emptyFilters();
    family = "all";
    syncFilterControls();
    filtersChanged();
  });
  activeList?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-chip]");
    if (!chip) return;
    const group = chip.dataset.chip;
    if (group === "family") family = "all";
    else if (group === "price") filters.min = filters.max = null;
    else if (group === "stock" || group === "sale") filters[group] = false;
    else filters[group].delete(chip.dataset.value);
    syncFilterControls();
    render({ historyMode: "push", animate: false });
  });
  // Live prices include sales, so price sorting and filters match what the cards show.
  function applyStoreData() {
    if (loaded || window.storeData === undefined) return;
    loaded = true;
    const byId = new Map(
      (window.storeData?.products || []).map((p) => [p.id, p]),
    );
    for (const entry of entries) {
      const p = byId.get(entry.card.dataset.product);
      if (!p) continue;
      entry.price = p.pricePerMl;
      entry.available = p.available !== false;
      entry.off = p.onSale
        ? Math.round((1 - p.pricePerMl / p.basePricePerMl) * 100)
        : 0;
    }
    render({ animate: false });
  }
  document.addEventListener("store:data", applyStoreData);
  readURL();
  syncFilterControls();
  render({ animate: false });
  applyStoreData();
  // Phones start with the long groups folded, so the panel fits without scrolling.
  if (sidebar.matches === false) {
    const inUse = {
      price: filters.min !== null || filters.max !== null,
      scents: filters.scents.size > 0,
      brands: filters.brands.size > 0,
    };
    dialog?.querySelectorAll(".filter-group").forEach((group) => {
      const name = group.dataset.groupName;
      group.open = name === "family" || inUse[name];
    });
  }
})();
