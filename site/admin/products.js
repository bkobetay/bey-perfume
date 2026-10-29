(() => {
  const kit = window.adminKit;
  if (!kit) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const num = (n) => new Intl.NumberFormat("ru-KZ").format(n);
  const money = kit.money;
  const shortDate = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const typeName = (type) => (type === "razliv" ? "Разлив" : "Распив");
  const volumes = [5, 10, 20, 30];

  const root = $("#products-list");
  const editor = $("#product-editor");
  const search = $("#product-search");
  const typeSelect = $("#product-type");
  const narrow = matchMedia("(max-width: 1180px)");
  let list = [];
  let loaded = false;
  let loading = false;
  let filter = "all";
  let selectedId = null;
  let returnFocus = null;
  let backdrop = null;

  // The site applies a sale price whenever it is below the regular price;
  // the end date only drives the countdown shown to customers.
  const saleState = (p) =>
    p.salePricePerMl === null || p.salePricePerMl === undefined
      ? "none"
      : p.saleEndsAt && Date.parse(p.saleEndsAt) <= Date.now()
        ? "expired"
        : "active";

  const filters = {
    all: { title: "Все", test: () => true },
    available: { title: "В наличии", test: (p) => p.available },
    unavailable: { title: "Нет в наличии", test: (p) => !p.available },
    sale: { title: "Со скидкой", test: (p) => p.onSale },
  };
  const chips = Object.entries(filters).map(([value, { title }]) => {
    const chip = el("button", "chip");
    chip.type = "button";
    chip.dataset.filter = value;
    chip.setAttribute("aria-pressed", String(value === filter));
    chip.append(el("span", "", title), el("span", "tab-count", "0"));
    chip.onclick = () => {
      filter = value;
      chips.forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.filter === filter)),
      );
      render();
    };
    $(".product-filters").append(chip);
    return chip;
  });

  const dirty = () => editor.querySelector('form[data-dirty="true"]');
  const confirmDiscard = (text) => !dirty() || confirm(text);

  function stateBox(title, text, tone) {
    const box = el("div", "state-box");
    if (tone) box.dataset.tone = tone;
    box.append(el("strong", "", title));
    if (text) box.append(el("span", "", text));
    return box;
  }

  async function loadProducts() {
    if (loading) return;
    loading = true;
    root.setAttribute("aria-busy", "true");
    $("#products-caption").textContent = "Загружаем товары…";
    try {
      const data = await kit.api("products");
      list = data.products;
      loaded = true;
      render();
      const current = list.find((p) => p.id === selectedId);
      if (current && !dirty()) drawEditor(current);
      else if (!current && selectedId) closeEditor(true);
    } catch (error) {
      if (!kit.loggedIn()) return;
      $("#products-caption").textContent = "";
      const box = stateBox("Не удалось загрузить товары", error.message, "error");
      const retry = el("button", "btn btn-secondary", "Повторить");
      retry.type = "button";
      retry.onclick = loadProducts;
      box.append(retry);
      root.replaceChildren(box);
    } finally {
      loading = false;
      root.setAttribute("aria-busy", "false");
    }
  }

  function matches(p) {
    const query = search.value.trim().toLowerCase();
    return (
      (typeSelect.value === "all" || p.type === typeSelect.value) &&
      (!query ||
        [p.code, p.brand, p.name, p.id]
          .join(" ")
          .toLowerCase()
          .includes(query))
    );
  }

  function row(p) {
    const button = el("button", "product-row");
    button.type = "button";
    button.dataset.id = p.id;
    if (p.id === selectedId) button.setAttribute("aria-current", "true");
    const name = el("span", "p-name");
    name.append(el("strong", "", p.name), el("small", "", p.brand));
    const meta = el("span", "p-meta");
    const type = el("span", "type-tag", typeName(p.type));
    type.dataset.type = p.type;
    const avail = el(
      "span",
      "avail",
      p.available ? "В наличии" : "Нет в наличии",
    );
    avail.dataset.available = String(p.available);
    meta.append(type, avail);
    const state = saleState(p);
    const sale = el(
      "span",
      "p-sale",
      state === "none"
        ? "—"
        : `${num(p.salePricePerMl)} ₸/мл` +
            (state === "expired" ? " · срок истёк" : ""),
    );
    sale.dataset.state = state;
    if (state !== "none") sale.prepend(el("span", "p-sale-label", "Акция "));
    button.append(
      el("span", "p-code", p.code || "—"),
      name,
      meta,
      el("span", "p-price", `${num(p.basePricePerMl)} ₸/мл`),
      sale,
    );
    button.setAttribute(
      "aria-label",
      `${p.code || ""} ${p.brand} ${p.name}, ${typeName(p.type)}, ${num(p.basePricePerMl)} тенге за мл, ${p.available ? "в наличии" : "нет в наличии"}${state === "none" ? "" : ", акция " + num(p.salePricePerMl) + " тенге за мл"}`,
    );
    button.onclick = () => openEditor(p.id, button);
    return button;
  }

  function render() {
    if (!loaded) return;
    const base = list.filter(matches);
    chips.forEach(
      (chip) =>
        (chip.lastChild.textContent = base.filter(
          filters[chip.dataset.filter].test,
        ).length),
    );
    const shown = base.filter(filters[filter].test);
    const head = el("div", "products-head");
    head.setAttribute("aria-hidden", "true");
    for (const title of ["Код", "Аромат", "Тип", "Наличие", "Цена за мл", "Акция"])
      head.append(el("span", "", title));
    root.replaceChildren(head, ...shown.map(row));
    if (!shown.length)
      root.append(
        stateBox("Ничего не найдено", "Измените поиск или фильтр."),
      );
    $("#products-caption").textContent =
      `Показано: ${shown.length} из ${list.length}`;
  }

  function markSelected() {
    root.querySelectorAll(".product-row").forEach((r) => {
      if (r.dataset.id === selectedId) r.setAttribute("aria-current", "true");
      else r.removeAttribute("aria-current");
    });
  }

  function openEditor(id, origin) {
    if (
      id !== selectedId &&
      !confirmDiscard(
        "Есть несохранённые изменения товара. Открыть другой товар без сохранения?",
      )
    )
      return;
    const p = list.find((x) => x.id === id);
    if (!p) return;
    selectedId = id;
    returnFocus = origin || null;
    markSelected();
    drawEditor(p);
    if (narrow.matches) {
      editor.dataset.open = "true";
      editor.setAttribute("role", "dialog");
      editor.setAttribute("aria-modal", "true");
      if (!backdrop) {
        backdrop = el("div", "editor-backdrop");
        backdrop.onclick = () => closeEditor();
      }
      editor.before(backdrop);
      document.body.style.overflow = "hidden";
    }
    editor.querySelector("h2")?.focus();
  }

  function closeEditor(force = false) {
    if (
      !force &&
      !confirmDiscard("Есть несохранённые изменения товара. Закрыть без сохранения?")
    )
      return;
    const wasOpen = editor.dataset.open === "true";
    editor.dataset.open = "false";
    editor.removeAttribute("role");
    editor.removeAttribute("aria-modal");
    backdrop?.remove();
    document.body.style.overflow = "";
    if (narrow.matches || force) {
      selectedId = null;
      markSelected();
      drawEmpty();
    }
    if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
  }

  function drawEmpty() {
    const box = el("div", "editor-empty");
    const h2 = el("h2", "", "Редактирование товара");
    h2.id = "product-editor-title";
    box.append(
      h2,
      el(
        "p",
        "muted",
        "Выберите товар в списке, чтобы изменить цену, наличие или акцию.",
      ),
    );
    editor.replaceChildren(box);
  }

  const toLocalInput = (iso) => {
    const d = new Date(iso);
    return new Date(d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  function numberField(id, title, value, required) {
    const label = el("label", "field");
    label.htmlFor = id;
    const wrap = el("span", "input-suffix");
    const input = el("input");
    input.id = id;
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.required = required;
    input.value = value ?? "";
    wrap.append(input, el("span", "", "₸ / мл"));
    label.append(el("span", "field-label", title), wrap);
    return { label, input };
  }

  function drawEditor(p) {
    const head = el("div", "editor-head");
    const titleBox = el("div");
    const tags = el("div", "editor-tags");
    const type = el("span", "type-tag", typeName(p.type));
    type.dataset.type = p.type;
    tags.append(el("span", "p-code", p.code || p.id), type);
    const h2 = el("h2", "", p.name);
    h2.id = "product-editor-title";
    h2.tabIndex = -1;
    titleBox.append(tags, h2, el("small", "", p.brand));
    const close = el("button", "editor-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть редактирование");
    close.onclick = () => closeEditor();
    head.append(titleBox, close);

    const form = el("form", "product-form");
    form.noValidate = true;
    const price = numberField(
      "edit-price",
      "Обычная цена за 1 мл",
      p.basePricePerMl,
      true,
    );

    const switchLabel = el("label", "switch-field");
    const switchText = el("span");
    const switchHint = el("small");
    switchText.append(el("strong", "", "В наличии"), switchHint);
    const available = el("input", "switch");
    available.type = "checkbox";
    available.setAttribute("role", "switch");
    available.checked = p.available;
    const syncSwitch = () =>
      (switchHint.textContent = available.checked
        ? "Покупатели могут заказать на сайте"
        : "Заказать на сайте сейчас нельзя");
    syncSwitch();
    switchLabel.append(switchText, available);

    const saleGroup = el("fieldset", "sale-group");
    saleGroup.append(el("legend", "", "Акция (необязательно)"));
    const sale = numberField(
      "edit-sale",
      "Акционная цена за 1 мл",
      p.salePricePerMl,
      false,
    );
    const saleHint = el(
      "span",
      "field-hint",
      "Ниже обычной цены. Оставьте пустым, чтобы убрать акцию.",
    );
    sale.label.append(saleHint);
    const endLabel = el("label", "field");
    endLabel.htmlFor = "edit-sale-end";
    const endRow = el("span", "sale-end-row");
    const end = el("input");
    end.id = "edit-sale-end";
    end.type = "datetime-local";
    if (p.saleEndsAt) end.value = toLocalInput(p.saleEndsAt);
    const clearEnd = el("button", "btn btn-secondary", "Без срока");
    clearEnd.type = "button";
    clearEnd.onclick = () => {
      end.value = "";
      form.dispatchEvent(new Event("input"));
    };
    endRow.append(end, clearEnd);
    endLabel.append(
      el("span", "field-label", "Конец акции"),
      endRow,
      el("span", "field-hint", "Покупатели увидят таймер до этой даты."),
    );
    saleGroup.append(sale.label, endLabel);

    const preview = el("section", "price-preview");
    preview.setAttribute("aria-label", "Цены на сайте после сохранения");
    const previewGrid = el("div", "preview-grid");
    const previewNote = el("p", "preview-note");
    preview.append(el("h3", "", "Цены на сайте"), previewGrid, previewNote);

    const feedback = el("p", "form-message");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    const submit = el("button", "btn btn-primary", "Сохранить изменения");
    submit.type = "submit";

    form.append(
      price.label,
      switchLabel,
      saleGroup,
      preview,
      feedback,
      submit,
    );

    function values() {
      const base = price.input.value === "" ? NaN : Number(price.input.value);
      const salePrice =
        sale.input.value === "" ? null : Number(sale.input.value);
      return { base, salePrice };
    }
    function validate() {
      const { base, salePrice } = values();
      price.input.removeAttribute("aria-invalid");
      sale.input.removeAttribute("aria-invalid");
      if (!Number.isSafeInteger(base) || base < 0) {
        price.input.setAttribute("aria-invalid", "true");
        return [price.input, "Укажите обычную цену целым числом от 0."];
      }
      if (
        salePrice !== null &&
        (!Number.isSafeInteger(salePrice) || salePrice < 0 || salePrice >= base)
      ) {
        sale.input.setAttribute("aria-invalid", "true");
        return [
          sale.input,
          "Цена акции должна быть целым числом ниже обычной цены.",
        ];
      }
      return null;
    }
    function updatePreview() {
      const { base, salePrice } = values();
      const valid = Number.isSafeInteger(base) && base >= 0;
      const onSale =
        valid &&
        salePrice !== null &&
        Number.isSafeInteger(salePrice) &&
        salePrice >= 0 &&
        salePrice < base;
      const perMl = onSale ? salePrice : base;
      previewGrid.replaceChildren(
        ...volumes.map((ml) => {
          const cell = el("div", "preview-cell");
          cell.append(
            el("span", "", ml + " мл"),
            el("strong", "", valid ? money(perMl * ml) : "—"),
          );
          if (onSale) cell.append(el("s", "", money(base * ml)));
          return cell;
        }),
      );
      const ends = end.value ? new Date(end.value) : null;
      previewNote.textContent = !valid
        ? "Укажите цену, чтобы увидеть расчёт."
        : !onSale
          ? available.checked
            ? "Цена за мл × объём."
            : "Товар отмечен как отсутствующий — заказать его нельзя."
          : ends && ends <= new Date()
            ? "Срок акции истёк, но акционная цена всё ещё действует. Очистите акционную цену, чтобы вернуть обычную."
            : ends
              ? `Акционная цена до ${shortDate(ends)}.`
              : "Акционная цена без срока окончания.";
    }
    updatePreview();

    form.addEventListener("input", () => {
      form.dataset.dirty = "true";
      syncSwitch();
      updatePreview();
      feedback.dataset.tone = "";
      feedback.textContent = "";
      price.input.removeAttribute("aria-invalid");
      sale.input.removeAttribute("aria-invalid");
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      const problem = validate();
      if (problem) {
        feedback.dataset.tone = "error";
        feedback.textContent = problem[1];
        problem[0].focus();
        return;
      }
      const controls = form.querySelectorAll("input, button");
      controls.forEach((c) => (c.disabled = true));
      feedback.dataset.tone = "";
      feedback.textContent = "Сохраняем…";
      try {
        const { base, salePrice } = values();
        const result = await kit.api("products/" + p.id, {
          method: "PATCH",
          body: JSON.stringify({
            version: p.version,
            pricePerMl: base,
            available: available.checked,
            salePricePerMl: salePrice,
            saleEndsAt: end.value ? new Date(end.value).toISOString() : null,
          }),
        });
        const fresh = result.product;
        const index = list.findIndex((x) => x.id === fresh.id);
        if (index >= 0) list[index] = fresh;
        form.dataset.dirty = "false";
        render();
        drawEditor(fresh);
        const message = editor.querySelector(".form-message");
        message.dataset.tone = "success";
        message.textContent = "Сохранено. Цены на 5, 10, 20 и 30 мл обновлены.";
      } catch (error) {
        if (!kit.loggedIn()) return;
        feedback.dataset.tone = "error";
        feedback.textContent = error.message;
        if (error.status === 409) {
          const reload = el(
            "button",
            "btn btn-secondary btn-block",
            "Загрузить актуальные данные",
          );
          reload.type = "button";
          reload.onclick = () => {
            form.dataset.dirty = "false";
            loadProducts();
          };
          feedback.after(reload);
        }
      } finally {
        controls.forEach((c) => (c.disabled = false));
      }
    };
    editor.replaceChildren(head, form);
  }

  search.addEventListener("input", render);
  typeSelect.addEventListener("change", render);
  $("#refresh-products").onclick = () => {
    if (
      confirmDiscard(
        "Есть несохранённые изменения товара. Обновить список без сохранения?",
      )
    ) {
      const form = dirty();
      if (form) form.dataset.dirty = "false";
      loadProducts();
    }
  };
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editor.dataset.open === "true") {
      event.preventDefault();
      closeEditor();
    }
  });
  narrow.addEventListener("change", () => {
    if (!narrow.matches && editor.dataset.open === "true") {
      editor.dataset.open = "false";
      editor.removeAttribute("role");
      editor.removeAttribute("aria-modal");
      backdrop?.remove();
      document.body.style.overflow = "";
    }
  });

  const maybeLoad = () => {
    if (kit.loggedIn() && kit.section() === "products" && !loaded) loadProducts();
  };
  document.addEventListener("admin:section", maybeLoad);
  document.addEventListener("admin:ready", maybeLoad);
  document.addEventListener("admin:logout", () => {
    list = [];
    loaded = false;
    selectedId = null;
    closeEditor(true);
    root.replaceChildren(stateBox("Загружаем товары…"));
    $("#products-caption").textContent = "";
  });
})();
