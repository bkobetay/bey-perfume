import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("private-path guard detects secrets even when removed in a later unpushed commit", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bey-git-guard-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: dir });
    assert.equal(r.status, 0);
  };
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  await writeFile(join(dir, "index.html"), "demo");
  git("add", ".");
  git("commit", "-qm", "safe");
  const check = () =>
    spawnSync(
      process.execPath,
      [new URL("../scripts/check-private.mjs", import.meta.url).pathname],
      { cwd: dir },
    );
  assert.equal(check().status, 0);
  await mkdir(join(dir, "site/private"), { recursive: true });
  await writeFile(
    join(dir, "site/private/admin-access.txt"),
    "synthetic fixture, not credentials",
  );
  git("add", ".");
  git("commit", "-qm", "unsafe fixture");
  assert.equal(check().status, 1);
  git("rm", "site/private/admin-access.txt");
  git("commit", "-qm", "remove fixture");
  assert.equal(check().status, 1);
});
