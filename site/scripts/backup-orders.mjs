import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, chmod, access } from "node:fs/promises";
import { resolve } from "node:path";
import { privateDir } from "../server/store.mjs";
const source = resolve(privateDir, "orders.sqlite");
await access(source);
const directory = resolve(privateDir, "backups");
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = resolve(
  directory,
  `orders-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  await chmod(target, 0o600);
  console.log("Локальная копия заказов: " + target);
} finally {
  db.close();
}
