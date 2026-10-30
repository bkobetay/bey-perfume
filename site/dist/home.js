// Fills the homepage sale section from the cart's product request; stays hidden without sales.
(() => {
  const box = document.querySelector("#home-deals");
  const list = document.querySelector("#home-deals-list");
  if (!box || !list) return;
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const off = (p) => Math.round((1 - p.pricePerMl / p.basePricePerMl) * 100);
  const tile = (p) => {
    const link = document.createElement("a");
    link.className = "home-deal";
    link.href = "/fragrance?id=" + encodeURIComponent(p.id);
    const photo = document.createElement("span");
    photo.className = "home-deal-photo";
    if (p.image) {
      const image = new Image(800, 800);
      image.src = "/assets/products/" + p.image;
      image.alt = "";
      image.loading = "lazy";
      photo.append(image);
    }
    const badge = document.createElement("span");
    badge.className = "sale-badge";
    badge.textContent = "−" + off(p) + "%";
    photo.append(badge);
    const brand = document.createElement("small");
    brand.textContent = p.brand;
    const name = document.createElement("strong");
    name.textContent = p.name;
    const prices = document.createElement("span");
    prices.className = "home-deal-prices";
    const price = document.createElement("b");
    price.textContent = money(p.variants[0].price);
    const old = document.createElement("del");
    old.textContent = money(p.variants[0].originalPrice);
    const volume = document.createElement("span");
    volume.textContent = "за " + p.variants[0].ml + " мл";
    prices.append(price, old, volume);
    link.append(photo, brand, name, prices);
    return link;
  };
  function draw() {
    const deals = (window.storeData?.products || [])
      .filter((p) => p.onSale && p.available !== false)
      .sort(
        (a, b) =>
          off(b) - off(a) ||
          (Date.parse(a.saleEndsAt) || Infinity) -
            (Date.parse(b.saleEndsAt) || Infinity),
      )
      .slice(0, 4);
    if (!deals.length) return;
    list.replaceChildren(...deals.map(tile));
    box.hidden = false;
  }
  document.addEventListener("store:data", draw);
  draw();
})();
