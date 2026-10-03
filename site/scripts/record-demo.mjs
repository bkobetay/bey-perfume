// Records an isolated demo. Never reads the live private directory.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
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
const output = resolve(root, "artifacts/perfume-studio-demo");
await mkdir(output, { recursive: true });
const privateDir = await mkdtemp(join(tmpdir(), "perfume-studio-recording-"));
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
  const point = async (locator) => {
    const box = await locator.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 22,
    });
  };
  const click = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
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
  cue("PERFUME STUDIO · Разливная парфюмерия");
  await at(3);
  await point(page.getByRole("link", { name: "Открыть каталог", exact: true }));
  await shot("01-home");
  await at(7);
  cue("Подборка ароматов — знакомство с коллекцией");
  await page
    .locator("#selection")
    .evaluate((element) =>
      element.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  await wait(1400);
  await point(page.locator('.selection-grid [data-product="aventus"]'));
  await at(12);
  await page.goto(`${shopURL}/catalog.html`);
  cue("Каталог: фильтры по нотам и быстрый поиск");
  await wait(800);
  await click(page.getByRole("tab", { name: "Свежие", exact: true }));
  await at(16);
  const search = page.getByLabel("Поиск аромата", { exact: true });
  await click(search);
  await search.pressSequentially("Aventus", { delay: 90 });
  await wait(600);
  const card = page.locator('[data-product="aventus"]');
  await card.scrollIntoViewIfNeeded();
  await shot("02-catalog");
  await at(20);
  cue("Выбираем 10 мл — стоимость рассчитывается автоматически");
  await point(card.locator(".volume-select"));
  await card.locator(".volume-select").selectOption("10");
  await wait(700);
  await click(card.locator("[data-add]"));
  await at(24);
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
  await at(33);
  await click(
    page.getByRole("button", { name: "Оставить заявку", exact: true }),
  );
  await page.locator(".order-success:visible").waitFor();
  assert.match(await page.locator(".receipt-code").innerText(), /^PS-/);
  cue("Заявка создана — клиент получает номер заказа");
  await shot("04-receipt");
  await at(38);
  await page.goto(adminURL);
  await page.locator("#dashboard:visible").waitFor();
  await page.locator(".order-card").waitFor();
  cue("Кабинет продавца: все детали заказа в одном месте");
  await page
    .locator(".order-card")
    .evaluate((element) =>
      element.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  await wait(1200);
  await shot("05-seller");
  await at(44);
  cue("Продавец проверяет оплату и подтверждает заказ");
  await page
    .getByLabel("Статус заказа", { exact: true })
    .selectOption("confirmed");
  const paid = page.getByLabel(
    "Оплата проверена. Подтверждаю списание объёма со склада.",
  );
  await paid.scrollIntoViewIfNeeded();
  await wait(800);
  await paid.check();
  await wait(700);
  await click(page.getByRole("button", { name: "Сохранить", exact: true }));
  await page.waitForFunction(() =>
    document
      .querySelector(".order-stock-state")
      ?.textContent.startsWith("Объём списан"),
  );
  await at(50);
  cue("Склад обновляется автоматически: 100 мл − 10 мл = 90 мл");
  await click(page.getByRole("button", { name: "Склад", exact: true }));
  const stock = page.locator('.inventory-card[data-stock-product="aventus"]');
  await stock.waitFor();
  assert.equal(await stock.locator(".stock-amount").innerText(), "90 мл");
  await stock.evaluate((element) =>
    element.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await wait(1000);
  await shot("06-stock");
  await at(55);
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
      document.querySelector('[data-stock-product="aventus"] .stock-amount')
        ?.textContent === "140 мл",
  );
  await shot("07-replenished");
  await at(61);
  await page.goto(shopURL);
  cue("PERFUME STUDIO · Витрина, заказы и склад вместе");
  await page.mouse.move(1300, 700, { steps: 15 });
  await at(66);
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
    "pad=iw:ih+88:0:0:color=0x101110",
    `drawtext=fontfile='${font}':text='ДЕМОВЕРСИЯ · демонстрационные данные':fontsize=15:fontcolor=0x9f9f94:x=(w-tw)/2:y=h-25`,
  ];
  for (let index = 0; index < cues.length; index++) {
    const caption = join(output, `caption-${index}.txt`);
    await writeFile(caption, cues[index].text);
    filters.push(
      `drawtext=fontfile='${font}':textfile='${caption}':fontsize=25:fontcolor=0xecd6ae:x=(w-tw)/2:y=h-68:enable='between(t,${index === 0 ? 0 : cues[index].start},${cues[index + 1]?.start || 68})'`,
    );
  }
  filters.push("fade=t=in:st=0:d=0.5", "fade=t=out:st=65:d=1");
  const filterFile = join(output, "captions.filter");
  await writeFile(filterFile, filters.join(","));
  const mp4 = join(output, "Perfume-Studio-demo.mp4");
  await command(ffmpeg, [
    "-y",
    "-i",
    raw,
    "-filter_script:v",
    filterFile,
    "-t",
    "66",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4,
  ]);
  await command(ffmpeg, ["-v", "error", "-i", mp4, "-f", "null", "-"]);
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
