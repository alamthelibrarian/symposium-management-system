import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  const canViewDrafts = Boolean(user && hasRole(user.role, ["operator"]));
  const query = `
    SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.timezone, e.status, e.description,
      (SELECT COUNT(*) FROM symposium_sessions ss WHERE ss.event_id = e.id) AS session_count
    FROM events e
    ${canViewDrafts ? "" : "WHERE e.status = 'published'"}
    ORDER BY e.event_date ASC
  `;
  const { results } = await db.prepare(query).all();
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
  const startTime = String(body.start_time || "13:00");
  const endTime = String(body.end_time || "15:30");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime) {
    return Response.json({ error: "Provide a title, valid date and times, and ensure end time is after start time." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO events (id, title, event_date, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
      .bind(id, title, eventDate, startTime, endTime).run();
  } catch {
    return Response.json({ error: "An event already exists for this date or the data is invalid." }, { status: 409 });
  }
  await writeAudit(db, user.id, "create", "event", id);
  return Response.json({ id, title, event_date: eventDate, start_time: startTime, end_time: endTime }, { status: 201 });
};
