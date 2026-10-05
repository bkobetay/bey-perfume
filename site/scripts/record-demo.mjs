// Records an isolated demo. Never reads the live private directory.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  stat,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ffmpeg = process.env.DEMO_FFMPEG;
assert.ok(
  ffmpeg,
  "Set DEMO_FFMPEG to an FFmpeg executable with libx264 and drawtext.",
);
const output = resolve(
  root,
  process.env.DEMO_OUTPUT_DIR || "artifacts/ego-demo",
);
await mkdir(output, { recursive: true });
const privateDir = await mkdtemp(join(tmpdir(), "ego-recording-"));
const port = process.env.DEMO_PORT || "4187";
const adminPort = process.env.DEMO_ADMIN_PORT || "4188";
const shopURL = `http://127.0.0.1:${port}`;
const adminURL = `http://127.0.0.1:${adminPort}`;
const env = {
  ...process.env,
  PORT: port,
  ADMIN_PORT: adminPort,
  BEY_PRIVATE_DIR: privateDir,
};
const servers = [];
let browser;
const errors = [];
const cues = [];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function command(binary, args) {
  await new Promise((done, reject) => {
    const child = spawn(binary, args, {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-6000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? done() : reject(new Error(stderr)),
    );
  });
}

try {
  const setup = spawnSync(process.execPath, ["scripts/setup-admin.mjs"], {
    cwd: join(root, "site"),
    env,
    stdio: "pipe",
  });
  assert.equal(setup.status, 0, "Temporary admin setup failed");
  const password = /Пароль: (.+)/.exec(
    await readFile(join(privateDir, "admin-access.txt"), "utf8"),
  )[1];
  for (const args of [
    ["scripts/serve.mjs"],
    ["scripts/serve.mjs", "--admin"],
  ]) {
    const child = spawn(process.execPath, args, {
      cwd: join(root, "site"),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    servers.push(child);
    await new Promise((done, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Demo server startup timeout")),
        8000,
      );
      child.stdout.once("data", () => {
        clearTimeout(timer);
        done();
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Demo server exited: ${code}`));
      });
    });
  }
  browser = await chromium.launch({
    channel: process.env.DEMO_BROWSER || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: join(output, "raw"),
      size: { width: 1440, height: 900 },
    },
    locale: "ru-RU",
  });
  const login = await context.request.post(`${adminURL}/api/admin/login`, {
    data: { username: "admin", password },
    headers: { Origin: adminURL },
  });
  assert.equal(login.status(), 200, "Temporary seller login failed");
  // A visible pointer makes the real browser interactions easier to follow.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const curtain = document.createElement("div");
      curtain.id = "demo-curtain";
      curtain.style.cssText =
        "position:fixed;inset:0;background:#060b14;opacity:1;pointer-events:none;z-index:2147483646;transition:opacity 650ms ease";
      document.body.append(curtain);
      document.fonts.ready.then(() =>
        setTimeout(() => {
          curtain.style.opacity = "0";
        }, 250),
      );
      const pointer = document.createElement("div");
      pointer.style.cssText =
        "position:fixed;left:-100px;top:-100px;width:18px;height:18px;border:2px solid #ecd6ae;border-radius:50%;background:#ccb48d35;pointer-events:none;z-index:2147483647;box-shadow:0 0 16px #ccb48d55;transform:translate(-50%,-50%)";
      document.body.append(pointer);
      document.addEventListener("mousemove", (event) => {
        pointer.style.left = `${event.clientX}px`;
        pointer.style.top = `${event.clientY}px`;
      });
      document.addEventListener("mousedown", () =>
        pointer.animate(
          [
            { boxShadow: "0 0 0 0 #ecd6ae88" },
            { boxShadow: "0 0 0 18px #ecd6ae00" },
          ],
          { duration: 500 },
        ),
      );
    });
  });
  const started = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  const at = async (seconds) =>
    wait(Math.max(0, started + seconds * 1000 - Date.now()));
  const cue = (text) => {
    cues.push({ start: (Date.now() - started) / 1000, text });
    console.log(text);
  };
  let cursor = { x: 1300, y: 750 };
  const move = async (x, y) => {
    const from = { ...cursor };
    const start = Date.now();
    for (let step = 1; step <= 36; step++) {
      const t = step / 36;
      const eased = t * t * (3 - 2 * t);
      await page.mouse.move(
        from.x + (x - from.x) * eased,
        from.y + (y - from.y) * eased,
      );
      await wait(Math.max(0, start + step * 20 - Date.now()));
    }
    cursor = { x, y };
  };
  const scroll = async (locator) => {
    await locator.evaluate(async (element) => {
      const box = element.getBoundingClientRect();
      if (box.top >= 100 && box.bottom <= innerHeight - 30) return;
      const from = scrollY;
      const to = Math.max(
        0,
        Math.min(
          document.documentElement.scrollHeight - innerHeight,
          from + box.top - 130,
        ),
      );
      const start = performance.now();
      await new Promise((resolve) => {
        function frame(now) {
          const t = Math.min(1, (now - start) / 1100);
          window.scrollTo({
            top: from + (to - from) * (t * t * (3 - 2 * t)),
            behavior: "instant",
          });
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    });
  };
  const transition = async (action) => {
    await page.evaluate(() => {
      document.getElementById("demo-curtain").style.opacity = "1";
    });
    await wait(700);
    await action();
    await page.evaluate(() => {
      document.getElementById("demo-curtain").style.opacity = "0";
    });
    await wait(850);
  };
  const point = async (locator) => {
    const box = await locator.boundingBox();
    assert.ok(box);
    await move(box.x + box.width / 2, box.y + box.height / 2);
  };
  const click = async (locator) => {
    await scroll(locator);
    await point(locator);
    await wait(220);
    await locator.click();
  };
  const shot = (name) => page.screenshot({ path: join(output, `${name}.png`) });

  await page.goto(shopURL);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => img.loading !== "lazy")
        .map((img) => img.decode()),
    );
  });
  cue("EGO · Нишевая парфюмерия");
  await at(3);
  await point(page.getByRole("link", { name: "Открыть каталог", exact: true }));
  await shot("01-home");
  await at(6);
  cue("Подборка ароматов — знакомство с коллекцией");
  await scroll(page.locator("#selection"));
  await point(page.locator('.selection-grid [data-product="ombre-leather"]'));
  await at(10);
  await transition(() => page.goto(`${shopURL}/catalog.html`));
  cue("Каталог: фильтры по нотам и быстрый поиск");
  await wait(800);
  await click(page.getByRole("tab", { name: "Кожаные", exact: true }));
  await at(14);
  const search = page.getByLabel("Поиск аромата", { exact: true });
  await click(search);
  await search.pressSequentially("Ombré", { delay: 90 });
  await wait(600);
  const card = page.locator('[data-product="ombre-leather"]');
  await scroll(card);
  await shot("02-catalog");
  await at(18);
  cue("Выбираем 10 мл — стоимость рассчитывается автоматически");
  await point(card.locator(".volume-select"));
  await card.locator(".volume-select").selectOption("10");
  await wait(700);
  await click(card.locator("[data-add]"));
  await at(22);
  await click(
    page.getByRole("button", { name: "Открыть корзину", exact: true }),
  );
  cue("Заявка: аромат, объём, имя и телефон клиента");
  await page
    .getByLabel("Твоё имя", { exact: true })
    .pressSequentially("Айдана", { delay: 120 });
  await page
    .getByLabel("Номер телефона", { exact: true })
    .pressSequentially("7000000000", { delay: 100 });
  await page.getByLabel("Разрешаю связаться").check();
  await shot("03-cart");
  await at(30);
  await click(
    page.getByRole("button", { name: "Оставить заявку", exact: true }),
  );
  await page.locator(".order-success:visible").waitFor();
  assert.match(await page.locator(".receipt-code").innerText(), /^EGO-/);
  cue("Заявка создана — клиент получает номер заказа");
  await shot("04-receipt");
  await at(34);
  await transition(() => page.goto(adminURL));
  await page.locator("#dashboard:visible").waitFor();
  await page.locator(".order-card").waitFor();
  cue("Кабинет продавца: все детали заказа в одном месте");
  await scroll(page.locator(".order-card"));
  await shot("05-seller");
  await at(40);
  cue("Продавец проверяет оплату и подтверждает заказ");
  await page
    .getByLabel("Статус заказа", { exact: true })
    .selectOption("confirmed");
  const paid = page.getByLabel(
    "Оплата проверена. Подтверждаю списание объёма со склада.",
  );
  await scroll(paid);
  await wait(800);
  await paid.check();
  await wait(700);
  await click(page.getByRole("button", { name: "Сохранить", exact: true }));
  await page.waitForFunction(() =>
    document
      .querySelector(".order-stock-state")
      ?.textContent.startsWith("Объём списан"),
  );
  await at(46);
  cue("Склад обновляется автоматически: 100 мл − 10 мл = 90 мл");
  await transition(() =>
    page.getByRole("button", { name: "Склад", exact: true }).click(),
  );
  const stock = page.locator(
    '.inventory-card[data-stock-product="ombre-leather"]',
  );
  await stock.waitFor();
  assert.equal(await stock.locator(".stock-amount").innerText(), "90 мл");
  await scroll(stock);
  await wait(1000);
  await shot("06-stock");
  await at(51);
  cue("Новое поступление? Продавец сам пополняет остатки");
  await stock.getByLabel("Операция", { exact: true }).selectOption("add");
  await stock.getByLabel("Объём, мл", { exact: true }).fill("50");
  await stock
    .getByLabel("Комментарий", { exact: true })
    .fill("Новое поступление");
  await wait(700);
  await click(stock.getByRole("button", { name: "Сохранить остаток" }));
  await page.waitForFunction(
    () =>
      document.querySelector(
        '[data-stock-product="ombre-leather"] .stock-amount',
      )?.textContent === "140 мл",
  );
  await shot("07-replenished");
  await at(57);
  cue("EGO · Витрина, заказы и склад вместе");
  await move(1300, 700);
  await at(60);
  assert.deepEqual(errors, []);
  const recording = page.video();
  await context.close();
  const raw = await recording.path();
  await browser.close();
  browser = null;
  await writeFile(join(output, "timeline.json"), JSON.stringify(cues, null, 2));
  // Add a dedicated caption band below the viewport; never obscure the UI.
  const font = join(root, "site/dist/assets/fonts/manrope-regular.ttf");
  const filters = [
    "setpts=PTS-STARTPTS",
    "fps=50",
    "tpad=stop_mode=clone:stop_duration=2",
    "trim=duration=60",
    "pad=iw:ih+88:0:0:color=0x060b14",
    `drawtext=fontfile='${font}':text='ДЕМОВЕРСИЯ · демонстрационные данные':fontsize=15:fontcolor=0x9f9f94:x=(w-tw)/2:y=h-25`,
  ];
  for (let index = 0; index < cues.length; index++) {
    const caption = join(output, `caption-${index}.txt`);
    await writeFile(caption, cues[index].text);
    filters.push(
      `drawtext=fontfile='${font}':textfile='${caption}':fontsize=25:fontcolor=0xecd6ae:x=(w-tw)/2:y=h-68:enable='between(t,${index === 0 ? 0 : cues[index].start},${cues[index + 1]?.start || 68})'`,
    );
  }
  filters.push("fade=t=in:st=0:d=0.5", "fade=t=out:st=59:d=1");
  const filterFile = join(output, "captions.filter");
  await writeFile(filterFile, filters.join(","));
  const mp4 = join(output, "EGO-15MB.mp4");
  const encoding = [
    "-y",
    "-i",
    raw,
    "-filter_script:v",
    filterFile,
    "-t",
    "60",
    "-r",
    "50",
    "-c:v",
    "libx264",
    "-preset",
    "veryslow",
    "-b:v",
    "1950k",
    "-pix_fmt",
    "yuv420p",
    "-an",
  ];
  const passlog = join(output, "quality-pass");
  await command(ffmpeg, [
    ...encoding,
    "-pass",
    "1",
    "-passlogfile",
    passlog,
    "-f",
    "null",
    "/dev/null",
  ]);
  await command(ffmpeg, [
    ...encoding,
    "-pass",
    "2",
    "-passlogfile",
    passlog,
    "-movflags",
    "+faststart",
    mp4,
  ]);
  await command(ffmpeg, ["-v", "error", "-i", mp4, "-f", "null", "-"]);
  const { size } = await stat(mp4);
  assert.ok(
    size < 16_000_000,
    "Demo exceeds the conservative 16 MB sharing budget.",
  );
  console.log(`Sharing size: ${(size / 1_000_000).toFixed(2)} MB`);
  console.log(`Video verified: ${mp4}`);
} finally {
  await browser?.close();
  for (const child of servers.filter((server) => server.exitCode === null)) {
    await new Promise((done) => {
      child.once("exit", done);
      child.kill("SIGTERM");
    });
  }
  await rm(privateDir, { recursive: true, force: true });
}
