import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  let body: { presenter_id?: string; url?: string; label?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const presenterId = String(body.presenter_id || "");
  const label = String(body.label || "Presentation link").trim().slice(0, 100);
  let url: URL;
  try { url = new URL(String(body.url || "")); } catch { return Response.json({ error: "A valid HTTPS presentation URL is required." }, { status: 400 }); }
  if (url.protocol !== "https:") return Response.json({ error: "Only HTTPS presentation links are accepted." }, { status: 400 });
  const presenter = await db.prepare("SELECT id FROM presenters WHERE id = ?").bind(presenterId).first();
  if (!presenter) return Response.json({ error: "Presenter not found." }, { status: 404 });
  const existing = await db.prepare("SELECT id FROM presentation_links WHERE presenter_id = ? ORDER BY created_at DESC LIMIT 1").bind(presenterId).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE presentation_links SET label = ?, url = ? WHERE id = ?")
      .bind(label || "Presentation link", url.toString(), existing.id).run();
    await writeAudit(db, user.id, "update", "presentation_link", existing.id);
    return Response.json({ id: existing.id, presenter_id: presenterId, label, url: url.toString(), updated: true });
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO presentation_links (id, presenter_id, label, url) VALUES (?, ?, ?, ?)")
    .bind(id, presenterId, label || "Presentation link", url.toString()).run();
  await writeAudit(db, user.id, "create", "presentation_link", id);
  return Response.json({ id, presenter_id: presenterId, label, url: url.toString() }, { status: 201 });
};