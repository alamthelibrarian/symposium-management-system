import type { APIRoute } from "astro";
import { hashPassword, writeAudit } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  if (!env.BOOTSTRAP_SECRET) return Response.json({ error: "Bootstrap is not configured." }, { status: 404 });
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  if ((count?.total || 0) > 0) return Response.json({ error: "Initial administrator already exists." }, { status: 409 });

  let body: { secret?: string; email?: string; name?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.secret || body.secret !== env.BOOTSTRAP_SECRET) return Response.json({ error: "Forbidden." }, { status: 403 });
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || password.length < 12) {
    return Response.json({ error: "Provide a valid email, a name, and a password of at least 12 characters." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, 'administrator')")
    .bind(id, email, name, await hashPassword(password)).run();
  await writeAudit(env.DB, id, "bootstrap", "user", id);
  return Response.json({ created: true, message: "Initial administrator created. Remove the BOOTSTRAP_SECRET from environment settings now." }, { status: 201 });
};