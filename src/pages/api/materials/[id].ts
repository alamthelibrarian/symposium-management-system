import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;

export const GET: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const material = await db.prepare("SELECT id, original_name, object_key, content_type, visibility FROM materials WHERE id = ?")
    .bind(params.id).first<{ id: string; original_name: string; object_key: string; content_type: string; visibility: string }>();
  if (!material) return Response.json({ error: "Material not found." }, { status: 404 });
  if (material.visibility !== "event" && !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const object = await locals.runtime.env.FILES.get(material.object_key);
  if (!object) return Response.json({ error: "Stored file not found." }, { status: 404 });
  const inline = material.content_type === "application/pdf";
  const disposition = inline ? "inline" : "attachment";
  return new Response(object.body, {
    headers: {
      "Content-Type": material.content_type,
      "Content-Length": String(object.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(material.original_name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    }
  });
};

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const material = await db.prepare("SELECT object_key FROM materials WHERE id = ?").bind(params.id).first<{ object_key: string }>();
  if (!material) return Response.json({ error: "Material not found." }, { status: 404 });
  await locals.runtime.env.FILES.delete(material.object_key);
  await db.prepare("DELETE FROM materials WHERE id = ?").bind(params.id).run();
  await writeAudit(db, user.id, "delete", "material", params.id || null);
  return new Response(null, { status: 204 });
};