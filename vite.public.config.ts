import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

/** Public Kody package: the game only. No staff panel. */
export default defineConfig({
  base: "/_assets/",
  build: {
    rollupOptions: {
      input: {
        game: resolve(root, "index.html"),
      },
    },
  },
});
