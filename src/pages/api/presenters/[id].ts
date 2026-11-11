import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const current = await db.prepare("SELECT id FROM presenters WHERE id = ?").bind(params.id).first();
  if (!current) return Response.json({ error: "Presenter not found." }, { status: 404 });
  const name = String(body.display_name || "").trim();
  const title = String(body.presentation_title || "").trim();
  if (!name || !title) return Response.json({ error: "Presenter name and presentation title are required." }, { status: 400 });
  await db.prepare("UPDATE presenters SET display_name = ?, affiliation = ?, presentation_title = ?, sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .bind(name, String(body.affiliation || "").trim(), title, Number.isInteger(body.sort_order) ? body.sort_order : 0, params.id).run();
  await writeAudit(db, user.id, "update", "presenter", params.id || null);
  return Response.json({ updated: true });
};

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const result = await db.prepare("DELETE FROM presenters WHERE id = ?").bind(params.id).run();
  if (!result.meta || Number(result.meta.changes || 0) === 0) return Response.json({ error: "Presenter not found." }, { status: 404 });
  await writeAudit(db, user.id, "delete", "presenter", params.id || null);
  return new Response(null, { status: 204 });
};