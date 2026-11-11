/// <reference types="astro/client" />

type AppRole = "administrator" | "operator" | "moderator" | "viewer";

interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta?: Record<string, unknown>; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Database { prepare(query: string): D1Statement; }
interface R2ObjectBody { body: ReadableStream; httpMetadata?: { contentType?: string; contentDisposition?: string }; size: number; }
interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: Record<string, unknown>): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}
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
      ctx?: { waitUntil(promise: Promise<unknown>): void };
    };
    user?: {
      id: string;
      email: string;
      display_name: string;
      role: AppRole;
    } | null;
  }
}