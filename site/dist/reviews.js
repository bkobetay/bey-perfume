(() => {
  const cards = [...document.querySelectorAll("[data-review]")],
    search = document.querySelector("#review-search");
  let page = 1;
  const size = 12;
  function read() {
    const params = new URL(location.href).searchParams;
    search.value = (params.get("q") || "").slice(0, 80);
    const n = Number(params.get("page"));
    page = Number.isSafeInteger(n) && n > 0 ? n : 1;
  }
  function render(push = false) {
    const q = search.value.trim().toLocaleLowerCase("ru");
    const matches = cards.filter((c) =>
      c.textContent.toLocaleLowerCase("ru").includes(q),
    );
    const pages = Math.max(1, Math.ceil(matches.length / size));
    page = Math.min(page, pages);
    const visible = new Set(matches.slice((page - 1) * size, page * size));
    cards.forEach((c) => (c.hidden = !visible.has(c)));
    document.querySelector("#review-count").textContent =
      `В подборке: ${matches.length}`;
    document.querySelector("#reviews-empty").hidden = matches.length > 0;
    document.querySelector(".reviews-pagination").hidden = pages <= 1;
    document.querySelector("#review-page").textContent = `${page} / ${pages}`;
    document.querySelector('[data-review-step="-1"]').disabled = page === 1;
    document.querySelector('[data-review-step="1"]').disabled = page === pages;
    const url = new URL(location.href);
    q
      ? url.searchParams.set("q", search.value.trim())
      : url.searchParams.delete("q");
    page > 1
      ? url.searchParams.set("page", page)
      : url.searchParams.delete("page");
    if (url.href !== location.href)
      history[push ? "pushState" : "replaceState"](null, "", url);
  }
  search.addEventListener("input", () => {
    page = 1;
    render();
  });
  document.querySelectorAll("[data-review-step]").forEach(
    (b) =>
      (b.onclick = () => {
        page += Number(b.dataset.reviewStep);
        render(true);
        search.focus({ preventScroll: true });
        document
          .querySelector(".reviews-tools")
          .scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          });
      }),
  );
  window.addEventListener("popstate", () => {
    read();
    render();
  });
  read();
  render();
})();
