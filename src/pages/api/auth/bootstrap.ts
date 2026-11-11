import type { APIRoute } from "astro";
import { hashPassword, safeEqual, writeAudit } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  if (!env.BOOTSTRAP_SECRET) return Response.json({ error: "Bootstrap is not configured." }, { status: 404 });

  let body: { secret?: string; email?: string; name?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const suppliedSecret = typeof body.secret === "string" ? body.secret : "";
  if (!safeEqual(suppliedSecret, env.BOOTSTRAP_SECRET)) return Response.json({ error: "Forbidden." }, { status: 403 });

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 120 || password.length < 12 || password.length > 256) {
    return Response.json({ error: "Provide a valid email, a name (2–120 characters), and a password of 12–256 characters." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  // The conditional INSERT is atomic in SQLite: only one concurrent request can claim the empty user table.
  const result = await env.DB.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, role)
    SELECT ?, ?, ?, ?, 'administrator'
    WHERE NOT EXISTS (SELECT 1 FROM users)
  `).bind(id, email, name, passwordHash).run();

  if (!result.meta || Number(result.meta.changes || 0) !== 1) {
    return Response.json({ error: "Initial administrator already exists." }, { status: 409 });
  }

  await writeAudit(env.DB, id, "bootstrap", "user", id);
  return Response.json({
    created: true,
    message: "Initial administrator created. Remove BOOTSTRAP_SECRET from environment settings immediately."
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
};
