import { defineMiddleware } from "astro:middleware";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Browser requests that mutate API state must originate from this exact origin.
  // Requests without Origin (e.g. server-to-server bootstrap via CLI) remain supported.
  if (url.pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method) && request.headers.has("Origin")) {
    let origin: string;
    try { origin = new URL(request.headers.get("Origin") || "").origin; }
    catch { return Response.json({ error: "Invalid request origin." }, { status: 403 }); }
    if (origin !== url.origin) {
      return Response.json({ error: "Cross-origin API requests are not allowed." }, { status: 403 });
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (url.pathname.startsWith("/api/")) headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
});
