(() => {
  const root = document.querySelector("#edit-products");
  let list = [];
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n);
  const el = (tag, text) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  };
  document.querySelector("#load-products").onclick = async () => {
    try {
      const r = await fetch("/api/admin/products");
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      list = data.products;
      root.replaceChildren();
      const search = el("input");
      search.type = "search";
      search.placeholder = "Название, бренд или код";
      search.setAttribute("aria-label", "Найти товар для изменения");
      const select = el("select");
      select.setAttribute("aria-label", "Товар");
      const panel = el("div");
      function options() {
        select.replaceChildren(
          ...list
            .filter((p) =>
              [p.brand, p.name, p.code]
                .join(" ")
                .toLowerCase()
                .includes(search.value.toLowerCase()),
            )
            .map((p) => {
              const o = el(
                "option",
                `${p.code || p.id} · ${p.brand} ${p.name} · ${p.type === "razliv" ? "Разлив" : "Распив"}`,
              );
              o.value = p.id;
              return o;
            }),
        );
        draw();
      }
      function draw() {
        panel.replaceChildren();
        const p = list.find((x) => x.id === select.value);
        if (!p) {
          panel.textContent = "Товар не найден";
          return;
        }
        const form = el("form");
        form.className = "account-form";
        const label = (title, input) => {
          const l = el("label", title);
          l.append(input);
          return l;
        };
        const price = el("input");
        price.type = "number";
        price.min = "0";
        price.step = "1";
        price.required = true;
        price.value = p.basePricePerMl;
        const available = el("input");
        available.type = "checkbox";
        available.checked = p.available;
        const sale = el("input");
        sale.type = "number";
        sale.min = "0";
        sale.step = "1";
        sale.value = p.salePricePerMl ?? "";
        const end = el("input");
        end.type = "datetime-local";
        if (p.saleEndsAt) {
          const d = new Date(p.saleEndsAt);
          end.value = new Date(d - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }
        const submit = el("button", "Сохранить изменения");
        submit.className = "button";
        const feedback = el("p");
        feedback.setAttribute("role", "status");
        form.append(
          label("Обычная цена за 1 мл, ₸", price),
          label("В наличии", available),
          label("Акционная цена за 1 мл, ₸ (необязательно)", sale),
          label("Конец акции (необязательно)", end),
          submit,
          feedback,
        );
        form.onsubmit = async (e) => {
          e.preventDefault();
          submit.disabled = true;
          try {
            const r = await fetch("/api/admin/products/" + p.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                version: p.version,
                pricePerMl: Number(price.value),
                available: available.checked,
                salePricePerMl: sale.value === "" ? null : Number(sale.value),
                saleEndsAt: end.value
                  ? new Date(end.value).toISOString()
                  : null,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            const fresh = await (await fetch("/api/admin/products")).json();
            list = fresh.products;
            feedback.textContent =
              "Сохранено. Цены на 5, 10, 20 и 30 мл обновлены.";
            Object.assign(
              p,
              list.find((x) => x.id === p.id),
            );
          } catch (e) {
            feedback.textContent = e.message;
          } finally {
            submit.disabled = false;
          }
        };
        panel.append(form);
      }
      search.oninput = options;
      select.onchange = draw;
      root.append(search, select, panel);
      options();
    } catch (e) {
      root.textContent = e.message;
    }
  };
})();
