/// <reference path="../.astro/types.d.ts" />

interface CloudflareEnv {
  DB: D1Database;
}

type Runtime = import("@astrojs/cloudflare").Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}