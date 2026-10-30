// The catalog owns its URL state; the homepage stays independent of assortment size.
(() => {
  const grid = document.querySelector("#product-grid");
  if (!grid) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
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
  let sort = "",
    page = 1,
    loaded = false;
  const emptyFilters = () => ({
    families: new Set(),
    strength: 0,
    stock: false,
    sale: false,
    min: null,
    max: null,
    brands: new Set(),
    scents: new Set(),
  });
  let filters = emptyFilters();
  const familyNames = {
    female: "Женские",
    male: "Мужские",
    niche: "Нишевые",
    universal: "Универсальные",
  };
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
    (skip === "families" ||
      !filters.families.size ||
      entry.categories.some((c) => filters.families.has(c))) &&
    (skip === "strength" || entry.longevity >= filters.strength) &&
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
  const priceParam = (value) => {
    const n = Number(value);
    return value !== "" && value !== null && Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : null;
  };
  function readURL() {
    const params = new URL(location.href).searchParams;
    search.value = (params.get("q") || "").slice(0, 120);
    sort = sorts[params.get("sort")] ? params.get("sort") : "";
    if (sortSelect) sortSelect.value = sort;
    filters = {
      families: new Set(params.getAll("family").filter((f) => familyNames[f])),
      strength: [7, 8].includes(Number(params.get("strength")))
        ? Number(params.get("strength"))
        : 0,
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
      ["strength", filters.strength ? String(filters.strength) : ""],
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
    url.searchParams.delete("family");
    filters.families.forEach((f) => url.searchParams.append("family", f));
    url.searchParams.delete("brand");
    url.searchParams.delete("scent");
    filters.brands.forEach((b) => url.searchParams.append("brand", b));
    filters.scents.forEach((s) => url.searchParams.append("scent", s));
    if (url.href !== location.href)
      history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }
  const matchesWords = (entry, words) =>
    words.every((word) => entry.text.includes(word));
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
        matchesWords(entry, words) && passesFilters(entry),
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
    search.value = "";
    filters = emptyFilters();
    syncFilterControls();
    page = 1;
    render({ historyMode: "push" });
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
  const strengthInputs = [
    ...document.querySelectorAll('input[name="strength"]'),
  ];
  const clearButtons = [...document.querySelectorAll("[data-filter-clear]")];
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const priceStep = 500;
  function paintPrice() {
    const low = Number(fields.min.min),
      span = Number(fields.min.max) - low || 1;
    const fill = document.querySelector("#filter-price-fill");
    fill.style.setProperty("--from", (fields.min.value - low) / span);
    fill.style.setProperty("--to", (fields.max.value - low) / span);
    document.querySelector("#filter-price-values").textContent =
      money(Number(fields.min.value)) + " — " + money(Number(fields.max.value));
  }
  function syncFilterControls() {
    if (!dialog) return;
    strengthInputs.forEach((input) => {
      input.checked = Number(input.value) === filters.strength;
    });
    fields.stock.checked = filters.stock;
    fields.sale.checked = filters.sale;
    fields.min.value = filters.min ?? fields.min.min;
    fields.max.value = filters.max ?? fields.max.max;
    paintPrice();
    dialog.querySelectorAll("[data-group]").forEach((input) => {
      input.checked = filters[input.dataset.group].has(input.value);
    });
  }
  function drawFilters(found, words) {
    if (!dialog) return;
    const active = [
      ...[...filters.families].map((f) => ["families", f, familyNames[f]]),
      ...(filters.strength
        ? [["strength", "", `Стойкость от ${filters.strength}`]]
        : []),
      ...(filters.stock ? [["stock", "", "В наличии"]] : []),
      ...(filters.sale ? [["sale", "", "Со скидкой"]] : []),
      ...(filters.min !== null || filters.max !== null
        ? [
            [
              "price",
              "",
              `5 мл: ${filters.min !== null ? "от " + money(filters.min) : ""}${filters.min !== null && filters.max !== null ? " " : ""}${filters.max !== null ? "до " + money(filters.max) : ""}`,
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
    if (active.length) {
      const all = document.createElement("button");
      all.type = "button";
      all.className = "catalog-active-clear";
      all.dataset.filterClearAll = "";
      all.textContent = "Сбросить всё";
      activeList.append(all);
    }
    filterCount.hidden = !active.length;
    filterCount.textContent = active.length;
    document.querySelector("#filter-show").textContent = "Показать " + label(found);
    clearButtons.forEach((button) => {
      button.disabled = !active.length;
    });
    strengthInputs.forEach((input) => {
      const min = Number(input.value);
      const n = entries.filter(
        (entry) =>
          entry.longevity >= min &&
          matchesWords(entry, words) &&
          passesFilters(entry, "strength"),
      ).length;
      input.parentElement.querySelector("small").textContent = n;
      input.parentElement.classList.toggle("is-empty", !n && !input.checked);
    });
    for (const group of ["families", "scents", "brands"]) {
      const counts = new Map();
      for (const entry of entries) {
        if (!matchesWords(entry, words) || !passesFilters(entry, group)) continue;
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
    if (input.name === "strength") {
      filters.strength = Number(input.value);
      filtersChanged();
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
  // Two range inputs share one track; a handle stops one step before the other.
  [fields.min, fields.max].forEach((field) =>
    field?.addEventListener("input", () => {
      let low = Number(fields.min.value),
        high = Number(fields.max.value);
      if (high - low < priceStep) {
        if (field === fields.min) low = fields.min.value = high - priceStep;
        else high = fields.max.value = low + priceStep;
      }
      filters.min = low <= Number(fields.min.min) ? null : low;
      filters.max = high >= Number(fields.max.max) ? null : high;
      paintPrice();
      filtersChanged();
    }),
  );
  brandSearch?.addEventListener("input", () => {
    const word = normalize(brandSearch.value);
    brandBox.querySelectorAll("label").forEach((option) => {
      option.hidden = !normalize(option.textContent).includes(word);
    });
  });
  const clearFilters = () => {
    filters = emptyFilters();
    syncFilterControls();
    filtersChanged();
  };
  clearButtons.forEach((button) =>
    button.addEventListener("click", clearFilters),
  );
  activeList?.addEventListener("click", (event) => {
    if (event.target.closest("[data-filter-clear-all]")) {
      filters = emptyFilters();
      syncFilterControls();
      render({ historyMode: "push", animate: false });
      return;
    }
    const chip = event.target.closest("[data-chip]");
    if (!chip) return;
    const group = chip.dataset.chip;
    if (group === "strength") filters.strength = 0;
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
    // Sale prices can fall below the printed bounds, so the slider follows live data.
    if (byId.size && fields.min) {
      const fives = entries.map(price5);
      const low = Math.floor(Math.min(...fives) / priceStep) * priceStep;
      const high = Math.max(
        Math.ceil(Math.max(...fives) / priceStep) * priceStep,
        low + priceStep,
      );
      for (const field of [fields.min, fields.max]) {
        field.min = low;
        field.max = high;
      }
      syncFilterControls();
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
      strength: filters.strength > 0,
      scents: filters.scents.size > 0,
      brands: filters.brands.size > 0,
    };
    dialog?.querySelectorAll(".filter-group").forEach((group) => {
      const name = group.dataset.groupName;
      group.open = name === "families" || inUse[name];
    });
  }
})();
