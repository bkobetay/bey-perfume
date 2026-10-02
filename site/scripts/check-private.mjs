import { execFileSync } from "node:child_process";
// Inspect the actual committed tree and unpushed history, not ignored/untracked local data.
const pending = execFileSync(
  "git",
  ["rev-list", "--all", "--not", "--remotes"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
const revisions = new Set(["HEAD", ...pending]);
const files = [
  ...new Set(
    [...revisions].flatMap((revision) =>
      execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", revision], {
        encoding: "utf8",
      })
        .split("\0")
        .filter(Boolean),
    ),
  ),
];
const privatePath = (name) =>
  /(^|\/)private\//.test(name) ||
  (/(^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith(".env.example")) ||
  /\.(?:sqlite(?:-.*)?|db(?:-.*)?|pem|key)$/.test(name) ||
  /(^|\/)admin-access\.txt$/.test(name);
const blocked = files.filter(privatePath);
if (blocked.length) {
  console.error(
    "[TS] Push blocked: private files are committed. Remove them from Git before uploading:\n" +
      blocked.join("\n"),
  );
  process.exit(1);
}
console.log(
  "[TS] No private data paths in the committed tree or unpushed history.",
);
