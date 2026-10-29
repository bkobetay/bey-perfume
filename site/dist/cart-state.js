/* Establish the checkout layout before its first paint; never expose contact details. */
try {
  const items = JSON.parse(localStorage.getItem("bey-cart-v1") || "[]");
  document.documentElement.dataset.cartState =
    Array.isArray(items) && items.length ? "full" : "empty";
} catch {
  document.documentElement.dataset.cartState = "empty";
}
