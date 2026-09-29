import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("50 reviews stay paginated separately; homepage has three and unsafe links fail", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bey-reviews-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ["dist", "scripts", "data"]) await mkdir(join(root, dir));
  for (const file of [
    "dist/index.html",
    "dist/reviews.html",
    "scripts/reviews.mjs",
  ])
    await copyFile(new URL("../" + file, import.meta.url), join(root, file));
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: "test-" + i,
    title: "Обзор " + i,
    topic: "Ноты",
    visual: "bottle",
    url: "https://www.instagram.com/bey_perfume/",
  }));
  items[0].title = "<script>test</script>";
  await writeFile(join(root, "data/reviews.json"), JSON.stringify(items));
  assert.equal(
    spawnSync(process.execPath, ["scripts/reviews.mjs"], { cwd: root }).status,
    0,
  );
  const home = await readFile(join(root, "dist/index.html"), "utf8"),
    library = await readFile(join(root, "dist/reviews.html"), "utf8");
  assert.equal((home.match(/data-review=/g) || []).length, 3);
  assert.equal((library.match(/data-review=/g) || []).length, 50);
  assert.ok(library.includes("&lt;script&gt;test&lt;/script&gt;"));
  assert.ok(!library.includes("<script>test"));
  items[0].url = "javascript:alert(1)";
  await writeFile(join(root, "data/reviews.json"), JSON.stringify(items));
  assert.notEqual(
    spawnSync(process.execPath, ["scripts/reviews.mjs"], { cwd: root }).status,
    0,
  );
  items[0].url = "https://evil.example/video";
  await writeFile(join(root, "data/reviews.json"), JSON.stringify(items));
  assert.notEqual(
    spawnSync(process.execPath, ["scripts/reviews.mjs"], { cwd: root }).status,
    0,
  );
});
