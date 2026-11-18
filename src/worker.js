import { Library } from "./library.js";
import { safeEqual } from "./auth.js";

export { Library };

const MAX_DOC_CHARS = 20_000_000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

const library = (env) => env.LIBRARY.get(env.LIBRARY.idFromName("main"));
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null; };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    try {
      if (!pathname.startsWith("/api/docs")) return json({ error: "not_found" }, 404);

      // Owner-only: Authorization: Bearer <ADMIN_TOKEN>. Fails closed if the secret isn't set.
      // A header (not a cookie) means other sites can't trigger these requests, so no CSRF handling is needed.
      const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!env.ADMIN_TOKEN || !given || !(await safeEqual(given, env.ADMIN_TOKEN))) {
        return json({ error: "unauthorized" }, 401);
      }

      if (pathname === "/api/docs" && request.method === "GET") {
        return json({ docs: await library(env).manifest() });
      }

      const m = pathname.match(/^\/api\/docs\/([\w-]{1,64})$/);
      if (!m) return json({ error: "not_found" }, 404);
      const id = m[1];

      if (request.method === "GET") {
        const doc = await library(env).get(id);
        if (!doc) return json({ error: "not_found" }, 404);
        return new Response(doc.body, {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }

      if (request.method === "PUT") {
        // The body is stored as an opaque string and never parsed here (keeps CPU low);
        // metadata comes in headers.
        const modified = num(request.headers.get("X-Doc-Modified"));
        const created = num(request.headers.get("X-Doc-Created")) ?? 0;
        if (modified === null) return json({ error: "bad_modified" }, 400);
        let title = "";
        try { title = decodeURIComponent(request.headers.get("X-Doc-Title") || "").slice(0, 200); } catch (_) { /* keep empty */ }
        const body = await request.text();
        if (!body || body.length > MAX_DOC_CHARS) return json({ error: "bad_size" }, 413);
        const result = await library(env).put(id, body, {
          title, created, modified, force: request.headers.get("X-Doc-Force") === "1",
        });
        return json(result, result.ok ? 200 : 409);
      }

      if (request.method === "DELETE") return json(await library(env).remove(id));

      return json({ error: "method_not_allowed" }, 405);
    } catch (err) {
      console.error(err);
      return json({ error: "server_error" }, 500);
    }
  },
};
