const menu = document.querySelector(".menu-toggle");
const nav = document.querySelector("#navigation");
let menuAnimation,
  menuGeneration = 0;
function setMenu(open, keyboard = false) {
  if (!menu || !nav) return;
  const turn = ++menuGeneration,
    hidden = !nav.classList.contains("is-open"),
    current = hidden ? null : getComputedStyle(nav),
    from = {
      opacity: hidden ? 0 : current.opacity,
      transform: hidden ? "translateY(-6px)" : current.transform,
    };
  menuAnimation?.cancel();
  menu.setAttribute("aria-expanded", String(open));
  nav.inert = !open && matchMedia("(max-width:1080px)").matches;
  if (
    !matchMedia("(max-width:1080px)").matches ||
    keyboard ||
    matchMedia("(prefers-reduced-motion:reduce)").matches
  ) {
    nav.classList.toggle("is-open", open);
    nav.inert = false;
    return;
  }
  nav.classList.add("is-open");
  menuAnimation = nav.animate(
    [
      from,
      open
        ? { opacity: 1, transform: "none" }
        : { opacity: 0, transform: "translateY(-3px)" },
    ],
    {
      duration: open ? 230 : 150,
      easing: "cubic-bezier(.22,1,.36,1)",
      fill: "both",
    },
  );
  menuAnimation.finished
    .then(() => {
      if (turn !== menuGeneration) return;
      nav.classList.toggle("is-open", open);
      menuAnimation.cancel();
      menuAnimation = null;
    })
    .catch(() => {});
}
function closeMenu(keyboard = false) {
  setMenu(false, keyboard);
}
menu?.addEventListener("click", (event) =>
  setMenu(menu.getAttribute("aria-expanded") !== "true", event.detail === 0),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menu?.getAttribute("aria-expanded") === "true") {
    closeMenu(true);
    menu.focus();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".header")) closeMenu(true);
  if (e.target.closest(".navigation a")) closeMenu(true);
});
matchMedia("(min-width:1081px)").addEventListener(
  "change",
  () => menu && closeMenu(),
);
const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const contactToggle = document.querySelector(".contact-toggle"),
  contactPanel = document.querySelector("#contact-panel");
let contactOpen = false,
  contactAnimation,
  contactGeneration = 0;
function setContact(open) {
  if (!contactPanel) return;
  const wasHidden = contactPanel.hidden;
  const style = wasHidden ? null : getComputedStyle(contactPanel);
  const from = {
    opacity: wasHidden ? 0 : style.opacity,
    transform: wasHidden ? "translateY(14px) scale(.985)" : style.transform,
  };
  const generation = ++contactGeneration;
  contactOpen = open;
  contactAnimation?.cancel();
  contactToggle.setAttribute("aria-expanded", String(open));
  contactPanel.hidden = false;
  contactPanel.inert = !open;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    contactPanel.hidden = !open;
    return;
  }
  contactAnimation = contactPanel.animate(
    [
      from,
      open
        ? { opacity: 1, transform: "translateY(0) scale(1)" }
        : { opacity: 0, transform: "translateY(6px) scale(.99)" },
    ],
    {
      duration: open ? 320 : 190,
      easing: open ? "cubic-bezier(.22,1,.36,1)" : "cubic-bezier(.4,0,1,1)",
      fill: "both",
    },
  );
  contactAnimation.finished
    .then(() => {
      if (generation !== contactGeneration) return;
      contactPanel.hidden = !open;
      contactAnimation.cancel();
      contactAnimation = null;
    })
    .catch(() => {});
}
const closeContact = () => setContact(false);
contactToggle?.addEventListener("click", () => setContact(!contactOpen));
document.querySelector(".contact-close")?.addEventListener("click", () => {
  closeContact();
  contactToggle.focus({ preventScroll: true });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contactOpen) {
    closeContact();
    contactToggle.focus({ preventScroll: true });
  }
});
document.addEventListener("click", (event) => {
  if (contactOpen && !event.target.closest(".contact-widget")) closeContact();
});
matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
  "change",
  (event) => {
    if (event.matches && contactPanel) setContact(contactOpen);
  },
);
document.querySelector("#contact-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = document.querySelector("#contact-message").value.trim();
  if (!value) return;
  window.open(
    "https://wa.me/77472886509?text=" +
      encodeURIComponent("Здравствуйте! " + value),
    "_blank",
    "noopener,noreferrer",
  );
});
const certDialog = document.querySelector("#certificate-lightbox");
if (certDialog) {
  let current = 0,
    zoomLevel = 1,
    opener;
  const large = document.querySelector("#certificate-large"),
    view = document.querySelector(".certificate-view"),
    zoomIn = document.querySelector("#certificate-zoom-in"),
    zoomOut = document.querySelector("#certificate-zoom-out");
  function applyZoom(preserve = true) {
    if (!certDialog.open || !large.naturalWidth) return;
    const oldWidth = large.getBoundingClientRect().width,
      oldHeight = large.getBoundingClientRect().height,
      cx = oldWidth
        ? (view.scrollLeft +
            view.clientWidth / 2 -
            Math.max(16, (view.clientWidth - oldWidth) / 2)) /
          oldWidth
        : 0.5,
      cy = oldHeight
        ? (view.scrollTop + view.clientHeight / 2 - 16) / oldHeight
        : 0.5;
    const fit = Math.min(
      (view.clientWidth - 32) / large.naturalWidth,
      (view.clientHeight - 32) / large.naturalHeight,
    );
    const width = Math.max(1, large.naturalWidth * fit * zoomLevel),
      height = Math.max(1, large.naturalHeight * fit * zoomLevel);
    large.style.width = width + "px";
    large.style.height = height + "px";
    view.dataset.zoom = zoomLevel;
    zoomOut.disabled = zoomLevel <= 1;
    zoomIn.disabled = zoomLevel >= 2.5;
    document.querySelector("#certificate-scale").textContent =
      "Масштаб " + Math.round(zoomLevel * 100) + "%";
    if (zoomLevel === 1 || !preserve) {
      view.scrollLeft = 0;
      view.scrollTop = 0;
    } else {
      view.scrollLeft = Math.max(
        0,
        cx * width +
          Math.max(16, (view.clientWidth - width) / 2) -
          view.clientWidth / 2,
      );
      view.scrollTop = Math.max(0, cy * height + 16 - view.clientHeight / 2);
    }
  }
  large.addEventListener("load", () => applyZoom(false));
  window.addEventListener("resize", () => applyZoom());
  const renderCertificate = () => {
    large.src = "/assets/certificates/origine-france-" + (current + 1) + ".jpg";
    large.alt = "Документ Origine France Garantie, страница " + (current + 1);
    document.querySelector("#certificate-page-label").textContent =
      "Страница " + (current + 1) + " из 3";
    document.querySelector("#certificate-counter").textContent =
      current + 1 + " / 3";
    zoomLevel = 1;
    view.dataset.zoom = "1";
    zoomOut.disabled = true;
    zoomIn.disabled = false;
    document.querySelector("#certificate-scale").textContent = "Масштаб 100%";
    requestAnimationFrame(() => applyZoom(false));
    document.querySelector("#certificate-prev").disabled = current === 0;
    document.querySelector("#certificate-next").disabled = current === 2;
  };
  document.querySelectorAll("[data-certificate]").forEach((button) =>
    button.addEventListener("click", () => {
      opener = button;
      current = Number(button.dataset.certificate);
      renderCertificate();
      certDialog.showModal();
      requestAnimationFrame(() => applyZoom(false));
    }),
  );
  document.querySelector("#certificate-prev").onclick = () => {
    if (current > 0) {
      current--;
      renderCertificate();
    }
  };
  document.querySelector("#certificate-next").onclick = () => {
    if (current < 2) {
      current++;
      renderCertificate();
    }
  };
  document.querySelector("#certificate-close").onclick = () =>
    certDialog.close();
  certDialog.addEventListener("close", () =>
    opener?.focus({ preventScroll: true }),
  );
  zoomIn.onclick = () => {
    zoomLevel = Math.min(2.5, zoomLevel + 0.25);
    applyZoom();
  };
  zoomOut.onclick = () => {
    zoomLevel = Math.max(1, zoomLevel - 0.25);
    applyZoom();
  };
  const track = document.querySelector(".certificate-track");
  document.querySelector(".certificate-scroll-prev").onclick = () =>
    track.scrollBy({
      left: -track.clientWidth * 0.85,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  document.querySelector(".certificate-scroll-next").onclick = () =>
    track.scrollBy({
      left: track.clientWidth * 0.85,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  certDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" && current < 2) {
      current++;
      renderCertificate();
    }
    if (event.key === "ArrowLeft" && current > 0) {
      current--;
      renderCertificate();
    }
  });
}
function updateFavoriteCount() {
  let ids = [];
  try {
    ids = JSON.parse(localStorage.getItem("arafan-favorites") || "[]");
    if (!Array.isArray(ids)) ids = [];
  } catch {}
  document.querySelectorAll(".favorites-count").forEach((e) => {
    e.textContent = ids.length;
    e.hidden = ids.length === 0;
  });
  document
    .querySelector(".header-favorites")
    ?.setAttribute("aria-label", "Открыть избранное: " + ids.length);
}
updateFavoriteCount();
window.addEventListener("store:favorites-changed", updateFavoriteCount);
window.addEventListener("storage", updateFavoriteCount);
const mega = document.querySelector("#mega-catalog"),
  catalogLink = document.querySelector("#main-catalog-link");
if (mega && catalogLink) {
  const desktop = matchMedia("(min-width:1081px) and (hover:hover)");
  let wanted = false,
    animation,
    generation = 0,
    enterTimer,
    leaveTimer;
  function showMega(open, keyboard = false) {
    clearTimeout(enterTimer);
    clearTimeout(leaveTimer);
    if (open && !desktop.matches) return;
    const hidden = mega.hidden,
      style = hidden ? null : getComputedStyle(mega);
    const from = {
      opacity: hidden ? 0 : style.opacity,
      transform: hidden ? "translateY(-8px) scale(.995)" : style.transform,
    };
    wanted = open;
    const turn = ++generation;
    animation?.cancel();
    catalogLink.setAttribute("aria-expanded", String(open));
    mega.hidden = false;
    mega.inert = !open;
    if (keyboard || matchMedia("(prefers-reduced-motion:reduce)").matches) {
      mega.hidden = !open;
      if (keyboard && open) mega.querySelector("a").focus();
      return;
    }
    animation = mega.animate(
      [
        from,
        open
          ? { opacity: 1, transform: "none" }
          : { opacity: 0, transform: "translateY(-4px)" },
      ],
      {
        duration: open ? 300 : 170,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "both",
      },
    );
    animation.finished
      .then(() => {
        if (turn !== generation) return;
        mega.hidden = !open;
        animation.cancel();
        animation = null;
      })
      .catch(() => {});
    if (keyboard && open)
      mega.querySelector("a").focus({ preventScroll: true });
  }
  catalogLink.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    clearTimeout(leaveTimer);
    enterTimer = setTimeout(() => showMega(true), 80);
  });
  mega.addEventListener("pointerenter", () => clearTimeout(leaveTimer));
  document.querySelector(".header").addEventListener("pointerleave", () => {
    clearTimeout(enterTimer);
    if (wanted) leaveTimer = setTimeout(() => showMega(false), 150);
  });
  catalogLink.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && desktop.matches) {
      event.preventDefault();
      showMega(true, true);
    }
  });
  document.querySelector(".mega-close").onclick = () => {
    showMega(false);
    catalogLink.focus({ preventScroll: true });
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && wanted) {
      showMega(false);
      catalogLink.focus({ preventScroll: true });
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (wanted && !event.target.closest(".header")) showMega(false);
  });
  document.querySelector(".header").addEventListener("focusout", () =>
    setTimeout(() => {
      if (
        wanted &&
        !mega.contains(document.activeElement) &&
        document.activeElement !== catalogLink
      )
        showMega(false);
    }, 0),
  );
  document.querySelectorAll("[data-mega-group]").forEach((link) => {
    const select = () => {
      document
        .querySelectorAll("[data-mega-group]")
        .forEach((a) => a.classList.toggle("is-active", a === link));
      document.querySelectorAll("[data-mega-content]").forEach((panel) => {
        panel.hidden = panel.dataset.megaContent !== link.dataset.megaGroup;
      });
    };
    link.addEventListener("pointerenter", select);
    link.addEventListener("focus", select);
  });
  document.querySelector(".header").addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) showMega(false, true);
  });
  desktop.addEventListener("change", () => showMega(false));
}

// Shared bag/favorite controls for catalog, home and asynchronously loaded cards.
const productBagIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7ZM9 8V6a3 3 0 0 1 6 0v2"/></svg>';
const productHeartIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.5c-2.2-2.3-5.6-1.8-8.5 1.3-2.9-3.1-6.3-3.6-8.5-1.3C.6 8.5 3 13 12 20c9-7 11.4-11.5 8.5-14.5Z"/></svg>';
function readFavorites() {
  try {
    const ids = JSON.parse(localStorage.getItem("arafan-favorites") || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}
function syncProductActions() {
  const saved = readFavorites();
  document.querySelectorAll(".product-card[data-product]").forEach((card) => {
    const add = card.querySelector("[data-add]");
    if (!add) return;
    const name = card.querySelector("h1,h3")?.textContent.trim() || "аромат";
    add.classList.add("icon-cart-button");
    if (!add.classList.contains("is-added"))
      add.innerHTML =
        productBagIcon +
        `<span class="cart-label">${add.disabled ? "Нет в наличии" : "В корзину"}</span>`;
    add.setAttribute(
      "aria-label",
      add.disabled
        ? "Аромат пока недоступен"
        : "Добавить " + name + " в корзину",
    );
    add.title = "Добавить в корзину";
    let favorite = card.querySelector(".favorite-toggle");
    if (!favorite) {
      const row = document.createElement("div");
      row.className = "card-actions";
      add.before(row);
      row.append(add);
      favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "favorite-toggle";
      favorite.innerHTML = productHeartIcon;
      row.append(favorite);
    }
    favorite.dataset.favoriteId = card.dataset.product;
    const selected = saved.includes(card.dataset.product);
    favorite.setAttribute("aria-pressed", String(selected));
    favorite.setAttribute(
      "aria-label",
      (selected ? "Убрать " : "Сохранить ") +
        name +
        (selected ? " из избранного" : " в избранное"),
    );
    favorite.title = selected
      ? "Убрать из избранного"
      : "Сохранить в избранное";
  });
  updateFavoriteCount();
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (!button) return;
  const id = button.dataset.favoriteId,
    ids = readFavorites(),
    next = ids.includes(id)
      ? ids.filter((value) => value !== id)
      : [...ids, id];
  try {
    localStorage.setItem("arafan-favorites", JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event("store:favorites-changed"));
});
syncProductActions();
document.addEventListener("store:refresh-controls", syncProductActions);
window.addEventListener("store:favorites-changed", syncProductActions);
window.addEventListener("storage", syncProductActions);
