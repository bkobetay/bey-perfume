(() => {
  const form = document.querySelector("#account-form"),
    message = document.querySelector("#account-message"),
    content = document.querySelector("#account-content");
  let mode = "login";
  async function api(path, body) {
    const r = await fetch("/api/account" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Ошибка запроса");
    return data;
  }
  function show(account) {
    if (!account) return;
    content.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = "Здравствуйте, " + account.name;
    const info = document.createElement("p");
    info.textContent = account.email;
    const out = document.createElement("button");
    out.className = "button";
    out.textContent = "Выйти";
    out.onclick = async () => {
      try {
        await api("/logout", {});
        location.reload();
      } catch (e) {
        message.textContent = e.message;
      }
    };
    content.append(h, info, out);
    const note = document.createElement("p");
    note.className = "field-hint";
    note.textContent =
      "При оформлении заказа в этом браузере он будет связан с вашим аккаунтом.";
    content.append(note);
  }
  document.querySelectorAll("[data-account-view]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.accountView;
        document.querySelector("#account-name-label").hidden =
          mode !== "register";
        form.elements.name.required = mode === "register";
        form.querySelector("[type=submit]").textContent =
          mode === "register" ? "Создать аккаунт" : "Войти";
        form.elements.password.autocomplete =
          mode === "register" ? "new-password" : "current-password";
        message.textContent = "";
      }),
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    try {
      const data = await api("/" + mode, {
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value,
      });
      form.reset();
      show(data.account);
      if (!data.account) show((await api("")).account);
    } catch (e) {
      message.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  document.querySelector("#forgot-password").onclick = async () => {
    if (!form.elements.email.reportValidity()) return;
    try {
      await api("/forgot-password", { email: form.elements.email.value });
      message.textContent =
        "Если адрес зарегистрирован, мы отправим инструкции.";
    } catch (e) {
      message.textContent = e.message;
    }
  };
  api("")
    .then((data) => show(data.account))
    .catch((e) => (message.textContent = e.message));
})();
