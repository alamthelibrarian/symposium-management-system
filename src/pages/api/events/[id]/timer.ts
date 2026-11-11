import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../../lib/auth";
export const prerender = false;

export const GET: APIRoute = async ({ locals, request, params }) => {
  const user = await getSessionUser(locals.runtime.env.DB, request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const row = await locals.runtime.env.DB.prepare("SELECT state_json, updated_at FROM timer_states WHERE event_id = ?")
    .bind(params.id).first<{ state_json: string; updated_at: string }>();
  return Response.json({ state: row ? JSON.parse(row.state_json) : null, updated_at: row?.updated_at || null });
};

export const PUT: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["moderator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const event = await db.prepare("SELECT id FROM events WHERE id = ?").bind(params.id).first();
  if (!event) return Response.json({ error: "Event not found." }, { status: 404 });
  let state: Record<string, unknown>;
  try { state = await request.json(); } catch { return Response.json({ error: "Invalid timer state." }, { status: 400 }); }
  const phaseIndex = state.phaseIndex;
  const currentIndex = state.currentIndex;
  const remaining = state.remaining;
  const duration = state.duration;
  const running = state.running;
  const endsAt = state.endsAt;
  const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  if (
    !Number.isInteger(phaseIndex) || Number(phaseIndex) < -1 || Number(phaseIndex) > 3 ||
    !Number.isInteger(currentIndex) || Number(currentIndex) < -1 || Number(currentIndex) > 99 ||
    !validNumber(remaining) || remaining < 0 || remaining > 3600 ||
    !validNumber(duration) || duration < 1 || duration > 3600 ||
    typeof running !== "boolean" ||
    !(endsAt === null || validNumber(endsAt)) ||
    (running && !validNumber(endsAt))
  ) {
    return Response.json({ error: "Timer state contains invalid phase, presenter, duration, or running values." }, { status: 400 });
  }
  const encoded = JSON.stringify(state);
  if (encoded.length > 8000) return Response.json({ error: "Timer state is too large." }, { status: 413 });
  await db.prepare(`INSERT INTO timer_states (event_id, state_json, updated_by) VALUES (?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET state_json = excluded.state_json, updated_by = excluded.updated_by, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
    .bind(params.id, encoded, user.id).run();
  await writeAudit(db, user.id, "update", "timer", params.id || null);
  return Response.json({ saved: true, state, updated_at: new Date().toISOString() });
};