import { mkdir, writeFile, access } from "node:fs/promises";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { privateDir } from "../server/store.mjs";

await mkdir(privateDir, { recursive: true, mode: 0o700 });
const authPath = resolve(privateDir, "admin.json");
try {
  await access(authPath);
  console.log(
    "Вход уже настроен. Данные: site/private/admin-access.txt. Пароль не изменён.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const password = randomBytes(18).toString("base64url");
  const salt = randomBytes(24).toString("hex");
  const hash = Buffer.from(
    await promisify(scrypt)(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    }),
  ).toString("hex");
  await writeFile(authPath, JSON.stringify({ salt, hash }), {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    resolve(privateDir, "admin-access.txt"),
    `Capella Perfume — локальный кабинет\nАдрес: http://127.0.0.1:${Number(process.env.ADMIN_PORT || 4174)}/\nЛогин: admin\nПароль: ${password}\n\nХраните этот файл только у себя. Он исключён из Git.\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Создан отдельный пароль. Он сохранён в site/private/admin-access.txt и не выводится в журналы.",
  );
}
