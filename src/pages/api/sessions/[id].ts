import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = params.id || "";
  const current = await db.prepare("SELECT id FROM symposium_sessions WHERE id = ?").bind(id).first();
  if (!current) return Response.json({ error: "Session not found." }, { status: 404 });
  const title = String(body.title || "").trim();
  const start = body.start_time == null || body.start_time === "" ? null : String(body.start_time);
  const end = body.end_time == null || body.end_time === "" ? null : String(body.end_time);
  const order = Number(body.sort_order);
  if (!title || (start !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) || (end !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) || (start && end && end <= start) || !Number.isInteger(order) || order < 0) {
    return Response.json({ error: "Provide a title, valid optional times, and a non-negative sort order." }, { status: 400 });
  }
  await db.prepare("UPDATE symposium_sessions SET title = ?, start_time = ?, end_time = ?, sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .bind(title, start, end, order, id).run();
  await writeAudit(db, user.id, "update", "session", id);
  return Response.json({ updated: true });
};

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["administrator"])) return Response.json({ error: "Administrator access required." }, { status: 403 });
  const id = params.id || "";
  const row = await db.prepare("SELECT id FROM symposium_sessions WHERE id = ?").bind(id).first();
  if (!row) return Response.json({ error: "Session not found." }, { status: 404 });
  const { results } = await db.prepare("SELECT m.object_key FROM materials m JOIN presenters p ON p.id = m.presenter_id WHERE p.session_id = ?").bind(id).all<{ object_key: string }>();
  try { await Promise.all(results.map((item) => locals.runtime.env.FILES.delete(item.object_key))); }
  catch { return Response.json({ error: "Could not remove stored presentation files. No session data was deleted." }, { status: 502 }); }
  await db.prepare("DELETE FROM symposium_sessions WHERE id = ?").bind(id).run();
  await writeAudit(db, user.id, "delete", "session", id);
  return new Response(null, { status: 204 });
};