// Pages are written in Russian; for Kazakh and English this script swaps the text
// as it appears, before paint, so nothing flashes and no markup is duplicated.
(() => {
  const key = "arafan-lang";
  const locales = { ru: "ru-KZ", kk: "ru-KZ", en: "en-GB" };
  let lang = "ru";
  try {
    const saved = localStorage.getItem(key);
    if (locales[saved]) lang = saved;
  } catch {}
  const root = document.documentElement;
  root.lang = lang;
  // Not every browser ships Kazakh month names, so they are spelled out here.
  const kazakhMonths = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
  window.arafanDateFormat = (options) => {
    if (lang !== "kk") return new Intl.DateTimeFormat(locales[lang], options);
    const numeric = new Intl.DateTimeFormat("en-GB", { ...options, month: "numeric", hour12: false });
    return {
      format(value) {
        const part = Object.fromEntries(numeric.formatToParts(value).map(({ type, value }) => [type, value]));
        return `${part.day} ${kazakhMonths[part.month - 1]}${part.year ? " " + part.year : ""}, ${part.hour}:${part.minute}`;
      },
    };
  };

  addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-lang]");
    if (!button) return;
    if (button.dataset.lang === lang) return;
    try {
      localStorage.setItem(key, button.dataset.lang);
    } catch {
      return;
    }
    location.reload();
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    });
  });
  if (lang === "ru") return;

  const cyrillic = /[А-Яа-яЁё]/;
  const exact = new Map();
  const lower = new Map();
  let patterns = [];
  const done = new Map();
  // Strings nothing could translate; read in the browser when checking coverage.
  window.arafanI18nMissing = new Set();
  window.arafanI18n = ({ strings = {}, notes = {}, rules = [] }) => {
    for (const [ru, text] of Object.entries(strings)) exact.set(ru, text);
    for (const [ru, text] of Object.entries(notes)) {
      exact.set(ru, text);
      lower.set(ru.toLowerCase(), text);
    }
    if (rules.length)
      patterns = rules.map(([source, text]) => [new RegExp(source), text]);
    done.clear();
  };
  const matchCase = (source, text) =>
    source[0] === source[0].toUpperCase()
      ? text[0].toUpperCase() + text.slice(1)
      : text[0].toLowerCase() + text.slice(1);
  function find(text) {
    if (exact.has(text)) return exact.get(text);
    const note = lower.get(text.toLowerCase());
    if (note) return matchCase(text, note);
    for (const [pattern, template] of patterns) {
      const match = pattern.exec(text);
      if (match)
        return template.replace(/\$(\d)|\{(\d)\}/g, (_, raw, nested) =>
          raw ? match[raw] : (find(match[nested]) ?? match[nested]),
        );
    }
    if (text.includes(" · ") || text.startsWith("· ") || text.endsWith(" ·")) {
      const parts = text.split("·").map((part) => part.trim());
      const found = parts.map((part) =>
        cyrillic.test(part) ? find(part) : part,
      );
      if (found.some((part) => part !== null && part !== undefined))
        return found.map((part, i) => part ?? parts[i]).join(" · ").trim();
    }
    return null;
  }
  function translate(raw) {
    if (!cyrillic.test(raw)) return raw;
    if (done.has(raw)) return done.get(raw);
    const text = raw.replace(/\s+/g, " ").trim();
    const found = find(text);
    if (found === null || found === undefined) {
      window.arafanI18nMissing.add(text);
      return raw;
    }
    const result = raw.match(/^\s*/)[0] + found + raw.match(/\s*$/)[0];
    done.set(raw, result);
    done.set(result, result);
    return result;
  }
  window.arafanTranslate = translate;

  const attributes = ["aria-label", "placeholder", "title", "alt"];
  const skipped = "script,style,textarea,noscript,[translate=no]";
  function translateText(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(skipped)) return;
    const next = translate(node.data);
    if (next !== node.data) node.data = next;
  }
  function translateAttribute(element, name) {
    const value = element.getAttribute(name);
    if (!value || element.closest(skipped)) return;
    const next = translate(value);
    if (next !== value) element.setAttribute(name, next);
  }
  function translateElement(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateText(walker.currentNode);
    const selector = attributes.map((name) => `[${name}]`).join(",");
    for (const item of [element, ...element.querySelectorAll(selector)])
      for (const name of attributes)
        if (item.hasAttribute(name)) translateAttribute(item, name);
    if (element.matches('meta[name="description"]')) translateAttribute(element, "content");
  }
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") translateText(record.target);
      else if (record.type === "attributes")
        translateAttribute(record.target, record.attributeName);
      else
        for (const node of record.addedNodes) {
          if (node.nodeType === 3) translateText(node);
          else if (node.nodeType === 1) translateElement(node);
        }
    }
  }).observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributes,
  });

  // Browser dialogs and form bubbles never pass through the page text.
  const setValidity = HTMLInputElement.prototype.setCustomValidity;
  HTMLInputElement.prototype.setCustomValidity = function (message) {
    setValidity.call(this, translate(message));
  };
  const showAlert = window.alert;
  window.alert = (message) => showAlert.call(window, translate(String(message)));

  // Parser-blocking on purpose: the dictionary must exist before the body is parsed.
  document.write(`<script src="/i18n/${lang}.js"><\/script>`);
  if (location.pathname === "/fragrance")
    document.write(`<script src="/i18n/${lang}-products.js"><\/script>`);
  if (lang === "kk") {
    // Kazakh letters live in the extended Cyrillic font files.
    for (const family of ["manrope", "onest"]) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "font";
      link.type = "font/woff2";
      link.crossOrigin = "";
      link.href = `/assets/fonts/${family}-cyrillic-ext-wght-normal.woff2`;
      document.head.append(link);
    }
  }
})();
