// Production credentials are created only inside the ignored private directory.
import { mkdir, writeFile, access } from "node:fs/promises";
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { resolve } from "node:path";
const directory = resolve(
  new URL("../private/cloudflare/", import.meta.url).pathname,
);
await mkdir(directory, { recursive: true, mode: 0o700 });
try {
  await access(resolve(directory, "secrets.json"));
  console.log("Production access already exists; preserved.");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  const password = randomBytes(24).toString("base64url"),
    salt = randomBytes(24).toString("hex"),
    hash = pbkdf2Sync(
      password,
      Buffer.from(salt, "hex"),
      100000,
      32,
      "sha256",
    ).toString("hex");
  const secrets = {
    ADMIN_AUTH: `pbkdf2$100000$${salt}$${hash}`,
    ADMIN_PATH: "/seller-" + randomBytes(12).toString("hex"),
    SECURITY_KEY: randomBytes(32).toString("hex"),
  };
  await writeFile(resolve(directory, "secrets.json"), JSON.stringify(secrets), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    resolve(directory, "admin-access.txt"),
    `Arafan Perfume — облачный кабинет\nПуть: ${secrets.ADMIN_PATH}\nЛогин: admin\nПароль: ${password}\n\nТолько для владельца. Не включать в Git или публичную сборку.\n`,
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(
    resolve(directory, ".dev.vars"),
    Object.entries(secrets)
      .map(([k, v]) => k + "=" + JSON.stringify(v))
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Strong production credentials generated privately. Local credentials and orders unchanged.",
  );
}
