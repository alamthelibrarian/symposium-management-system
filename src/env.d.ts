/// <reference types="astro/client" />

type AppRole = "administrator" | "operator" | "moderator" | "viewer";

interface CloudflareEnv {
  DB: D1Database;
  FILES: R2Bucket;
  BOOTSTRAP_SECRET?: string;
  SESSION_TTL_DAYS?: string;
  APP_NAME?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv;
      cf?: unknown;
      ctx?: ExecutionContext;
    };
    user?: {
      id: string;
      email: string;
      display_name: string;
      role: AppRole;
    } | null;
  }
}