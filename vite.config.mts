import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("./src/renderer"),
  // Loaded over file:// in production, so asset URLs must be relative.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./src/renderer"),
      "@shared": r("./src/shared"),
    },
  },
  server: {
    port: 5317,
    strictPort: true,
  },
  build: {
    outDir: r("./out/renderer"),
    emptyOutDir: true,
    target: "chrome140",
  },
});
