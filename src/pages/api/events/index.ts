import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const { results } = await locals.runtime.env.DB.prepare(`
    SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.timezone, e.status, e.description,
      (SELECT COUNT(*) FROM symposium_sessions ss WHERE ss.event_id = e.id) AS session_count
    FROM events e ORDER BY e.event_date ASC
  `).all();
  return Response.json({ events: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const title = String(body.title || "").trim();
  const eventDate = String(body.event_date || "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return Response.json({ error: "A title and valid event_date are required." }, { status: 400 });
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO events (id, title, event_date) VALUES (?, ?, ?)").bind(id, title, eventDate).run();
  } catch {
    return Response.json({ error: "An event already exists for this date or the data is invalid." }, { status: 409 });
  }
  await writeAudit(db, user.id, "create", "event", id);
  return Response.json({ id, title, event_date: eventDate }, { status: 201 });
};