// Format and obvious spam checks, not a dictionary of permitted people's names.
export function normalizeCustomerName(value) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";
}
export function customerNameError(value) {
  const name = normalizeCustomerName(value);
  const hint = "Введите ваше настоящее имя, например Айдана или Александр.";
  if (name.length < 2 || name.length > 80)
    return "Введите имя: от 2 до 80 символов.";
  if (!/^\p{L}[\p{L}\p{M}]*(?:[ '\u2019\-]\p{L}[\p{L}\p{M}]*)*$/u.test(name))
    return "В имени допустимы буквы, пробел, дефис и апостроф. Цифры и другие символы не подходят.";
  const tokens = name.toLocaleLowerCase("ru").split(/[ '\u2019\-]/u);
  const obviousSpam = new Set([
    "аовлыдфж",
    "фыва",
    "фывапр",
    "йцукен",
    "asdf",
    "asdfgh",
    "qwerty",
    "qwertyuiop",
  ]);
  if (
    tokens.some(
      (token) => obviousSpam.has(token) || /(\p{L})\1{3,}/u.test(token),
    )
  )
    return hint;
  if (
    tokens.some(
      (token) =>
        /\p{Script=Latin}/u.test(token) && /\p{Script=Cyrillic}/u.test(token),
    )
  )
    return "Проверьте раскладку: не смешивайте русские и латинские буквы внутри одного имени.";
  return "";
}
