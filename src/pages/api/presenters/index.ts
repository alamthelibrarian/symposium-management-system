import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  const user = await getSessionUser(locals.runtime.env.DB, request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return Response.json({ error: "session_id is required." }, { status: 400 });
  const { results } = await locals.runtime.env.DB.prepare(`
    SELECT p.id, p.session_id, p.display_name, p.affiliation, p.presentation_title, p.sort_order,
      (SELECT m.id FROM materials m WHERE m.presenter_id = p.id ORDER BY m.created_at DESC LIMIT 1) AS material_id,
      (SELECT m.original_name FROM materials m WHERE m.presenter_id = p.id ORDER BY m.created_at DESC LIMIT 1) AS material_name,
      (SELECT m.content_type FROM materials m WHERE m.presenter_id = p.id ORDER BY m.created_at DESC LIMIT 1) AS material_type,
      (SELECT l.id FROM presentation_links l WHERE l.presenter_id = p.id ORDER BY l.created_at DESC LIMIT 1) AS link_id,
      (SELECT l.url FROM presentation_links l WHERE l.presenter_id = p.id ORDER BY l.created_at DESC LIMIT 1) AS presentation_url
    FROM presenters p
    WHERE p.session_id = ? ORDER BY p.sort_order ASC
  `).bind(sessionId).all();
  return Response.json({ presenters: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: { session_id?: string; display_name?: string; affiliation?: string; presentation_title?: string; sort_order?: number };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const sessionId = String(body.session_id || "");
  const name = String(body.display_name || "").trim();
  const title = String(body.presentation_title || "").trim();
  const session = await db.prepare("SELECT id FROM symposium_sessions WHERE id = ?").bind(sessionId).first();
  if (!session || !name || !title) return Response.json({ error: "A valid session, presenter name, and presentation title are required." }, { status: 400 });
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO presenters (id, session_id, display_name, affiliation, presentation_title, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, sessionId, name, String(body.affiliation || "").trim(), title, Number.isInteger(body.sort_order) ? body.sort_order : 0).run();
  await writeAudit(db, user.id, "create", "presenter", id);
  return Response.json({ id, session_id: sessionId, display_name: name, presentation_title: title }, { status: 201 });
};