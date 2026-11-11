const COOKIE_NAME = "sms_session";
const ITERATIONS = 310_000;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 8;

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

export function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algorithm, iterationText, saltText, expectedText] = stored.split("$");
    const iterations = Number(iterationText);
    if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltText || !expectedText) return false;
    const salt = fromBase64(saltText);
    const expected = fromBase64(expectedText);
    if (salt.length !== 16 || expected.length !== 32) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return safeEqual(toBase64(new Uint8Array(bits)), toBase64(expected));
  } catch {
    return false;
  }
}

export function getCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE_NAME + "="));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)); } catch { return null; }
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

async function loginRateKeys(email: string, ipAddress: string): Promise<string[]> {
  return Promise.all([digest(`email:${email}`), digest(`ip:${ipAddress}`)]);
}

export async function isLoginRateLimited(db: D1Database, email: string, ipAddress: string): Promise<boolean> {
  const keys = await loginRateKeys(email, ipAddress);
  for (const key of keys) {
    const row = await db.prepare("SELECT blocked_until FROM login_rate_limits WHERE key_hash = ? AND blocked_until > ?")
      .bind(key, new Date().toISOString()).first();
    if (row) return true;
  }
  return false;
}

export async function recordLoginFailure(db: D1Database, email: string, ipAddress: string): Promise<void> {
  const keys = await loginRateKeys(email, ipAddress);
  for (const key of keys) {
    await db.prepare(`
      INSERT INTO login_rate_limits (key_hash, window_started_at, attempts, blocked_until)
      VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1, NULL)
      ON CONFLICT(key_hash) DO UPDATE SET
        window_started_at = CASE
          WHEN login_rate_limits.window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LOGIN_WINDOW_MINUTES} minutes')
          THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          ELSE login_rate_limits.window_started_at END,
        attempts = CASE
          WHEN login_rate_limits.window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LOGIN_WINDOW_MINUTES} minutes')
          THEN 1 ELSE login_rate_limits.attempts + 1 END,
        blocked_until = CASE
          WHEN login_rate_limits.window_started_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LOGIN_WINDOW_MINUTES} minutes')
          THEN NULL
          WHEN login_rate_limits.attempts >= ${LOGIN_MAX_ATTEMPTS - 1}
          THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${LOGIN_WINDOW_MINUTES} minutes')
          ELSE login_rate_limits.blocked_until END
    `).bind(key).run();
  }
}

export async function clearLoginFailures(db: D1Database, email: string, ipAddress: string): Promise<void> {
  const keys = await loginRateKeys(email, ipAddress);
  for (const key of keys) {
    await db.prepare("DELETE FROM login_rate_limits WHERE key_hash = ?").bind(key).run();
  }
}

export async function writeAudit(db: D1Database, userId: string | null, action: string, resourceType: string, resourceId: string | null = null) {
  await db.prepare("INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, action, resourceType, resourceId).run();
}
