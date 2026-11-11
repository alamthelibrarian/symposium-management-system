import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const result = await db.prepare("DELETE FROM presentation_links WHERE id = ?").bind(params.id).run();
  if (!result.meta || Number(result.meta.changes || 0) === 0) return Response.json({ error: "Presentation link not found." }, { status: 404 });
  await writeAudit(db, user.id, "delete", "presentation_link", params.id || null);
  return new Response(null, { status: 204 });
};