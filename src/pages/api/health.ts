import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const row = await locals.runtime.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return Response.json({ status: "ok", database: row?.ok === 1, app: locals.runtime.env.APP_NAME || "Symposium Management System" });
  } catch {
    return Response.json({ status: "degraded", database: false }, { status: 503 });
  }
};