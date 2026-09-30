import test from "node:test";
import assert from "node:assert/strict";
import {
  customerNameError,
  normalizeCustomerName,
} from "../dist/name-validation.js";
test("accepts diverse real-name formats while rejecting obvious invalid entries", () => {
  for (const name of [
    "Байнур",
    "Айдана",
    "Әйгерім",
    "Нұрсұлтан",
    "Александр",
    "Анна-Мария",
    "O’Connor",
    "Jean-Luc",
    "José",
    "李明",
    "Айдана Нұрланқызы",
  ])
    assert.equal(customerNameError(name), "", name);
  for (const name of [
    "",
    null,
    "аовлыдфж",
    "АОВЛЫДФЖ",
    "12345",
    "Имя123",
    "qwerty",
    "аааааа",
    "Аннa",
    "<script>",
    "А!",
  ])
    assert.notEqual(customerNameError(name), "", String(name));
  assert.equal(
    normalizeCustomerName("  Айдана   Нұрланқызы  "),
    "Айдана Нұрланқызы",
  );
});
