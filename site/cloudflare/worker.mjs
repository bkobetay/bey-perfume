import { handleAPI } from "./api.mjs";
const security = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
export function createWorker(adminHTML) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      let response;
      if (url.pathname.startsWith("/api/"))
        response = await handleAPI(request, env);
      else if (
        env.ADMIN_PATH &&
        /^\/seller-[a-f0-9]{24}$/.test(env.ADMIN_PATH) &&
        [env.ADMIN_PATH, env.ADMIN_PATH + "/"].includes(url.pathname)
      ) {
        response = ["GET", "HEAD"].includes(request.method)
          ? new Response(request.method === "HEAD" ? null : adminHTML, {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex, nofollow, noarchive",
              },
            })
          : new Response("Method not allowed", { status: 405 });
      } else if (url.pathname.startsWith("/seller-assets/"))
        response = await env.ASSETS.fetch(request);
      else
        response = new Response("Страница не найдена", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      const result = new Response(response.body, response);
      for (const [k, v] of Object.entries(security)) result.headers.set(k, v);
      return result;
    },
  };
}
