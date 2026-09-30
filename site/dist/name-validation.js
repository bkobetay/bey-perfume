// Format and conservative keyboard-spam checks; these cannot verify identity.
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
  // Detect families of keyboard mashing, including shuffled home-row letters.
  // Restrict this heuristic to longer tokens and do not impose a name dictionary.
  const clusters = [
    "фыва",
    "олдж",
    "йцук",
    "ячсм",
    "asdf",
    "jkl",
    "qwer",
    "zxcv",
  ];
  const keyboardMash = (token) =>
    token.length >= 6 &&
    clusters.some(
      (cluster) =>
        [...token].every((letter) => cluster.includes(letter)) &&
        new Set(token).size >= 3,
    );
  const repeatedFragment = (token) => /^(\p{L}{2,3})\1{2,}$/u.test(token);
  if (
    tokens.some(
      (token) =>
        obviousSpam.has(token) ||
        /(\p{L})\1{3,}/u.test(token) ||
        keyboardMash(token) ||
        repeatedFragment(token),
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
