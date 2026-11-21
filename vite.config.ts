import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: { cors: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        background: resolve(process.cwd(), "background.html"),
        player: resolve(process.cwd(), "player.html"),
      },
    },
  },
});
