import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Shopify's boundary.error helper matches thrown responses by
  // error.constructor.name ("ErrorResponseImpl"); esbuild minification mangles
  // class names by default, which silently breaks the session-token bounce
  // flow. keepNames preserves them at negligible size cost.
  esbuild: { keepNames: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
