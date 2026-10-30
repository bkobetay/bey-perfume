(() => {
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const audiences = {
    female: "Женский",
    male: "Мужской",
    unisex: "Универсальный",
  };
  const groups = {
    female: "Женские ароматы",
    male: "Мужские ароматы",
    niche: "Нишевые ароматы",
    universal: "Универсальные ароматы",
  };
  // Large countdown tiles; cart.js ticks every [data-countdown-end] on the page.
  const tiles = (end, title = "Акция закончится через") =>
    `<div class="countdown countdown-tiles" role="timer" data-countdown-end="${esc(end)}"><p class="countdown-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg><span>${esc(title)}</span></p><div class="countdown-units">${[
      ["d", "дней"],
      ["h", "часов"],
      ["m", "минут"],
      ["s", "секунд"],
    ]
      .map(
        ([unit, label]) =>
          `<span class="countdown-unit" data-unit="${unit}"><b>00</b><small>${label}</small></span>`,
      )
      .join("")}</div></div>`;
  const future = (value) => Date.parse(value) > Date.now();
  const plural = (n, one, few, many) =>
    n % 10 === 1 && n % 100 !== 11
      ? one
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? few
        : many;
  const scopeLinks = {
    all: ["/catalog", "Весь ассортимент"],
    female: ["/catalog?family=female", "Женские ароматы"],
    male: ["/catalog?family=male", "Мужские ароматы"],
    niche: ["/catalog?family=niche", "Нишевые ароматы"],
    universal: ["/catalog?family=universal", "Универсальные ароматы"],
    raspiv: ["/raspiv", "Распив оригиналов"],
    sets: ["/sets", "Наборы"],
  };
  function setCard(set) {
    const off = Math.round((1 - set.price / set.regularPrice) * 100);
    // Only a fixed set price below the components deserves its own comparison line.
    const separate = set.componentsPrice - set.regularPrice;
    return `<article class="set-card${set.onSale ? " is-on-sale" : ""}" id="${esc(set.id)}"><div class="set-images">${set.items
      .slice(0, 4)
      .map((i) =>
        i.image
          ? `<a href="/fragrance?id=${esc(i.productId)}&ml=${i.ml}" tabindex="-1" aria-hidden="true"><img src="/assets/products/${esc(i.image)}" alt="" width="800" height="800" loading="lazy"></a>`
          : "",
      )
      .join(
        "",
      )}${set.onSale ? `<span class="sale-badge">−${off}%</span>` : ""}</div><div class="set-copy"><span class="type-label">Набор · ${set.items.length} ${plural(set.items.length, "аромат", "аромата", "ароматов")}</span><h2>${esc(set.title)}</h2>${set.description ? `<p class="set-description">${esc(set.description)}</p>` : ""}<ul class="set-items">${set.items
      .map(
        (i) =>
          `<li><a href="/fragrance?id=${esc(i.productId)}&ml=${i.ml}"><small>${esc(i.brand)}</small>${esc(i.name)}</a><span>${i.ml} мл</span></li>`,
      )
      .join(
        "",
      )}</ul><div class="price-row"><strong class="set-price">${money(set.price)}</strong>${set.onSale ? `<del class="sale-old-price">${money(set.regularPrice)}</del><span class="sale-save">Выгода ${money(set.regularPrice - set.price)}</span>` : ""}</div>${separate > 0 ? `<p class="set-separate">По отдельности — ${money(set.componentsPrice)}</p>` : ""}${set.onSale && future(set.saleEndsAt) ? tiles(set.saleEndsAt, set.promotion ? `«${set.promotion.title}» закончится через` : "Акция закончится через") : ""}<button type="button" class="button" data-add-set="${esc(set.id)}" disabled>Добавить набор в корзину</button></div></article>`;
  }
  // Shared card for the recommendation sections of a fragrance page.
  const miniCard = (x) =>
    `<article class="product-card" data-product="${esc(x.id)}"><a class="product-visual" href="/fragrance?id=${esc(x.id)}">${x.image ? `<img src="/assets/products/${esc(x.image)}" alt="Флакон ${esc(x.brand)} ${esc(x.name)}" width="800" height="800" loading="lazy">` : ""}</a><div class="product-copy"><span class="type-label ${x.type === "razliv" ? "razliv" : ""}">${x.type === "razliv" ? "Разлив" : "Распив оригинала"} · ${audiences[x.audience] || ""}</span><span class="sku">Код: ${esc(x.code)}</span><p class="product-brand">${esc(x.brand)}</p><h3><a href="/fragrance?id=${esc(x.id)}">${esc(x.name)}</a></h3><p class="product-notes">${esc(x.notes)}</p><div class="purchase-controls"><strong class="current-price" data-current-price>${money(x.variants[0].price)}</strong><label>Объём<select class="volume-select" aria-label="Объём ${esc(x.name)}">${x.variants.map((v) => `<option value="${v.ml}">${v.ml} мл — ${money(v.price)}</option>`).join("")}</select></label><div class="card-actions"><button class="add-cart" data-add="${esc(x.id)}" disabled>В корзину</button><button type="button" class="favorite-toggle" data-favorite-id="${esc(x.id)}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.5c-2.2-2.3-5.6-1.8-8.5 1.3-2.9-3.1-6.3-3.6-8.5-1.3C.6 8.5 3 13 12 20c9-7 11.4-11.5 8.5-14.5Z"/></svg></button></div><span class="product-availability" role="status"></span></div></div></article>`;
  // Tap the photo to look closer; the native dialog handles focus and Esc.
  function addPhotoZoom(visual, title) {
    const image = visual?.querySelector("img");
    if (!image) return;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "photo-zoom";
    open.setAttribute("aria-label", "Увеличить фото " + title);
    open.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6"/></svg>';
    visual.append(open);
    const dialog = document.createElement("dialog");
    dialog.className = "photo-lightbox";
    dialog.setAttribute("aria-label", "Фото " + title);
    dialog.innerHTML =
      '<button type="button" class="photo-lightbox-close" aria-label="Закрыть фото"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
    const large = new Image();
    large.alt = image.alt;
    dialog.append(large);
    document.body.append(dialog);
    const show = () => {
      large.src = image.src;
      dialog.showModal();
    };
    open.onclick = show;
    image.onclick = show;
    dialog.onclick = () => dialog.close();
  }
  // On phones the buy button stays reachable while the description is being read.
  function addBuyBar(root) {
    const add = root.querySelector(".detail-actions [data-add]");
    const controls = root.querySelector(".detail-product .purchase-controls");
    if (!add || !controls) return;
    const select = controls.querySelector(".volume-select");
    const bar = document.createElement("div");
    bar.className = "buy-bar";
    bar.innerHTML =
      '<div><small></small><strong></strong></div><button type="button" class="button">В корзину</button><a class="button" href="/cart" hidden></a>';
    const button = bar.querySelector("button"),
      link = bar.querySelector("a");
    button.onclick = () => add.click();
    document.body.append(bar);
    const sync = () => {
      bar.querySelector("small").textContent = select.value + " мл";
      bar.querySelector("strong").textContent =
        controls.querySelector("[data-current-price]").textContent;
      const inCart = controls.querySelector(".in-cart-control:not([hidden]) .in-cart-count");
      button.hidden = !!inCart;
      link.hidden = !inCart;
      if (inCart) link.textContent = inCart.textContent;
      button.disabled = add.disabled;
      button.textContent = add.disabled ? "Нет в наличии" : "В корзину";
    };
    sync();
    select.addEventListener("change", sync);
    new MutationObserver(sync).observe(controls, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "disabled"],
    });
    new IntersectionObserver(([entry]) => {
      document.body.classList.toggle("has-buy-bar", !entry.isIntersecting);
    }).observe(root.querySelector(".detail-actions"));
  }
  function rating(value, label) {
    const ok = Number.isFinite(value) && value >= 0 && value <= 10;
    return `<div class="rating-item"><div class="rating-circle" role="img" aria-label="${label}: ${ok ? value + " из 10" : "оценка пока не указана"}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rating-track" cx="60" cy="60" r="51"/><circle class="rating-arc" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="${ok ? value * 10 : 0} 100"/></svg><span>${ok ? value : "—"}<small>/10</small></span></div><span>${label}</span></div>`;
  }
  fetch("/api/products")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then(({ products, sets = [], promotions = [] }) => {
      const target = document.querySelector("#fragrance-detail");
      if (target) {
        const p = products.find(
          (p) => p.id === new URL(location.href).searchParams.get("id"),
        );
        if (!p) {
          target.innerHTML =
            '<h1>Аромат не найден</h1><a class="button" href="/catalog">Вернуться в каталог</a>';
          return;
        }
        const params = new URL(location.href).searchParams;
        const selectedVariant =
          p.variants.find((v) => v.ml === Number(params.get("ml"))) ||
          p.variants[0];
        const fromCart = params.get("from") === "cart";
        const type = p.type === "razliv" ? "Разлив" : "Распив оригинала",
          route = p.type === "razliv" ? "/catalog" : "/raspiv";
        const group = groups[p.collection] || "Ароматы";
        const back =
          route +
          (p.collection ? "?family=" + encodeURIComponent(p.collection) : "");
        const audience =
          audiences[p.audience] ||
          audiences[p.collection] ||
          (p.collection === "universal" ? "Универсальный" : "Уточняется");
        const question =
          "Здравствуйте! Подскажите по аромату " +
          p.brand +
          " " +
          p.name +
          " (код " +
          p.code +
          "), " +
          type.toLowerCase() +
          ".";
        target.innerHTML = `<div class="product-navigation"><a class="detail-back" href="${fromCart ? "/cart" : back}"><span>${fromCart ? "К корзине" : "Назад"}</span></a><nav class="breadcrumbs" aria-label="Путь к аромату"><a href="/">Главная</a><span>/</span><a href="${route}">${p.type === "razliv" ? "Каталог" : "Распив"}</a><span>/</span><a href="${back}">${esc(group)}</a><span>/</span><span aria-current="page">${esc(p.name)}</span></nav></div>
    <article class="product-card detail-product" data-product="${esc(p.id)}"><div class="detail-gallery"><div class="product-visual">${p.image ? `<img src="/assets/products/${esc(p.image)}" alt="Аромат-ориентир ${esc(p.brand)} ${esc(p.name)}" width="800" height="800" fetchpriority="high">` : ""}</div><p class="gallery-caption">${p.type === "razliv" ? "На фото — флакон аромата-ориентира. В заказе — разливная парфюмерия в выбранном объёме." : "На фото — оригинальный флакон. Вы заказываете выбранный объём распива."}</p></div>
    <div class="product-copy detail-buy"><div class="detail-meta"><span class="type-label ${p.type === "razliv" ? "razliv" : ""}">${type}</span><span class="sku">Артикул ${esc(p.code)}</span></div><p class="product-brand">${esc(p.brand)}</p><h1>${esc(p.name)}</h1><p class="detail-audience">${audience} аромат</p><span class="product-availability" role="status">${p.available ? "В наличии" : "Нет в наличии"}</span>
    <div class="purchase-controls"><strong class="current-price" data-current-price>${money(selectedVariant.price)}</strong><div class="volume-picker"><span class="volume-picker-label" id="volume-picker-label">Объём флакона</span><div class="volume-pills" role="radiogroup" aria-labelledby="volume-picker-label">${p.variants.map((v) => `<button type="button" role="radio" data-ml="${v.ml}" aria-checked="${v.ml === selectedVariant.ml}" tabindex="${v.ml === selectedVariant.ml ? 0 : -1}"><strong>${v.ml} мл</strong><span>${money(v.price)}</span>${v.originalPrice ? `<del>${money(v.originalPrice)}</del>` : ""}</button>`).join("")}</div><label class="visually-hidden" aria-hidden="true">Объём флакона<select class="volume-select" tabindex="-1">${p.variants.map((v) => `<option value="${v.ml}" ${v.ml === selectedVariant.ml ? "selected" : ""}>${v.ml} мл — ${money(v.price)}</option>`).join("")}</select></label></div><p class="unit-price">${money(p.pricePerMl)} за 1 мл${p.onSale ? ` <del>${money(p.basePricePerMl)}</del>` : ""} · без доплаты за упаковку</p><div class="detail-actions"><button data-add="${esc(p.id)}" class="add-cart" disabled>Добавить в корзину</button><button class="favorite-toggle" aria-pressed="false" aria-label="Сохранить ${esc(p.name)} в избранное"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.5c-2.2-2.3-5.6-1.8-8.5 1.3-2.9-3.1-6.3-3.6-8.5-1.3C.6 8.5 3 13 12 20c9-7 11.4-11.5 8.5-14.5Z"/></svg></button></div><button class="button button-glass buy-now" disabled>Добавить и оформить</button></div>
    <div class="product-contact"><span>Есть вопрос об аромате?</span><div><a href="tel:+77472886509"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 3a14 14 0 0 1-7-7l3-2-2-5Z"/></svg>Позвонить</a><a href="https://wa.me/77472886509?text=${encodeURIComponent(question)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5A8 8 0 1 1 20 11.5Z"/></svg>WhatsApp</a></div></div><dl class="detail-fulfillment"><div><dt>Самовывоз</dt><dd>Алматы, Достык, 108Б. Ежедневно с 10:00 до 21:00.</dd></div><div><dt>Доставка</dt><dd>Курьером «Яндекс». Оплачивается отдельно при получении, стоимость зависит от адреса.</dd></div><div><dt>После заказа</dt><dd>Магазин свяжется с вами, чтобы уточнить детали. Онлайн-оплата на сайте пока не подключена.</dd></div></dl></div></article>
    <section class="fragrance-information"><div class="fragrance-description"><p class="kicker">ЗНАКОМСТВО С АРОМАТОМ</p><h2>Описание и ноты</h2><p>${esc(p.description)}</p><div class="note-list" aria-label="Основные ноты">${p.notes
      .split(/[·,]/)
      .map((n) => `<span>${esc(n.trim())}</span>`)
      .join(
        "",
      )}</div><p class="direction-explainer">${p.type === "razliv" ? "Описание раскрывает характер аромата-ориентира. ARAFAN предлагает эту позицию в формате разливной парфюмерии." : "Оригинальный аромат в выбранном вами объёме распива."}</p></div><div class="fragrance-facts"><h2>Об аромате</h2><dl><div><dt>Бренд</dt><dd>${esc(p.brand)}</dd></div><div><dt>Для кого</dt><dd>${audience}</dd></div><div><dt>Формат</dt><dd>${type}</dd></div><div><dt>Артикул</dt><dd>${esc(p.code)}</dd></div><div><dt>Объёмы</dt><dd>5, 10, 20, 30 мл</dd></div>${p.season ? `<div><dt>Сезон</dt><dd>${esc(p.season)}</dd></div>` : ""}</dl><div class="metrics">${rating(p.longevity, "Стойкость")}${rating(p.sillage, "Шлейф")}</div>${!Number.isFinite(p.longevity) || !Number.isFinite(p.sillage) ? '<p class="field-hint">Оценки по десятибалльной шкале появятся после подтверждения магазином.</p>' : ""}</div></section>`;
        const info = target.querySelector(".fragrance-information"),
          description = info.querySelector(".fragrance-description"),
          facts = info.querySelector(".fragrance-facts");
        const panels = [
          {
            key: "description",
            title: "Описание",
            html:
              '<div class="scent-profile" aria-label="Характер аромата">' +
              (p.olfactoryProfile || [])
                .map((x) => `<span>${esc(x)}</span>`)
                .join("") +
              "</div>" +
              (p.descriptionParagraphs || [p.description])
                .map((text) => `<p>${esc(text)}</p>`)
                .join("") +
              description.querySelector(".direction-explainer").outerHTML,
          },
          {
            key: "notes",
            title: "Ноты",
            html:
              '<p class="panel-intro">Основные ноты' +
              (p.type === "razliv" ? " аромата-ориентира" : " аромата") +
              "</p>" +
              (Object.values(p.notePyramid || {}).some((x) => x.length)
                ? '<div class="note-pyramid">' +
                  [
                    ["top", "Верхние ноты"],
                    ["heart", "Ноты сердца"],
                    ["base", "Базовые ноты"],
                  ]
                    .filter(([key]) => p.notePyramid[key]?.length)
                    .map(
                      ([key, label], i) =>
                        `<section class="note-stage"><span class="note-stage-number">0${i + 1}</span><div><h3>${label}</h3><ul>${p.notePyramid[key].map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div></section>`,
                    )
                    .join("") +
                  "</div>"
                : '<div class="note-list" aria-label="Ключевые ноты">' +
                  (p.keyNotes || p.notes.split(/[·,]/))
                    .map((n) => `<span>${esc(n.trim())}</span>`)
                    .join("") +
                  "</div>"),
          },
          {
            key: "facts",
            title: "Характеристики",
            html: facts
              .querySelector("dl")
              .outerHTML.replace(
                "</dl>",
                (p.olfactoryProfile?.length
                  ? `<div><dt>Характер</dt><dd>${p.olfactoryProfile.map(esc).join(" · ")}</dd></div>`
                  : "") + "</dl>",
              ),
          },
          {
            key: "performance",
            title: "Стойкость и шлейф",
            html:
              facts.querySelector(".metrics").outerHTML +
              '<p class="performance-hint">Оценки магазина по шкале от 0 до 10. Восприятие аромата может отличаться.</p>' +
              (facts.querySelector(".field-hint")?.outerHTML || ""),
          },
        ];
        const tabs = document.createElement("section");
        tabs.className = "product-tabs";
        tabs.setAttribute("aria-label", "Информация об аромате");
        tabs.innerHTML =
          '<div role="tablist" class="product-tablist" aria-label="Описание и характеристики">' +
          panels
            .map(
              (panel, i) =>
                `<button type="button" role="tab" id="product-tab-${panel.key}" aria-controls="product-panel-${panel.key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${panel.title}</button>`,
            )
            .join("") +
          "</div>" +
          panels
            .map(
              (panel, i) =>
                `<div role="tabpanel" class="product-tabpanel" id="product-panel-${panel.key}" aria-labelledby="product-tab-${panel.key}" ${i ? "hidden" : ""}>${panel.html}</div>`,
            )
            .join("");
        target.querySelector(".detail-buy").append(tabs);
        info.remove();
        const tabButtons = [...tabs.querySelectorAll("[role=tab]")];
        // Reserve the tallest information panel so selecting tabs cannot clamp the scroll position.
        function sizePanels() {
          const width = tabs.clientWidth;
          if (!width) return;
          let tallest = 0;
          tabs.querySelectorAll("[role=tabpanel]").forEach((panel) => {
            const previous = panel.getAttribute("style");
            if (panel.hidden)
              panel.style.cssText =
                "display:flow-root!important;position:absolute;visibility:hidden;pointer-events:none;width:" +
                width +
                "px";
            tallest = Math.max(tallest, panel.getBoundingClientRect().height);
            if (previous === null) panel.removeAttribute("style");
            else panel.setAttribute("style", previous);
          });
          tabs.style.minHeight =
            Math.ceil(
              tallest +
                tabs.querySelector(".product-tablist").getBoundingClientRect()
                  .height +
                8,
            ) + "px";
        }
        sizePanels();
        document.fonts.ready.then(sizePanels);
        let previousWidth = tabs.clientWidth;
        new ResizeObserver(() => {
          if (tabs.clientWidth !== previousWidth) {
            previousWidth = tabs.clientWidth;
            sizePanels();
          }
        }).observe(tabs);

        function activateTab(index, keyboard = false) {
          const selected = tabButtons[index];
          if (selected.getAttribute("aria-selected") === "true") return;
          tabButtons.forEach((button, i) => {
            const on = i === index;
            button.setAttribute("aria-selected", String(on));
            button.tabIndex = on ? 0 : -1;
            document.getElementById(
              button.getAttribute("aria-controls"),
            ).hidden = !on;
          });
        }
        tabButtons.forEach((button, index) => {
          button.onclick = (event) => activateTab(index, event.detail === 0);
          button.onkeydown = (event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % 4
                : event.key === "ArrowLeft"
                  ? (index + 3) % 4
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 3
                      : null;
            if (next === null) return;
            event.preventDefault();
            tabButtons[next].focus({ preventScroll: true });
            activateTab(next, true);
          };
        });
        // Volume buttons drive the shared select that cart.js already reads.
        const pills = [...target.querySelectorAll(".volume-pills [data-ml]")];
        const volumeSelect = target.querySelector(".detail-product .volume-select");
        function chooseVolume(index, focus = false) {
          pills.forEach((pill, i) => {
            pill.setAttribute("aria-checked", String(i === index));
            pill.tabIndex = i === index ? 0 : -1;
          });
          if (focus) pills[index].focus({ preventScroll: true });
          if (volumeSelect.value === pills[index].dataset.ml) return;
          volumeSelect.value = pills[index].dataset.ml;
          volumeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        pills.forEach((pill, index) => {
          pill.onclick = () => chooseVolume(index);
          pill.onkeydown = (event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            chooseVolume((index + step + pills.length) % pills.length, true);
          };
        });
        const profile = p.olfactoryProfile || [];
        const similar = products
          .filter((x) => x.id !== p.id && x.type === p.type && x.collection === p.collection && x.available !== false)
          .map((x) => ({
            x,
            score:
              (x.olfactoryProfile || []).filter((t) => profile.includes(t)).length * 10 -
              Math.abs(x.pricePerMl - p.pricePerMl) / 100,
          }))
          .sort((a, b) => b.score - a.score || a.x.code.localeCompare(b.x.code))
          .slice(0, 4)
          .map(({ x }) => x);
        if (similar.length) {
          const section = document.createElement("section");
          section.className = "similar-fragrances";
          section.setAttribute("aria-labelledby", "similar-title");
          section.innerHTML = `<div class="section-heading"><div><p class="kicker">ПОХОЖИЕ АРОМАТЫ</p><h2 id="similar-title">Вам может понравиться</h2></div><a class="catalog-view-all" href="${back}"><span>${esc(group)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a></div><div class="product-grid">${similar.map(miniCard).join("")}</div>`;
          target.append(section);
        }
        const sameBrand = products
          .filter(
            (x) =>
              x.id !== p.id &&
              x.brand === p.brand &&
              x.available !== false &&
              !similar.includes(x),
          )
          .slice(0, 4);
        if (sameBrand.length) {
          const section = document.createElement("section");
          section.className = "similar-fragrances";
          section.setAttribute("aria-labelledby", "brand-title");
          section.innerHTML = `<div class="section-heading"><div><p class="kicker">ЭТОТ БРЕНД</p><h2 id="brand-title">Ещё от ${esc(p.brand)}</h2></div><a class="catalog-view-all" href="/catalog?brand=${encodeURIComponent(p.brand)}"><span>Все ароматы бренда</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a></div><div class="product-grid">${sameBrand.map(miniCard).join("")}</div>`;
          target.append(section);
        }
        addPhotoZoom(
          target.querySelector(".detail-gallery .product-visual"),
          p.brand + " " + p.name,
        );
        addBuyBar(target);
        document.title = p.brand + " " + p.name + " — ARAFAN Perfume";
        target.querySelector(".buy-now").onclick = () => {
          const add = target.querySelector("[data-add]");
          if (add.disabled) return;
          add.click();
          document.querySelector(".cart-toggle").click();
        };
      }
      const setsList = document.querySelector("#sets-list");
      if (setsList) {
        setsList.innerHTML = sets.map(setCard).join("");
        setsList.removeAttribute("aria-busy");
        document.querySelector("#sets-empty").hidden = sets.length > 0;
        if (location.hash)
          document.getElementById(location.hash.slice(1))?.scrollIntoView();
      }
      const favoriteList = document.querySelector("#favorite-list");
      if (favoriteList) {
        let ids = [];
        try {
          ids = JSON.parse(localStorage.getItem("arafan-favorites") || "[]");
          if (!Array.isArray(ids)) ids = [];
        } catch {}
        function drawFavorites() {
          const savedProducts = products.filter((p) => ids.includes(p.id));
          document.querySelector("#favorites-empty").hidden =
            savedProducts.length > 0;
          favoriteList.innerHTML = savedProducts
            .map(
              (p) =>
                `<article class="product-card" data-product="${esc(p.id)}"><a class="product-visual" href="/fragrance?id=${esc(p.id)}"><img src="/assets/products/${esc(p.image)}" alt="${esc(p.name)}" width="800" height="800"></a><div class="product-copy"><p class="product-brand">${esc(p.brand)}</p><h3><a href="/fragrance?id=${esc(p.id)}">${esc(p.name)}</a></h3><p class="sku">Код ${esc(p.code)}</p><p class="product-notes">${esc(p.notes)}</p><div class="purchase-controls"><strong data-current-price class="current-price">${money(p.variants[0].price)}</strong><label>Объём<select class="volume-select">${p.variants.map((v) => `<option value="${v.ml}">${v.ml} мл — ${money(v.price)}</option>`).join("")}</select></label><button class="add-cart" data-add="${esc(p.id)}" disabled>В корзину</button><span class="product-availability"></span><button class="remove-favorite plain-link" data-remove-favorite="${esc(p.id)}">Убрать из избранного</button></div></div></article>`,
            )
            .join("");
          document.dispatchEvent(new Event("store:refresh-controls"));
        }
        drawFavorites();
        favoriteList.addEventListener("click", (e) => {
          const remove = e.target.closest("[data-remove-favorite]");
          if (!remove) return;
          ids = ids.filter((id) => id !== remove.dataset.removeFavorite);
          try {
            localStorage.setItem("arafan-favorites", JSON.stringify(ids));
          } catch {}
          drawFavorites();
          window.dispatchEvent(new Event("store:favorites-changed"));
        });
      }
      const list = document.querySelector("#promotions-list");
      if (list) {
        // Ending soonest first; open-ended offers after dated ones.
        // Group promotions get one banner each; listed products have their own sale.
        const sales = products
          .filter((p) => p.onSale && !p.promotion)
          .sort(
            (a, b) =>
              (Date.parse(a.saleEndsAt) || Infinity) -
              (Date.parse(b.saleEndsAt) || Infinity),
          );
        const setSales = sets.filter((set) => set.onSale);
        document.querySelector("#promotions-empty").hidden =
          sales.length + setSales.length + promotions.length > 0;
        const discounts = [
          ...products
            .filter((p) => p.onSale)
            .map((p) => ({
              off: Math.round((1 - p.pricePerMl / p.basePricePerMl) * 100),
              end: p.saleEndsAt,
            })),
          ...setSales.map((s) => ({
            off: Math.round((1 - s.price / s.regularPrice) * 100),
            end: s.saleEndsAt,
          })),
        ];
        const soonest = discounts
          .filter((d) => future(d.end))
          .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))[0];
        const hero = document.querySelector("#promotions-hero");
        const onSaleCount = products.filter((p) => p.onSale).length + setSales.length;
        if (hero && discounts.length) {
          const best = Math.max(...discounts.map((d) => d.off));
          hero.innerHTML = `<div class="promo-hero-copy"><p class="promo-hero-kicker">Специальные цены</p><h2>Скидки до −${best}%</h2><p>${onSaleCount} ${plural(onSaleCount, "позиция", "позиции", "позиций")} по акционной цене. Скидка действует на все объёмы.</p></div>${soonest ? tiles(soonest.end, "Ближайшая акция закончится через") : ""}`;
          hero.hidden = false;
        }
        const banners = promotions
          .map((promo) => {
            const [href, label] =
              promo.scope === "brand"
                ? ["/catalog?q=" + encodeURIComponent(promo.scopeValue), promo.scopeValue]
                : scopeLinks[promo.scope] || scopeLinks.all;
            return `<article class="promo-banner"><span class="sale-badge">−${promo.percent}%</span><div><p class="promo-banner-scope">${esc(label)}</p><h2>${esc(promo.title)}</h2><p>${promo.endsAt ? "До " + new Intl.DateTimeFormat("ru-KZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(promo.endsAt)) : "Без ограничения по сроку"}</p></div>${future(promo.endsAt) ? `<p class="countdown countdown-compact" role="timer" data-countdown-end="${esc(promo.endsAt)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg><span class="countdown-text"></span></p>` : ""}<a class="button" href="${href}">Смотреть</a></article>`;
          })
          .join("");
        const bannerList = document.querySelector("#promotions-banners");
        if (bannerList) {
          bannerList.innerHTML = banners;
          bannerList.hidden = !promotions.length;
        }
        const setList = document.querySelector("#promotions-sets");
        if (setList) {
          setList.innerHTML = setSales.map(setCard).join("");
          setList.hidden = !setSales.length;
        }
        list.innerHTML = sales
          .map((p) => {
            const off = Math.round((1 - p.pricePerMl / p.basePricePerMl) * 100);
            const ends = Date.parse(p.saleEndsAt) > Date.now();
            return `<article class="promotion-product"><a class="promotion-visual" href="/fragrance?id=${esc(p.id)}"><img src="/assets/products/${esc(p.image)}" width="250" height="250" alt="${esc(p.brand)} ${esc(p.name)}" loading="lazy"><span class="sale-badge">−${off}%</span></a><div class="promotion-copy"><p class="product-brand">${esc(p.brand)}</p><h2><a href="/fragrance?id=${esc(p.id)}">${esc(p.name)}</a></h2><p class="promotion-prices"><strong>${money(p.pricePerMl)} / мл</strong><del>${money(p.basePricePerMl)}</del></p><p class="promotion-from">5 мл — ${money(p.variants[0].price)} вместо ${money(p.variants[0].originalPrice)}</p>${ends ? `<p class="countdown countdown-compact" role="timer" data-countdown-end="${esc(p.saleEndsAt)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg><span class="countdown-text"></span></p>` : `<p class="promotion-open">Специальная цена</p>`}<a class="button" href="/fragrance?id=${esc(p.id)}">Выбрать объём</a></div></article>`;
          })
          .join("");
      }
      document.dispatchEvent(new Event("store:refresh-controls"));
    })
    .catch(() => {
      const t = document.querySelector("#fragrance-detail");
      if (t) t.textContent = "Не удалось загрузить аромат. Обновите страницу.";
    });
})();
