import type { APIRoute } from "astro";
import {
  clearLoginFailures,
  createSession,
  isLoginRateLimited,
  recordLoginFailure,
  sessionCookie,
  verifyPassword,
  writeAudit
} from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(body.password || "");
  if (!email || !password || password.length > 256) return Response.json({ error: "Email and password are required." }, { status: 400 });

  const ipAddress = request.headers.get("CF-Connecting-IP") || "unknown";
  const db = locals.runtime.env.DB;
  if (await isLoginRateLimited(db, email, ipAddress)) {
    return Response.json({ error: "Too many unsuccessful sign-in attempts. Try again in 15 minutes." }, {
      status: 429,
      headers: { "Retry-After": "900", "Cache-Control": "no-store" }
    });
  }

  const user = await db.prepare(
    "SELECT id, email, display_name, role, password_hash FROM users WHERE email = ? AND is_active = 1 LIMIT 1"
  ).bind(email).first<{ id: string; email: string; display_name: string; role: AppRole; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordLoginFailure(db, email, ipAddress);
    return Response.json({ error: "Email or password is incorrect." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" }
    });
  }

  await clearLoginFailures(db, email, ipAddress);
  const ttl = Math.max(1, Math.min(30, Number(locals.runtime.env.SESSION_TTL_DAYS || 7)));
  const token = await createSession(db, user.id, ttl);
  await writeAudit(db, user.id, "login", "session");
  const secure = new URL(request.url).protocol === "https:";
  return Response.json({ authenticated: true, user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } }, {
    headers: {
      "Set-Cookie": sessionCookie(token, secure, ttl),
      "Cache-Control": "no-store"
    }
  });
};
