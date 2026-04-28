import { defineConfig } from "vite";
import { vitePlugin as remix } from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  ssr: {
    target: "webworker",
    noExternal: true,
  },
  build: {
    minify: false,
    ...(isSsrBuild
      ? {
          rollupOptions: {
            input: "./server.ts",
            output: {
              entryFileNames: "index.js",
            },
          },
        }
      : {}),
  },
}));
