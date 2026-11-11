import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  const user = await getSessionUser(locals.runtime.env.DB, request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) return Response.json({ error: "event_id is required." }, { status: 400 });
  const { results } = await locals.runtime.env.DB.prepare("SELECT id, event_id, title, sort_order, start_time, end_time FROM symposium_sessions WHERE event_id = ? ORDER BY sort_order")
    .bind(eventId).all();
  return Response.json({ sessions: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: { event_id?: string; title?: string; sort_order?: number };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const eventId = String(body.event_id || "");
  const title = String(body.title || "").trim();
  const event = await db.prepare("SELECT id FROM events WHERE id = ?").bind(eventId).first();
  if (!event || !title) return Response.json({ error: "A valid event_id and title are required." }, { status: 400 });
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO symposium_sessions (id, event_id, title, sort_order) VALUES (?, ?, ?, ?)")
    .bind(id, eventId, title, Number.isInteger(body.sort_order) ? body.sort_order : 0).run();
  await writeAudit(db, user.id, "create", "session", id);
  return Response.json({ id, event_id: eventId, title }, { status: 201 });
};