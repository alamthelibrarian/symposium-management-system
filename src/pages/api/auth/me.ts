import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  const user = await getSessionUser(locals.runtime.env.DB, request);
  return Response.json({ authenticated: Boolean(user), user });
};