const COOKIE_NAME = "sms_session";
const ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64(new Uint8Array(bytes));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, expectedText] = stored.split("$");
  if (algorithm !== "pbkdf2" || !iterationText || !saltText || !expectedText) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltText), iterations: Number(iterationText) },
    key,
    256
  );
  const actual = new Uint8Array(bits);
  const expected = fromBase64(expectedText);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

export function getCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE_NAME + "="));
  return entry ? decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)) : null;
}

export async function createSession(db: D1Database, userId: string, ttlDays = 7): Promise<string> {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await digest(token), expires).run();
  return token;
}

export async function getSessionUser(db: D1Database, request: Request) {
  const token = getCookie(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first<{
    id: string; email: string; display_name: string; role: AppRole;
  }>();
  return row || null;
}

export function sessionCookie(token: string, secure: boolean, ttlDays = 7): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${Math.max(1, ttlDays) * 86400}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${COOKIE_NAME}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`;
}

export function hasRole(role: AppRole, allowed: AppRole[]): boolean {
  const hierarchy: Record<AppRole, number> = { viewer: 1, moderator: 2, operator: 3, administrator: 4 };
  return hierarchy[role] >= Math.min(...allowed.map((item) => hierarchy[item]));
}

export async function writeAudit(db: D1Database, userId: string | null, action: string, resourceType: string, resourceId: string | null = null) {
  await db.prepare("INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, action, resourceType, resourceId).run();
}