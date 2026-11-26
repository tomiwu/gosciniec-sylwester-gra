import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    rollupOptions: {
      input: {
        game: resolve(root, "index.html"),
        panel: resolve(root, "panel/index.html"),
      },
    },
  },
});
