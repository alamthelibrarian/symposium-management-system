import type { APIRoute } from "astro";
import { clearSessionCookie, getCookie, writeAudit } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const token = getCookie(request);
  if (token) {
    const row = await locals.runtime.env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ? LIMIT 1")
      .bind(await (async () => {
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
        return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      })()).first<{ user_id: string }>();
    await locals.runtime.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(
      await (async () => {
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
        return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      })()
    ).run();
    if (row) await writeAudit(locals.runtime.env.DB, row.user_id, "logout", "session");
  }
  const secure = new URL(request.url).protocol === "https:";
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(secure) } });
};