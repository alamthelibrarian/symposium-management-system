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
  const target = await db.prepare("SELECT id, role, is_active FROM users WHERE id = ?").bind(targetId).first<{ id: string; role: string; is_active: number }>();
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });
  const role = body.role === undefined ? null : String(body.role);
  if (role !== null && !["administrator","operator","moderator","viewer"].includes(role)) return Response.json({ error: "Invalid role." }, { status: 400 });
  const name = body.display_name === undefined ? null : String(body.display_name).trim();
  if (name !== null && (name.length < 2 || name.length > 120)) return Response.json({ error: "Display name must be between 2 and 120 characters." }, { status: 400 });
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") return Response.json({ error: "is_active must be a boolean." }, { status: 400 });
  const nextRole = role ?? target.role;
  const nextActive = body.is_active === undefined ? Number(target.is_active) : body.is_active ? 1 : 0;
  if (target.role === "administrator" && Number(target.is_active) === 1 && (nextRole !== "administrator" || nextActive === 0)) {
    const count = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'administrator' AND is_active = 1").first<{ total: number }>();
    if (Number(count?.total || 0) <= 1) return Response.json({ error: "The last active administrator cannot be demoted or deactivated." }, { status: 409 });
  }
  await db.prepare("UPDATE users SET display_name = COALESCE(?, display_name), role = COALESCE(?, role), is_active = COALESCE(?, is_active), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
    .bind(name, role, body.is_active === undefined ? null : nextActive, targetId).run();
  await writeAudit(db, actor.id, "update", "user", targetId);
  return Response.json({ updated: true });
};