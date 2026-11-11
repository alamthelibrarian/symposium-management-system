import type { APIRoute } from "astro";
import { getSessionUser, hasRole, writeAudit } from "../../../lib/auth";
export const prerender = false;
const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"]
]);

async function hasExpectedFileSignature(file: File, contentType: string): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (contentType === "application/pdf") {
    return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  // PPTX is an OOXML ZIP package; reject files without a ZIP local-file header.
  return contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" &&
    bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB;
  const user = await getSessionUser(db, request);
  if (!user || !hasRole(user.role, ["operator"])) return Response.json({ error: "Forbidden." }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "A valid multipart form is required." }, { status: 400 }); }
  const presenterId = String(form.get("presenter_id") || "");
  const file = form.get("file");
  const visibility = form.get("visibility") === "event" ? "event" : "private";
  if (!(file instanceof File) || !presenterId) return Response.json({ error: "presenter_id and file are required." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return Response.json({ error: "File must be between 1 byte and 50 MB." }, { status: 413 });

  const extension = TYPES.get(file.type);
  if (!extension || !file.name.toLowerCase().endsWith(extension) || !(await hasExpectedFileSignature(file, file.type))) {
    return Response.json({ error: "The file must be a valid PDF or PPTX with a matching file extension and content signature." }, { status: 415 });
  }
  const presenter = await db.prepare("SELECT id FROM presenters WHERE id = ?").bind(presenterId).first();
  if (!presenter) return Response.json({ error: "Presenter not found." }, { status: 404 });

  const safeName = file.name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim().slice(0, 240) || `presentation${extension}`;
  const id = crypto.randomUUID();
  const objectKey = `presentations/${presenterId}/${id}${extension}`;
  await locals.runtime.env.FILES.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}` }
  });
  try {
    await db.prepare("INSERT INTO materials (id, presenter_id, original_name, object_key, content_type, size_bytes, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, presenterId, safeName, objectKey, file.type, file.size, visibility, user.id).run();
  } catch (error) {
    await locals.runtime.env.FILES.delete(objectKey);
    throw error;
  }
  await writeAudit(db, user.id, "upload", "material", id);
  return Response.json({ id, presenter_id: presenterId, original_name: safeName, content_type: file.type, size_bytes: file.size, visibility }, { status: 201 });
};
