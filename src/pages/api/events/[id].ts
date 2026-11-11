import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../../lib/auth";
export const prerender = false;

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const id = params.id || "";
  const current = await db.prepare("SELECT id FROM events WHERE id = ?").bind(id).first();
  if (!current) return Response.json({ error: "Event not found." }, { status: 404 });
  const title = String(body.title || "").trim();
  const eventDate = String(body.event_date || "");
  const startTime = String(body.start_time || "13:00");
  const endTime = String(body.end_time || "15:30");
  const status = String(body.status || "draft");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime || !["draft","published","completed"].includes(status)) {
    return Response.json({ error: "Provide a title, valid date and times, and a valid status. End time must be after start time." }, { status: 400 });
  }
  try {
    await db.prepare("UPDATE events SET title = ?, event_date = ?, start_time = ?, end_time = ?, status = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .bind(title, eventDate, startTime, endTime, status, String(body.description || "").trim(), id).run();
  } catch { return Response.json({ error: "An event already exists for this date or the data is invalid." }, { status: 409 }); }
  await writeAudit(db, user.id, "update", "event", id);
  return Response.json({ updated: true });
};

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["administrator"])) return Response.json({ error: "Administrator access required." }, { status: 403 });
  const id = params.id || "";
  const row = await db.prepare("SELECT id FROM events WHERE id = ?").bind(id).first();
  if (!row) return Response.json({ error: "Event not found." }, { status: 404 });
  await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  await writeAudit(db, user.id, "delete", "event", id);
  return new Response(null, { status: 204 });
};