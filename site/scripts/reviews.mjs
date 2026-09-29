import { readFile, writeFile } from "node:fs/promises";
const reviews = JSON.parse(
  await readFile(new URL("../data/reviews.json", import.meta.url), "utf8"),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ids = new Set();
if (reviews.length > 50)
  throw new Error("Review library supports up to 50 entries.");
const cards = reviews.map((review, index) => {
  if (
    !/^[a-z0-9-]+$/.test(review.id) ||
    ids.has(review.id) ||
    !["ritual", "bottle", "notes"].includes(review.visual) ||
    !review.title ||
    !review.topic
  )
    throw new Error("Invalid review metadata");
  ids.add(review.id);
  if (review.url) {
    const url = new URL(review.url);
    if (
      url.protocol !== "https:" ||
      ![
        "www.instagram.com",
        "instagram.com",
        "www.tiktok.com",
        "tiktok.com",
      ].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error("Only HTTPS Instagram/TikTok links are allowed");
  }
  return `<article class="review-card review-${review.visual}" data-review="${escape(review.id)}"><span class="review-badge">${review.url ? "ОБЗОР" : "СКОРО"}</span><div class="reel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22" rx="5"/><path d="M5 12h22M11 5l4 7M20 5l4 7M14 17l6 3-6 3z"/></svg></div><div class="review-copy"><span>${String(index + 1).padStart(2, "0")} / ${escape(review.topic)}</span><h3>${escape(review.title)}</h3>${review.url ? `<a class="review-watch" href="${escape(review.url)}" target="_blank" rel="noopener noreferrer">Смотреть обзор ↗</a>` : "<p>Место для видео ALISH</p>"}</div></article>`;
});
for (const [filename, marker, html] of [
  ["reviews.html", "reviews", cards.join("\n")],
  ["index.html", "review-preview", cards.slice(0, 3).join("\n")],
]) {
  const path = new URL("../dist/" + filename, import.meta.url);
  const source = await readFile(path, "utf8");
  const pattern = new RegExp(
    `<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->`,
  );
  if (!pattern.test(source))
    throw new Error("Missing review marker: " + filename);
  await writeFile(
    path,
    source.replace(
      pattern,
      () => `<!-- ${marker}:start -->\n${html}\n<!-- ${marker}:end -->`,
    ),
  );
}
console.log(`Rendered ${reviews.length} reviews, at most three on homepage.`);
