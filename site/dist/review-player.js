(() => {
  const links = [...document.querySelectorAll("[data-video]")];
  if (!links.length) return;
  const dialog = document.createElement("dialog");
  dialog.className = "video-dialog";
  dialog.setAttribute("aria-labelledby", "video-title");
  dialog.innerHTML =
    '<div class="video-heading"><div><p class="eyebrow">BEY / ALISH</p><h2 id="video-title"></h2></div><button type="button" class="icon-close" aria-label="Закрыть видео">×</button></div><video controls playsinline preload="none"></video><p class="video-error" role="status" hidden>Не удалось воспроизвести видео. <a>Открыть файл</a></p>';
  document.body.append(dialog);
  const video = dialog.querySelector("video"),
    error = dialog.querySelector(".video-error");
  let opener;
  links.forEach((link) =>
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opener = link;
      dialog.querySelector("h2").textContent = link.dataset.title;
      error.hidden = true;
      error.querySelector("a").href = link.href;
      video.poster = link.dataset.poster;
      video.src = link.dataset.video;
      dialog.showModal();
      document.body.classList.add("video-open");
      // Play follows a user gesture. If the browser blocks it, native controls remain usable.
      video.play().catch(() => {});
    }),
  );
  video.addEventListener("error", () => {
    if (dialog.open && video.hasAttribute("src")) error.hidden = false;
  });
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    error.hidden = true;
    document.body.classList.remove("video-open");
    opener?.focus();
  });
})();
