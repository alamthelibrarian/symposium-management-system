import type { APIRoute } from "astro";
import { getSessionUser, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const actor = await getSessionUser(db, request);
  if (!actor || actor.role !== "administrator") return Response.json({ error: "Administrator access required." }, { status: 403 });
  let body: { display_name?: string; role?: string; is_active?: boolean };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const targetId = params.id || "";
  if (targetId === actor.id && body.is_active === false) return Response.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  const target = await db.prepare("SELECT id FROM users WHERE id = ?").bind(targetId).first();
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });
  const role = body.role === undefined ? null : String(body.role);
  if (role !== null && !["administrator","operator","moderator","viewer"].includes(role)) return Response.json({ error: "Invalid role." }, { status: 400 });
  const name = body.display_name === undefined ? null : String(body.display_name).trim();
  if (name !== null && name.length < 2) return Response.json({ error: "Display name is too short." }, { status: 400 });
  await db.prepare("UPDATE users SET display_name = COALESCE(?, display_name), role = COALESCE(?, role), is_active = COALESCE(?, is_active), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .bind(name, role, body.is_active === undefined ? null : body.is_active ? 1 : 0, targetId).run();
  await writeAudit(db, actor.id, "update", "user", targetId);
  return Response.json({ updated: true });
};