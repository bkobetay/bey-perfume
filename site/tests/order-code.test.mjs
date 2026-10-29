import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  orderCodePrefix,
  orderCode,
  NEXT_ORDER_NUMBER_SQL,
} from "../server/commerce.mjs";

test("short order codes use the Almaty date and a daily sequence", () => {
  // 30 Oct 2026 21:30 UTC is already 31 Oct in Almaty (UTC+5).
  assert.equal(
    orderCodePrefix(new Date("2026-10-30T21:30:00Z")),
    "ARF-311026-",
  );
  assert.equal(orderCode("ARF-311026-", 7), "ARF-311026-07");
  assert.equal(orderCode("ARF-311026-", 123), "ARF-311026-123");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE orders (id TEXT PRIMARY KEY)");
  const next = (prefix) =>
    db.prepare(NEXT_ORDER_NUMBER_SQL).get(prefix + "%").next;
  assert.equal(next("ARF-311026-"), 1);
  for (const id of [
    "ARF-20261031-82C6F184F1",
    "ARF-311026-01",
    "ARF-311026-09",
    "ARF-011126-05",
  ])
    db.prepare("INSERT INTO orders (id) VALUES (?)").run(id);
  assert.equal(next("ARF-311026-"), 10, "legacy long codes are ignored");
  assert.equal(next("ARF-011126-"), 6);
  assert.equal(next("ARF-021126-"), 1);
});
