import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;
const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"]
]);

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });
  const form = await request.formData();
  const presenterId = String(form.get("presenter_id") || "");
  const file = form.get("file");
  const visibility = form.get("visibility") === "event" ? "event" : "private";
  if (!(file instanceof File) || !presenterId) return Response.json({ error: "presenter_id and file are required." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return Response.json({ error: "File must be between 1 byte and 50 MB." }, { status: 413 });
  const extension = TYPES.get(file.type);
  if (!extension || !file.name.toLowerCase().endsWith(extension)) return Response.json({ error: "Only PDF and PPTX files are accepted." }, { status: 415 });
  const presenter = await db.prepare("SELECT id FROM presenters WHERE id = ?").bind(presenterId).first();
  if (!presenter) return Response.json({ error: "Presenter not found." }, { status: 404 });

  const id = crypto.randomUUID();
  const objectKey = `presentations/${presenterId}/${id}${extension}`;
  await locals.runtime.env.FILES.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` }
  });
  try {
    await db.prepare("INSERT INTO materials (id, presenter_id, original_name, object_key, content_type, size_bytes, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, presenterId, file.name.slice(0, 240), objectKey, file.type, file.size, visibility, user.id).run();
  } catch (error) {
    await locals.runtime.env.FILES.delete(objectKey);
    throw error;
  }
  await writeAudit(db, user.id, "upload", "material", id);
  return Response.json({ id, presenter_id: presenterId, original_name: file.name, content_type: file.type, size_bytes: file.size, visibility }, { status: 201 });
};