(() => {
  const links = [...document.querySelectorAll("[data-video]")];
  if (!links.length) return;
  const icon = (paths) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const playIcon = icon('<path d="m9 5 11 7-11 7Z"/>');
  const pauseIcon = icon('<path d="M8 5v14M16 5v14"/>');
  const soundIcon = icon(
    '<path d="M11 4 5 9H2v6h3l6 5Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14"/>',
  );
  const mutedIcon = icon('<path d="M11 4 5 9H2v6h3l6 5Z M16 9l6 6m0-6-6 6"/>');
  const dialog = document.createElement("dialog");
  dialog.className = "video-dialog";
  dialog.setAttribute("aria-labelledby", "video-title");
  dialog.innerHTML = `<div class="video-heading"><div><p class="eyebrow">BEY / ALISH</p><h2 id="video-title"></h2></div><button type="button" class="icon-close" aria-label="Закрыть видео">×</button></div>
    <div class="video-stage"><video playsinline preload="none" tabindex="0" aria-label="Видеообзор ALISH. Пробел — пауза, стрелки — перемотка"></video>
    <div class="video-controls" role="group" aria-label="Управление видео">
      <input class="video-seek" type="range" min="0" max="100" step="0.1" value="0" aria-label="Позиция воспроизведения" disabled>
      <div class="video-control-row">
        <button type="button" data-action="play" aria-label="Воспроизвести">${playIcon}</button>
        <button type="button" data-action="back" aria-label="Назад на 10 секунд">${icon('<path d="M5 8a8 8 0 1 1-1 8 M5 3v5h5"/>')}<span>10</span></button>
        <button type="button" data-action="forward" aria-label="Вперёд на 10 секунд">${icon('<path d="M19 8a8 8 0 1 0 1 8 M19 3v5h-5"/>')}<span>10</span></button>
        <span class="video-time" aria-label="Время воспроизведения">0:00 / 0:00</span>
        <button type="button" data-action="mute" aria-label="Выключить звук">${soundIcon}</button>
        <button type="button" data-action="fullscreen" aria-label="Полный экран">${icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>')}</button>
      </div>
    </div></div><p class="video-status" role="status" hidden></p><p class="video-error" role="alert" hidden>Не удалось загрузить видео. <button type="button" data-action="retry">Повторить</button> · <a>Открыть файл</a></p>`;
  document.body.append(dialog);
  const video = dialog.querySelector("video");
  const stage = dialog.querySelector(".video-stage");
  const error = dialog.querySelector(".video-error");
  const status = dialog.querySelector(".video-status");
  const seek = dialog.querySelector(".video-seek");
  const play = dialog.querySelector('[data-action="play"]');
  const mute = dialog.querySelector('[data-action="mute"]');
  const full = dialog.querySelector('[data-action="fullscreen"]');
  let opener;
  const time = (value) => {
    const seconds = Number.isFinite(value) ? Math.floor(value) : 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const update = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.disabled = !duration || !!video.error;
    seek.max = duration || 100;
    seek.value = video.currentTime;
    seek.style.setProperty(
      "--progress",
      `${duration ? (video.currentTime / duration) * 100 : 0}%`,
    );
    seek.setAttribute(
      "aria-valuetext",
      `${time(video.currentTime)} из ${time(duration)}`,
    );
    dialog.querySelector(".video-time").textContent =
      `${time(video.currentTime)} / ${time(duration)}`;
    play.innerHTML = video.paused ? playIcon : pauseIcon;
    play.setAttribute("aria-label", video.paused ? "Воспроизвести" : "Пауза");
    mute.innerHTML = video.muted ? mutedIcon : soundIcon;
    mute.setAttribute(
      "aria-label",
      video.muted ? "Включить звук" : "Выключить звук",
    );
    mute.setAttribute("aria-pressed", String(video.muted));
  };
  const start = async () => {
    try {
      await video.play();
    } catch (e) {
      if (!dialog.open || e.name === "AbortError") return;
      if (e.name === "NotAllowedError") {
        status.textContent =
          "Нажмите кнопку воспроизведения, чтобы начать просмотр.";
        status.hidden = false;
      } else error.hidden = false;
    }
  };
  const toggle = () => (video.paused ? start() : video.pause());
  const skip = (seconds) => {
    if (Number.isFinite(video.duration))
      video.currentTime = Math.max(
        0,
        Math.min(video.duration, video.currentTime + seconds),
      );
  };
  play.onclick = toggle;
  video.onclick = toggle;
  seek.oninput = () => {
    video.currentTime = Number(seek.value);
    update();
  };
  dialog.querySelector('[data-action="back"]').onclick = () => skip(-10);
  dialog.querySelector('[data-action="forward"]').onclick = () => skip(10);
  mute.onclick = () => {
    video.muted = !video.muted;
  };
  full.hidden = !document.fullscreenEnabled && !video.webkitEnterFullscreen;
  full.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.requestFullscreen) await stage.requestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch {
      status.textContent = "Полноэкранный режим недоступен в этом браузере.";
      status.hidden = false;
    }
  };
  document.addEventListener("fullscreenchange", () =>
    full.setAttribute(
      "aria-label",
      document.fullscreenElement ? "Выйти из полного экрана" : "Полный экран",
    ),
  );
  video.onkeydown = (e) => {
    if ([" ", "k", "ArrowLeft", "ArrowRight", "m"].includes(e.key))
      e.preventDefault();
    if (e.key === " " || e.key === "k") toggle();
    if (e.key === "ArrowLeft") skip(-5);
    if (e.key === "ArrowRight") skip(5);
    if (e.key === "m") video.muted = !video.muted;
  };
  for (const event of [
    "timeupdate",
    "durationchange",
    "loadedmetadata",
    "play",
    "pause",
    "ended",
    "volumechange",
    "emptied",
  ])
    video.addEventListener(event, update);
  video.addEventListener("waiting", () => {
    if (!video.error) {
      status.textContent = "Загружаем видео…";
      status.hidden = false;
    }
  });
  for (const event of ["playing", "canplay"])
    video.addEventListener(event, () => {
      status.hidden = true;
    });
  video.addEventListener("error", () => {
    if (dialog.open && video.hasAttribute("src")) {
      error.hidden = false;
      status.hidden = true;
      update();
    }
  });
  dialog.querySelector('[data-action="retry"]').onclick = () => {
    error.hidden = true;
    video.load();
    start();
  };
  links.forEach((link) =>
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opener = link;
      dialog.querySelector("h2").textContent = link.dataset.title;
      error.hidden = true;
      status.hidden = true;
      error.querySelector("a").href = link.href;
      video.poster = link.dataset.poster;
      video.src = link.dataset.video;
      dialog.showModal();
      document.body.classList.add("video-open");
      update();
      start();
    }),
  );
  dialog.querySelector(".icon-close").onclick = () => dialog.close();
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
    status.hidden = true;
    document.body.classList.remove("video-open");
    opener?.focus();
  });
})();
