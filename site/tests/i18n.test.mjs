import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const products = JSON.parse(await read("../data/products.json"));
const load = async (file) => {
  let data;
  vm.runInNewContext(await read("../dist/i18n/" + file), {
    arafanI18n: (value) => (data = value),
  });
  return data;
};

for (const lang of ["kk", "en"]) {
  test(`${lang}: every catalog description and note is translated`, async () => {
    const { strings } = await load(lang + "-products.js");
    const { notes } = await load(lang + ".js");
    const known = new Set(Object.keys(notes).map((n) => n.toLowerCase()));
    for (const product of products) {
      for (const paragraph of product.descriptionParagraphs)
        assert.ok(strings[paragraph], `${product.id}: ${paragraph.slice(0, 40)}`);
      for (const note of product.keyNotes || [])
        if (/[А-Яа-яЁё]/.test(note))
          assert.ok(known.has(note.toLowerCase()), `${product.id}: ${note}`);
    }
  });

  test(`${lang}: translations keep numbers and rules compile`, async () => {
    const { strings, rules } = await load(lang + ".js");
    for (const [ru, text] of Object.entries(strings)) {
      assert.ok(text.trim(), ru);
      if (lang === "en") assert.doesNotMatch(text, /[А-Яа-яЁё]/, ru);
      for (const number of ru.match(/\d+(?::\d+)?/g) || [])
        assert.ok(text.includes(number), `${ru} → ${text}`);
    }
    for (const [source] of rules) new RegExp(source);
  });
}

test("Russian stays the default and every page loads the language script first", async () => {
  const script = await read("../dist/i18n.js");
  assert.match(script, /let lang = "ru"/);
  for (const page of ["index", "catalog", "fragrance", "cart", "account", "track"]) {
    const html = await read(`../dist/${page}.html`);
    assert.match(html, /^<!doctype html><html lang="ru"><head><meta charset="utf-8"><script src="\/i18n\.js"><\/script>/);
    assert.match(html, /data-lang="kk"/);
  }
});
