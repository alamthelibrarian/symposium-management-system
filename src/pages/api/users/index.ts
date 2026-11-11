import type { APIRoute } from "astro";
import { getSessionUser, hashPassword, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  const user = await getSessionUser(locals.runtime.env.DB, request);
  if (!user || user.role !== "administrator") return Response.json({ error: "Administrator access required." }, { status: 403 });
  const { results } = await locals.runtime.env.DB.prepare("SELECT id, email, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC").all();
  return Response.json({ users: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const actor = await getSessionUser(db, request);
  if (!actor || actor.role !== "administrator") return Response.json({ error: "Administrator access required." }, { status: 403 });
  let body: { email?: string; display_name?: string; password?: string; role?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.display_name || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "viewer");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 120 || password.length < 12 || password.length > 256 || !["administrator","operator","moderator","viewer"].includes(role)) {
    return Response.json({ error: "Provide a valid email, display name, password (12+ characters), and role." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO users (id, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
      .bind(id, email, name, await hashPassword(password), role).run();
  } catch { return Response.json({ error: "An account with this email may already exist." }, { status: 409 }); }
  await writeAudit(db, actor.id, "create", "user", id);
  return Response.json({ id, email, display_name: name, role }, { status: 201 });
};