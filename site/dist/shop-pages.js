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
  function rating(value, label) {
    const ok = Number.isFinite(value) && value >= 0 && value <= 10;
    return `<div class="rating-item"><div class="rating-circle" role="img" aria-label="${label}: ${ok ? value + " из 10" : "оценка пока не указана"}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rating-track" cx="60" cy="60" r="51"/><circle class="rating-arc" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="${ok ? value * 10 : 0} 100"/></svg><span>${ok ? value : "—"}<small>/10</small></span></div><span>${label}</span></div>`;
  }
  fetch("/api/products")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then(({ products }) => {
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
        target.innerHTML = `<div class="product-navigation"><a class="detail-back" href="${back}"><span>Назад</span></a><nav class="breadcrumbs" aria-label="Путь к аромату"><a href="/">Главная</a><span>/</span><a href="${route}">${p.type === "razliv" ? "Каталог" : "Распив"}</a><span>/</span><a href="${back}">${esc(group)}</a><span>/</span><span aria-current="page">${esc(p.name)}</span></nav></div>
    <article class="product-card detail-product" data-product="${esc(p.id)}"><div class="detail-gallery"><div class="product-visual">${p.image ? `<img src="/assets/products/${esc(p.image)}" alt="Аромат-ориентир ${esc(p.brand)} ${esc(p.name)}" width="800" height="800" fetchpriority="high">` : ""}</div><p class="gallery-caption">${p.type === "razliv" ? "На фото — флакон аромата-ориентира. В заказе — разливная парфюмерия в выбранном объёме." : "На фото — оригинальный флакон. Вы заказываете выбранный объём распива."}</p></div>
    <div class="product-copy detail-buy"><div class="detail-meta"><span class="type-label ${p.type === "razliv" ? "razliv" : ""}">${type}</span><span class="sku">Артикул ${esc(p.code)}</span></div><p class="product-brand">${esc(p.brand)}</p><h1>${esc(p.name)}</h1><p class="detail-audience">${audience} аромат</p><span class="product-availability" role="status">${p.available ? "В наличии" : "Нет в наличии"}</span>
    <div class="purchase-controls"><strong class="current-price" data-current-price>${money(p.variants[0].price)}</strong><label>Объём флакона<select class="volume-select" aria-label="Объём ${esc(p.name)}">${p.variants.map((v) => `<option value="${v.ml}">${v.ml} мл — ${money(v.price)}</option>`).join("")}</select></label><p class="unit-price">${money(p.pricePerMl)} за 1 мл · без доплаты за упаковку</p><div class="detail-actions"><button data-add="${esc(p.id)}" class="add-cart" disabled>Добавить в корзину</button><button class="favorite-toggle" aria-pressed="false" aria-label="Сохранить ${esc(p.name)} в избранное"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.5c-2.2-2.3-5.6-1.8-8.5 1.3-2.9-3.1-6.3-3.6-8.5-1.3C.6 8.5 3 13 12 20c9-7 11.4-11.5 8.5-14.5Z"/></svg></button></div><button class="button button-glass buy-now" disabled>Добавить и оформить</button></div>
    <a class="product-question" href="https://wa.me/77472886509?text=${encodeURIComponent(question)}" target="_blank" rel="noopener">Есть вопрос об аромате? Напишите нам</a><p class="detail-delivery">Доставка — отдельно при получении. Итоговая стоимость товаров отображается в корзине.</p></div></article>
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
        document.title = p.brand + " " + p.name + " — ARAFAN Perfume";
        target.querySelector(".buy-now").onclick = () => {
          const add = target.querySelector("[data-add]");
          if (add.disabled) return;
          add.click();
          document.querySelector(".cart-toggle").click();
        };
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
        const sales = products.filter((p) => p.onSale);
        document.querySelector("#promotions-empty").hidden = sales.length > 0;
        list.innerHTML = sales
          .map(
            (p) =>
              `<article class="promotion-product"><a href="/fragrance?id=${esc(p.id)}"><img src="/assets/products/${esc(p.image)}" width="250" height="250" alt="${esc(p.name)}"><span class="type-label">Специальная цена</span><p class="product-brand">${esc(p.brand)}</p><h2>${esc(p.name)}</h2><p><del>${money(p.basePricePerMl)}</del> <strong>${money(p.pricePerMl)} / мл</strong></p>${p.saleEndsAt ? `<p class="sale-timer" data-sale-end="${esc(p.saleEndsAt)}" hidden></p>` : ""}<span class="button">Выбрать объём</span></a></article>`,
          )
          .join("");
      }
      const timers = [...document.querySelectorAll("[data-sale-end]")];
      function updateTimers() {
        for (const timer of timers) {
          const seconds = Math.floor(
            (Date.parse(timer.dataset.saleEnd) - Date.now()) / 1000,
          );
          timer.hidden = !(seconds > 0);
          if (seconds > 0) {
            const d = Math.floor(seconds / 86400),
              h = Math.floor((seconds % 86400) / 3600),
              m = Math.floor((seconds % 3600) / 60),
              s = seconds % 60;
            timer.textContent =
              "До окончания: " +
              (d ? d + " д. " : "") +
              [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
          }
        }
      }
      updateTimers();
      if (timers.length) setInterval(updateTimers, 1000);
      document.dispatchEvent(new Event("store:refresh-controls"));
    })
    .catch(() => {
      const t = document.querySelector("#fragrance-detail");
      if (t) t.textContent = "Не удалось загрузить аромат. Обновите страницу.";
    });
})();
