import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  session: false,
  adapter: cloudflare({
    imageService: "passthrough",
    platformProxy: { enabled: true }
  }),
  security: {
    checkOrigin: true
  }
});